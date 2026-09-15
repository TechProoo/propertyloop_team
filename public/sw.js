/*
 * PropertyLoop Team — service worker.
 *
 * Notifications only. There is deliberately no fetch handler and nothing is
 * cached: the portal deploys often, and a cached copy is how staff end up
 * looking at yesterday's deals. The browser loads every page from the network
 * exactly as it would without this file.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'PropertyLoop Team', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      // A newer message in the same conversation still buzzes.
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        // Navigating reloads the portal, so it shows the thing the
        // notification was about rather than what was loaded this morning.
        try {
          if ('navigate' in client) await client.navigate(target)
        } catch {
          await self.clients.openWindow(target)
        }
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
