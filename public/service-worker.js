const getBasePath = () => {
  const path = self.location.pathname.replace(/\/service-worker\.js$/, "");
  return path || "";
};

const basePath = getBasePath();
const cacheScope = basePath === "/test" ? "test" : basePath === "/matchapp" ? "prod" : "dev";
const CACHE_PREFIX = `matchapp-${cacheScope}-shell-`;
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const baseUrl = `${self.location.origin}${basePath}`;

const shellUrls = [
  `${baseUrl}/`,
  `${baseUrl}/index.html`,
  `${baseUrl}/asset-manifest.json`,
  `${baseUrl}/version.json`,
  `${baseUrl}/manifest.json`,
  `${baseUrl}/icons/icon-192.png`,
  `${baseUrl}/icons/icon-512.png`
];

const cacheUrls = async (cache, urls) => {
  await Promise.all(
    urls.map((url) =>
      cache.add(url).catch(() => {
        // A single missing optional asset must not abort offline support.
      })
    )
  );
};

const getBuildAssetUrls = async () => {
  try {
    const response = await fetch(`${baseUrl}/asset-manifest.json`, { cache: "no-store" });
    if (!response.ok) return [];

    const manifest = await response.json();
    const files = Object.values(manifest.files || {});
    const entrypoints = manifest.entrypoints || [];
    const paths = [...files, ...entrypoints]
      .filter(Boolean)
      .map((path) => (path.startsWith("http") ? path : `${self.location.origin}${path}`));

    return Array.from(new Set(paths));
  } catch {
    return [];
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cacheUrls(cache, shellUrls);
        await cacheUrls(cache, await getBuildAssetUrls());
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname === `${basePath}/version.json`) {
    event.respondWith(
      fetch(new Request(request.url, { cache: "no-store", credentials: "same-origin" }))
        .then((response) => response)
        .catch(() => caches.match(`${baseUrl}/version.json`))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(`${baseUrl}/index.html`, copy));
          return response;
        })
        .catch(() => caches.match(`${baseUrl}/index.html`))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(`${baseUrl}/index.html`));
    })
  );
});
