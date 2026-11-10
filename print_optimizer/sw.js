const VERSION = '26bd621ed1';
const CACHE = 'printopt-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest',
                './icons/icon-192.png', './icons/icon-512.png',
                './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个加而不是 addAll：少一个图标不该让整个安装失败
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCDN = url.hostname === 'cdn.jsdelivr.net';   // Pyodide 运行时与 wheel
  const isSame = url.origin === self.location.origin;
  if (!isCDN && !isSame) return;

  // 页面导航：网络优先，断网回退缓存，保证改版后能拿到新版
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', resp.clone());
        return resp;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // 其余：缓存优先（Pyodide 的 wasm/wheel 都是内容固定的，不会过期）
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    const resp = await fetch(req);
    if (resp && (resp.ok || resp.type === 'opaque')) c.put(req, resp.clone());
    return resp;
  })());
});
