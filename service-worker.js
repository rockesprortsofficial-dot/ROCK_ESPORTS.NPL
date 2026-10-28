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
      const insertBeforeBodyClose = (source, snippet) => {
        const index = source.toLowerCase().lastIndexOf("</body>");
        return index < 0 ? source + snippet : source.slice(0, index) + snippet + source.slice(index);
      };
      html = html.replaceAll('rock-community-feed.js', 'rock-community-feed-v2.js?media=privacy-mobile-20261029');
      for (const file of ['meeting-room-chat.js', 'meeting-room-guest.js', 'rock-community-feed-v2.js', 'rock-connect.js']) {
        if (!html.includes(file)) {
          const scriptUrl = new URL(file === 'rock-community-feed-v2.js' ? file + '?media=privacy-mobile-20261029' : file, self.registration.scope).href;
          const script = '<script src="' + scriptUrl + '" defer><\/script>';
          html = insertBeforeBodyClose(html, script);
        }
      }
      if (!html.includes("rock-admin-icon-fix")) {
        const adminFix = '<script>/* rock-admin-icon-fix */(function(){function moveAdmin(){var nav=document.querySelector(".nav-inner"),button=nav&&nav.querySelector("#adminNavButton");if(!nav||!button)return;button.textContent="🔐";button.setAttribute("aria-label","ADMIN / EDIT");button.title="ADMIN / EDIT";button.classList.add("rock-admin-icon");if(nav.lastElementChild!==button)nav.append(button)}var style=document.createElement("style");style.textContent="#adminNavButton.rock-admin-icon{display:inline-flex!important;align-items:center;justify-content:center;width:28px!important;height:28px!important;min-width:28px!important;box-sizing:border-box;padding:0!important;margin-left:4px;font-size:13px!important;line-height:1;border-radius:50%;opacity:.68;flex:0 0 28px}#adminNavButton.rock-admin-icon:hover,#adminNavButton.rock-admin-icon:focus-visible{opacity:1}";document.head.appendChild(style);moveAdmin();var nav=document.querySelector(".nav-inner");if(nav)new MutationObserver(moveAdmin).observe(nav,{childList:true})})();<\/script>';
        html = insertBeforeBodyClose(html, adminFix);
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

