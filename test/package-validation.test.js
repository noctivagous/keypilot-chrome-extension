import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = join(extensionRoot, 'extension');
const manifestPath = join(extensionDir, 'manifest.json');
const configPath = join(extensionRoot, 'scripts/opera/release-config.json');

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

test('Opera package contains the validated release surface', (t) => {
  const requiredGeneratedFiles = [
    'content-bundled.js',
    'frame-agent-bundled.js',
    'pages/docs-bundled.js',
    'pages/settings-bundled.js'
  ];
  if (requiredGeneratedFiles.some((file) => !existsSync(join(extensionDir, file)))) {
    t.skip('Run npm run build before package validation');
    return;
  }

  const sourceManifestBefore = sha256(manifestPath);
  execFileSync(process.execPath, ['scripts/package-opera.mjs', '--skip-build'], {
    cwd: extensionRoot,
    stdio: 'ignore'
  });
  assert.equal(
    sha256(manifestPath),
    sourceManifestBefore,
    'packaging must not rewrite extension/manifest.json'
  );

  const config = readJson(configPath);
  const stagedDir = join(extensionRoot, config.stagingDir);
  const stagedManifest = readJson(join(stagedDir, 'manifest.json'));

  assert.equal(stagedManifest.description, config.description);
  assert.ok(stagedManifest.description.length <= config.descriptionMaxLength);
  assert.deepEqual(Object.keys(stagedManifest.icons).sort(), ['128', '16', '48']);
  assert.deepEqual(Object.keys(stagedManifest.action.default_icon).sort(), ['128', '16', '48']);
  assert.equal(stagedManifest.homepage_url, config.homepageUrl);
  assert.deepEqual(stagedManifest.developer, config.developer);

  const resources = stagedManifest.web_accessible_resources
    .flatMap((group) => group.resources);
  assert.deepEqual(resources, ['themes/*', 'fonts/*', 'pages/*', 'userdocs/*', '_favicon/*']);
  assert.equal(resources.some((resource) => resource.startsWith('src/')), false);

  for (const file of requiredGeneratedFiles) {
    assert.equal(existsSync(join(stagedDir, file)), true, `missing generated file: ${file}`);
  }
  for (const file of config.requiredRuntimeFiles) {
    assert.equal(existsSync(join(stagedDir, file)), true, `missing runtime file: ${file}`);
  }
  for (const file of config.exclude.filter((entry) => !entry.includes('*'))) {
    assert.equal(existsSync(join(stagedDir, file)), false, `excluded file was staged: ${file}`);
  }
});
