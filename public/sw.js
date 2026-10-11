// PJKT_GNS service worker: keeps the app working offline once it has been
// opened online. Pages are network-first (so updates arrive); everything
// else — hashed scripts, styles, fonts — is cache-first, since those files
// never change under the same name.

const CACHE = 'pjkt-gns-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// The app asks for the whole font library once it's idle, so type works offline too.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then(async (c) => {
      for (const url of event.data.urls) {
        if (!(await c.match(url))) await c.add(url).catch(() => undefined)
      }
    }),
  )
})
