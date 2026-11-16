/* LeafCheckup service worker: offline-first for the app shell, model and runtime. */
const VERSION = "leafcheckup-v2";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URLS = ["/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => Promise.all(OFFLINE_URLS.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/models/") ||
  url.pathname.startsWith("/ort/") ||
  url.pathname.startsWith("/samples/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(woff2|svg|png|jpg|webp)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const u = new URL(req.url);
  if (req.method === "POST" && u.origin === self.location.origin && u.pathname === "/share-target") {
    // Web Share Target: stash the shared photo and open the diagnosis page on it
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get("image");
        if (file && typeof file !== "string") {
          const cache = await caches.open("leafcheckup-share");
          await cache.put("/shared-image", new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } }));
          return Response.redirect("/diagnose?shared=1", 303);
        }
      } catch {}
      return Response.redirect("/diagnose", 303);
    })());
    return;
  }
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/share-target") return;

  if (isStatic(url)) {
    // Cache-first: versioned, immutable assets (model weights, wasm, hashed JS/CSS)
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: url.pathname.startsWith("/models/") });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    // Network-first for pages, fall back to the cached copy, then the offline page
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          const hit = await cache.match(req);
          if (hit) return hit;
          return (await cache.match("/offline")) || Response.error();
        })
    );
  }
});
