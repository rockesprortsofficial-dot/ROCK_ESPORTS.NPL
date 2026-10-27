self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const section = String(payload?.data?.section || 'notifications');
  const allowed = new Set(['home','about','management','members','statements','contact','tournament','registration','group-division','tdm-group-division','live-draw','connect','jersey-preview','meeting','rock-meeting-room','notifications']);
  const target = allowed.has(section) ? section : 'notifications';
  const destination = new URL('./#' + target, self.registration.scope).href;
  event.waitUntil(self.registration.showNotification(String(payload.title || 'ROCK ESPORTS'), {
    body: String(payload.body || 'A new update is available.'),
    data: { url: destination },
    tag: 'rock-esports-' + target,
    renotify: true
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || new URL('./#notifications', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return clients.openWindow(destination);
  })());
});
