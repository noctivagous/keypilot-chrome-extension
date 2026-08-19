/**
 * Package a reviewable Opera Add-ons ZIP from a staged copy of the extension.
 *
 * Does not rewrite extension/manifest.json. The shared `npm run build` step may
 * still stamp the development description; this script copies that file and
 * replaces the description only in dist/opera/manifest.json.
 *
 * Usage:
 *   npm run package:opera
 *   node scripts/package-opera.mjs --skip-build
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { ZipArchive } from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skipBuild = process.argv.includes('--skip-build');

const configPath = path.join(repoRoot, 'scripts/opera/release-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const extensionDir = path.join(repoRoot, 'extension');
const stagingDir = path.join(repoRoot, config.stagingDir);
const zipDir = path.join(repoRoot, config.zipDir);
const sourceManifestPath = path.join(extensionDir, 'manifest.json');

const TIMESTAMP_PREFIX_RE = /^[A-Z][a-z]{2}-\d{1,2}-\d{4}-\d{1,2}:\d{2}(AM|PM)\s+/;
const EXTERNAL_SCRIPT_RE = /<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
const HTML_REF_RE = /<(?:script|link|img|source)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

function posixRel(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

function globToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const excludeMatchers = (config.exclude || []).map((pattern) => {
  const normalized = String(pattern).replaceAll('\\', '/');
  const matchers = [globToRegExp(normalized)];
  if (normalized.endsWith('/**')) {
    matchers.push(globToRegExp(normalized.slice(0, -3)));
  }
  return matchers;
}).flat();

function isExcluded(relPath) {
  const rel = String(relPath).replaceAll('\\', '/');
  return excludeMatchers.some((re) => re.test(rel));
}

function walkFiles(rootDir) {
  const out = [];
  function visit(abs) {
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(abs, entry.name);
      const rel = posixRel(rootDir, next);
      if (isExcluded(rel)) continue;
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) out.push({ abs: next, rel });
    }
  }
  visit(rootDir);
  return out;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function gitRev() {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.on('close', (code) => {
      resolve(code === 0 ? out.trim() : null);
    });
    child.on('error', () => resolve(null));
  });
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyStagedFiles() {
  emptyDir(stagingDir);
  const files = walkFiles(extensionDir);
  for (const file of files) {
    const dest = path.join(stagingDir, file.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file.abs, dest);
  }
  return files.length;
}

function keepIconMap(map, sizes) {
  if (!map || typeof map !== 'object') return map;
  const next = {};
  for (const size of sizes) {
    if (map[size]) next[size] = map[size];
  }
  return next;
}

function patchStagedManifest() {
  const stagedPath = path.join(stagingDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(stagedPath, 'utf8'));
  const description = String(config.description || '').trim();
  if (!description) {
    throw new Error('Opera release description is empty');
  }
  if (description.length > config.descriptionMaxLength) {
    throw new Error(
      `Opera description is ${description.length} characters; max is ${config.descriptionMaxLength}`
    );
  }
  if (TIMESTAMP_PREFIX_RE.test(description)) {
    throw new Error('Opera description must not include a build timestamp');
  }

  manifest.description = description;
  const sizes = config.operaIconSizes || ['16', '48', '128'];
  if (manifest.action?.default_icon) {
    manifest.action.default_icon = keepIconMap(manifest.action.default_icon, sizes);
  }
  if (manifest.icons) {
    manifest.icons = keepIconMap(manifest.icons, sizes);
  }

  fs.writeFileSync(stagedPath, `${JSON.stringify(manifest, null, 4)}\n`);
  return { manifest, stagedPath };
}

function isVirtualWarPath(resource) {
  const rel = String(resource).replace(/^\/+/, '');
  return (config.virtualWarPaths || []).some((pattern) => {
    const re = globToRegExp(pattern.replace(/^\/+/, ''));
    return re.test(rel) || re.test(resource);
  });
}

function expandGlob(rootDir, pattern) {
  const re = globToRegExp(pattern);
  return walkFiles(rootDir)
    .map((file) => file.rel)
    .filter((rel) => re.test(rel));
}

function collectManifestPaths(manifest) {
  const paths = [];
  const add = (value) => {
    if (typeof value === 'string' && value) paths.push(value.replace(/^\/+/, ''));
  };

  add(manifest.background?.service_worker);
  add(manifest.action?.default_popup);
  for (const value of Object.values(manifest.action?.default_icon || {})) add(value);
  for (const value of Object.values(manifest.icons || {})) add(value);
  for (const group of manifest.content_scripts || []) {
    for (const file of group.js || []) add(file);
    for (const file of group.css || []) add(file);
  }
  for (const group of manifest.web_accessible_resources || []) {
    for (const resource of group.resources || []) add(resource);
  }
  return paths;
}

function validateStagedManifest(manifest) {
  const errors = [];
  const stagedManifestPath = path.join(stagingDir, 'manifest.json');
  try {
    JSON.parse(fs.readFileSync(stagedManifestPath, 'utf8'));
  } catch (err) {
    errors.push(`Staged manifest is not valid JSON: ${err.message}`);
  }

  for (const rel of config.requiredGeneratedFiles || []) {
    if (!fs.existsSync(path.join(stagingDir, rel))) {
      errors.push(`Missing generated file: ${rel}`);
    }
  }
  for (const rel of config.requiredRuntimeFiles || []) {
    if (!fs.existsSync(path.join(stagingDir, rel))) {
      errors.push(`Missing required runtime file: ${rel}`);
    }
  }
  for (const rel of config.forbiddenFirstPartyMinJs || []) {
    if (fs.existsSync(path.join(stagingDir, rel))) {
      errors.push(`Forbidden minified first-party file staged: ${rel}`);
    }
  }

  for (const resource of collectManifestPaths(manifest)) {
    if (isVirtualWarPath(resource)) continue;
    if (resource.includes('*')) {
      const matches = expandGlob(stagingDir, resource);
      if (matches.length === 0) {
        errors.push(`WAR glob matched no staged files: ${resource}`);
      }
      continue;
    }
    if (!fs.existsSync(path.join(stagingDir, resource))) {
      errors.push(`Manifest path missing from staged package: ${resource}`);
    }
  }

  const htmlFiles = walkFiles(stagingDir).filter((file) => file.rel.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file.abs, 'utf8');
    EXTERNAL_SCRIPT_RE.lastIndex = 0;
    let match;
    while ((match = EXTERNAL_SCRIPT_RE.exec(html))) {
      errors.push(`${file.rel} loads external JavaScript: ${match[1]}`);
    }
    HTML_REF_RE.lastIndex = 0;
    while ((match = HTML_REF_RE.exec(html))) {
      const ref = match[1];
      if (!ref || /^(https?:|data:|chrome:|opera:|blob:|#)/i.test(ref)) continue;
      const resolved = path.normalize(path.join(path.dirname(file.abs), ref.split('?')[0]));
      const rel = posixRel(stagingDir, resolved);
      if (rel.startsWith('..') || !fs.existsSync(resolved)) {
        errors.push(`${file.rel} references missing asset: ${ref}`);
      }
    }
  }

  const cssFiles = walkFiles(stagingDir).filter((file) => file.rel.endsWith('.css'));
  for (const file of cssFiles) {
    const css = fs.readFileSync(file.abs, 'utf8');
    CSS_URL_RE.lastIndex = 0;
    let match;
    while ((match = CSS_URL_RE.exec(css))) {
      const ref = match[1];
      if (!ref || /^(https?:|data:|chrome:|opera:)/i.test(ref)) continue;
      const resolved = path.normalize(path.join(path.dirname(file.abs), ref.split('?')[0]));
      if (!fs.existsSync(resolved)) {
        errors.push(`${file.rel} references missing asset: ${ref}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Opera package validation failed:\n- ${errors.join('\n- ')}`);
  }
}

function zipStagedDir(zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(stagingDir, false);
    archive.finalize();
  });
}

async function main() {
  if (!fs.existsSync(extensionDir)) {
    throw new Error(`Extension directory not found: ${extensionDir}`);
  }

  if (!skipBuild) {
    console.log('Running npm run build...');
    await run('npm', ['run', 'build'], repoRoot);
  } else {
    console.log('Skipping build (--skip-build)');
  }

  for (const rel of config.requiredGeneratedFiles || []) {
    if (!fs.existsSync(path.join(extensionDir, rel))) {
      throw new Error(`Build output missing before packaging: extension/${rel}`);
    }
  }

  const sourceManifestBefore = sha256File(sourceManifestPath);
  const copied = copyStagedFiles();
  const { manifest } = patchStagedManifest();
  const sourceManifestAfter = sha256File(sourceManifestPath);
  if (sourceManifestBefore !== sourceManifestAfter) {
    throw new Error('package:opera mutated extension/manifest.json; packaging must leave the development manifest unchanged');
  }

  validateStagedManifest(manifest);

  const version = String(manifest.version || '').trim();
  if (!version) throw new Error('Staged manifest is missing version');
  const zipName = String(config.zipNameTemplate).replace('{version}', version);
  const zipPath = path.join(zipDir, zipName);
  const bytes = await zipStagedDir(zipPath);
  const digest = sha256File(zipPath);
  const commit = await gitRev();
  const files = walkFiles(stagingDir).map((file) => file.rel).sort();
  const builtAt = new Date().toISOString();

  const metadata = {
    archive: posixRel(repoRoot, zipPath),
    version,
    bytes,
    sha256: digest,
    gitCommit: commit,
    builtAt,
    stagedFiles: copied,
    sourceManifestUnchanged: true
  };
  const metadataPath = path.join(zipDir, zipName.replace(/\.zip$/i, '.metadata.json'));
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log('');
  console.log(`Archive:    ${metadata.archive}`);
  console.log(`Version:    ${version}`);
  console.log(`Bytes:      ${bytes}`);
  console.log(`SHA-256:    ${digest}`);
  console.log(`Git commit: ${commit || '(unavailable)'}`);
  console.log(`Built:      ${builtAt}`);
  console.log(`Files:      ${files.length} total`);
  for (const rel of files) console.log(`  ${rel}`);
  console.log(`Metadata:   ${posixRel(repoRoot, metadataPath)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
