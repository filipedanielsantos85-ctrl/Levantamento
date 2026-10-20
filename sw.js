const SHELL_CACHE = "lev-shell-v2";
const TILE_CACHE = "lev-tiles";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];
const TILE_HOSTS = ["tile.openstreetmap.org", "server.arcgisonline.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Mosaicos do mapa: primeiro a cache, depois a rede (e guarda)
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req.url, r.clone()).catch(() => {}); return r; }
      catch { return new Response("", { status: 504 }); }
    }));
    return;
  }
  // Bibliotecas e tipos de letra: cache primeiro
  if (url.hostname.endsWith("cdnjs.cloudflare.com") || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(SHELL_CACHE).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req); c.put(req.url, r.clone()).catch(() => {}); return r;
    }));
    return;
  }
  // A própria app: rede primeiro (para receber atualizações), cache sem rede
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache:"no-store" }).then(r => { const cp = r.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(h => h || caches.match("./index.html"))));
  }
});
