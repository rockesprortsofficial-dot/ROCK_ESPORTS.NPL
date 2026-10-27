self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !type.includes('text/html')) return response;
      let html = await response.text();
      for (const file of ['meeting-room-chat.js', 'meeting-room-guest.js', 'rock-community-feed.js']) {
        if (!html.includes(file)) {
          const scriptUrl = new URL(file, self.registration.scope).href;
          const script = '<script src="' + scriptUrl + '" defer><\/script>';
          if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, script + '</body>');
          else html += script;
        }
      }
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('transfer-encoding');
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    } catch (_) {
      return fetch(event.request);
    }
  })());
});

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

