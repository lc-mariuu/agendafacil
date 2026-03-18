const CACHE_NAME = 'agendorapido-v1'
const ASSETS = [
  '/',
  '/painel.html',
  '/auth.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

// Instala e faz cache dos assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// Limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Intercepta requisições — NUNCA faz cache de chamadas à API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Ignora tudo que não for http/https (ex: chrome-extension)
  if (!url.protocol.startsWith('http')) return

  // Ignora chamadas à API — sempre vai direto à rede
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) return

  // Para assets estáticos: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})