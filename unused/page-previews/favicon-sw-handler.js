/**
 * PARKED: service-worker `KP_GET_FAVICON` handler formerly in
 * `extension/background.js` (onMessage switch).
 *
 * Restore: paste this `case` back into the SW message switch and add
 * `GET_FAVICON: 'KP_GET_FAVICON'` to `extension/src/messaging/types.js`.
 *
 * High-res favicon fetch with multi-source probe + local cache.
 * Prefer large icons (Google sz=, apple-touch-icon, manifest-style paths)
 * over Chrome's small tab favicon when possible.
 */

/*
        case 'KP_GET_FAVICON': {
          const pageUrl = typeof message.pageUrl === 'string' ? message.pageUrl.trim() : '';
          const size = Math.max(16, Math.min(256, Number(message.size) || 32));
          // Bucket cache so 64/96/128 requests share a high-res entry when possible.
          const cacheSize = size >= 96 ? 128 : size >= 48 ? 64 : size;

          if (!pageUrl) {
            sendResponse({
              type: 'KP_FAVICON_RESPONSE',
              success: false,
              error: 'Missing pageUrl'
            });
            break;
          }

          try {
            let urlObj;
            try {
              urlObj = new URL(pageUrl);
            } catch (e) {
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: false,
                error: 'Invalid URL'
              });
              break;
            }

            const scheme = String(urlObj.protocol || '').toLowerCase();
            // Origin path probes and third-party icon CDNs only work for real web pages.
            // chrome://, chrome-extension://, edge://, about:, etc. are blocked by CSP
            // (connect-src is 'self' https: http:) and produce noisy console errors.
            const isHttpOrigin = scheme === 'http:' || scheme === 'https:';
            const domain = (urlObj.hostname || '').replace(/^www\./i, '');
            const origin = urlObj.origin;
            const cacheIdentity = isHttpOrigin
              ? (domain || origin || 'unknown')
              : `${scheme.replace(/:$/, '')}_${domain || 'local'}`;
            const cacheKey = `kp_favicon_v2_${cacheIdentity}_${cacheSize}`;
            const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

            // Check cache first
            try {
              const cached = await chrome.storage.local.get([cacheKey]);
              if (cached[cacheKey]) {
                const cachedData = cached[cacheKey];
                const age = Date.now() - (cachedData.timestamp || 0);
                if (age < CACHE_DURATION_MS && cachedData.dataUrl) {
                  sendResponse({
                    type: 'KP_FAVICON_RESPONSE',
                    success: true,
                    dataUrl: cachedData.dataUrl,
                    width: cachedData.width || 0,
                    height: cachedData.height || 0,
                    cached: true
                  });
                  break;
                }
              }
            } catch (e) {
              // Cache read failed, continue to fetch
            }

            const blobToDataUrl = (blob) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

            const measureBlob = async (blob) => {
              try {
                if (typeof createImageBitmap === 'function') {
                  const bmp = await createImageBitmap(blob);
                  const dims = { width: bmp.width || 0, height: bmp.height || 0 };
                  try {
                    bmp.close();
                  } catch {
                    // ignore
                  }
                  return dims;
                }
              } catch {
                // fall through
              }
              return { width: 0, height: 0 };
            };

            const primaryCandidates = [];
            const originPathCandidates = [];

            if (isHttpOrigin && domain) {
              // 1) Google favicon service — often returns real high-res icons when sz is large.
              const googleSz = Math.max(cacheSize, 128);
              primaryCandidates.push({
                url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${googleSz}`,
                priority: 100
              });
              primaryCandidates.push({
                url: `https://www.google.com/s2/favicons?sz=${googleSz}&domain_url=${encodeURIComponent(origin)}`,
                priority: 95
              });

              // 2) DuckDuckGo icons
              primaryCandidates.push({
                url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
                priority: 40
              });

              // 3) Common high-res origin icons (touch / PWA) — only if CDNs fall short.
              const hiResPaths = [
                '/apple-touch-icon.png',
                '/apple-touch-icon-precomposed.png',
                '/apple-touch-icon-180x180.png',
                '/apple-touch-icon-152x152.png',
                '/android-chrome-192x192.png',
                '/android-chrome-512x512.png',
                '/favicon-196x196.png',
                '/favicon-192x192.png',
                '/favicon-128x128.png',
                '/favicon-96x96.png',
                '/favicon-32x32.png',
                '/favicon.png',
                '/favicon.ico'
              ];
              for (let i = 0; i < hiResPaths.length; i++) {
                originPathCandidates.push({
                  url: `${origin}${hiResPaths[i]}`,
                  priority: 80 - i
                });
              }
            }

            // 4) Chrome extension favicon API (visited-site cache; often only 16/32).
            try {
              const extFav = new URL(chrome.runtime.getURL('/_favicon/'));
              extFav.searchParams.set('pageUrl', pageUrl);
              extFav.searchParams.set('size', String(Math.min(128, Math.max(32, cacheSize))));
              primaryCandidates.push({ url: extFav.toString(), priority: 20 });
            } catch {
              // ignore
            }

            let best = null;

            const fetchCandidate = async (c) => {
              try {
                const response = await fetch(c.url, {
                  method: 'GET',
                  mode: 'cors',
                  credentials: 'omit',
                  referrerPolicy: 'no-referrer',
                  cache: 'force-cache'
                });
                if (!response.ok) return null;
                const blob = await response.blob();
                if (!blob || blob.size <= 0) return null;
                const type = String(blob.type || '').toLowerCase();
                if (
                  type &&
                  !type.startsWith('image/') &&
                  type !== 'application/octet-stream' &&
                  type !== 'application/ico' &&
                  type !== 'text/plain'
                ) {
                  if (blob.size < 32) return null;
                }
                const dims = await measureBlob(blob);
                if (dims.width > 0 && dims.height > 0 && dims.width <= 2 && dims.height <= 2) {
                  return null;
                }
                const dataUrl = await blobToDataUrl(blob);
                if (!dataUrl || typeof dataUrl !== 'string') return null;
                return {
                  dataUrl,
                  width: dims.width,
                  height: dims.height,
                  priority: c.priority,
                  bytes: blob.size
                };
              } catch {
                return null;
              }
            };

            const minGoodEdge = Math.max(cacheSize, 96);
            const isGoodEnough = (r) =>
              Boolean(r && Math.min(r.width || 0, r.height || 0) >= minGoodEdge);

            const considerResult = (r) => {
              if (!r) return;
              if (!best) {
                best = r;
                return;
              }
              const bestArea = (best.width || 0) * (best.height || 0);
              const rArea = (r.width || 0) * (r.height || 0);
              if (
                rArea > bestArea ||
                (rArea === bestArea && r.priority > best.priority) ||
                (rArea === bestArea && r.priority === best.priority && r.bytes > best.bytes)
              ) {
                best = r;
              }
            };

            const probeBatches = async (list) => {
              const batchSize = 4;
              for (let i = 0; i < list.length; i += batchSize) {
                const batch = list.slice(i, i + batchSize);
                const results = await Promise.all(batch.map((c) => fetchCandidate(c)));
                for (const r of results) considerResult(r);
                if (isGoodEnough(best)) return;
              }
            };

            await probeBatches(primaryCandidates);
            if (!isGoodEnough(best) && originPathCandidates.length) {
              await probeBatches(originPathCandidates);
            }

            if (best?.dataUrl) {
              try {
                await chrome.storage.local.set({
                  [cacheKey]: {
                    dataUrl: best.dataUrl,
                    width: best.width || 0,
                    height: best.height || 0,
                    timestamp: Date.now()
                  }
                });
              } catch (e) {
                // Cache write failed, but we still have the favicon
              }
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: true,
                dataUrl: best.dataUrl,
                width: best.width || 0,
                height: best.height || 0,
                cached: false
              });
            } else {
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: false,
                error: 'Favicon not found'
              });
            }
          } catch (error) {
            console.error('KP_GET_FAVICON failed:', error);
            sendResponse({
              type: 'KP_FAVICON_RESPONSE',
              success: false,
              error: error.message || 'Unknown error'
            });
          }
          break;
        }
*/
