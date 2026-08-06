/* JOJO的发财之路 - Service Worker
   策略：
   - 页面/资源：网络优先（确保拿到最新版本），失败时回退缓存（离线可用）
   - 版本号变更时清理旧缓存，避免"看不到更新"
   - 更新版本号时只需改 CACHE_VERSION */
const CACHE_VERSION = "jojo-v20260806b55";
const CACHE_NAME = CACHE_VERSION;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/styles.css?v=20260806b55",
  "./assets/app.js?v=20260806b55",
  "./assets/data.js?v=20260806b55",
  "./assets/config.js?v=20260806b55",
  "./assets/sync.js?v=20260806b55",
  "./assets/manual-sync.js?v=20260806b55",
  "./assets/lunar.js?v=20260806b55",
  "./assets/dog_icons.js?v=20260806b55"
];

/* 安装：预缓存核心资源 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* 网络优先，失败回退缓存 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 只处理同源请求，CDN/跨域不拦截
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 缓存成功的 GET 响应（仅同源）
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          // 请求带版本参数但没命中时，尝试无参数/不带版本的基础路径
          if (!cached) {
            const stripped = new URL(req.url);
            stripped.search = "";
            return caches.match(stripped);
          }
          return cached;
        })
      )
  );
});
