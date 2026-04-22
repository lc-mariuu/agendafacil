/**
 * sw.js — Service Worker corrigido
 * Remove o cache de arquivos inexistentes (painel.css, painel-premium.css,
 * painel-light-fix.css) que causavam os erros de FetchEvent no console.
 */

const CACHE = 'agendorapido-v3';

// Apenas arquivos que realmente existem no servidor
const PRECACHE = [
  '/',
  '/index.html',
  '/painel.html',
  '/painel.js',
  '/pagamentos-fix.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Usa allSettled para não falhar se um arquivo não existir
      return Promise.allSettled(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] Não cacheado:', url, err.message);
          });
        })
      );
    })
  );
});

// ── Activate — limpa caches antigos ──────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k)   { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Fetch — network-first, fallback para cache ────────────────────────────────
self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Ignora não-GET e extensões do browser
  if (req.method !== 'GET') return;
  if (req.url.startsWith('chrome-extension://')) return;
  if (req.url.startsWith('moz-extension://')) return;

  // Rotas de API: sempre vai para a rede, sem cache
  if (req.url.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(function () {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Demais recursos: network-first com fallback para cache
  event.respondWith(
    fetch(req)
      .then(function (res) {
        // Cacheia apenas respostas básicas e bem-sucedidas
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, clone);
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req);
      })
  );
});