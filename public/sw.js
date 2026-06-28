const CACHE_NAME = 'resenha-bt-v2'
const CACHE_STATIC = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_STATIC))
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  // Ignora requisições não-GET e Supabase
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('supabase.co')) return
  if (e.request.url.includes('push.apple.com')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Armazena no cache se for bem sucedido
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline: retorna do cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached
          // Se for navegação, retorna o index.html
          if (e.request.mode === 'navigate') return caches.match('/index.html')
        })
      })
  )
})

self.addEventListener('push', (e) => {
  if (!e.data) return
  const data = e.data.json()
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: data.actions || [],
  }
  e.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(clients.matchAll({ type: 'window' }).then((clientList) => {
    for (const client of clientList) {
      if (client.url === url && 'focus' in client) return client.focus()
    }
    if (clients.openWindow) return clients.openWindow(url)
  }))
})