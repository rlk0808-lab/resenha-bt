const CACHE_NAME = 'resenha-bt-v1'
 
self.addEventListener('install', (e) => {
  self.skipWaiting()
})
 
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
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
 