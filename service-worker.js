const ROCK_APP_CACHE='rock-esports-pwa-shell-v1';
const ROCK_APP_SHELL=['offline.html','manifest.webmanifest','assets/icons/rock-192.png','assets/icons/rock-512.png','assets/icons/rock-180.png','assets/icons/rock-maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{try{const cache=await caches.open(ROCK_APP_CACHE);await cache.addAll(ROCK_APP_SHELL.map(file=>new URL(file,self.registration.scope).href));}catch(_){}await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('rock-esports-pwa-shell-')&&key!==ROCK_APP_CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch', (event) => {
  const requested=new URL(event.request.url);const shell=new Set(ROCK_APP_SHELL.map(file=>new URL(file,self.registration.scope).href));const clean=new URL(requested);clean.search='';
  if(event.request.method==='GET'&&shell.has(clean.href)){event.respondWith(fetch(event.request).catch(async()=>await caches.match(clean.href)||Response.error()));return;}
  if (event.request.mode !== 'navigate' || requested.origin !== self.location.origin) return;
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
      html = html.replaceAll('rock-community-feed.js', 'rock-community-feed-v2.js?media=meeting100-20261029');
      for (const file of ['meeting-room-chat.js', 'meeting-room-guest.js', 'rock-community-feed-v2.js', 'rock-connect.js', 'rock-meeting-100.js']) {
        if (!html.includes(file)) {
          const scriptUrl = new URL(file === 'rock-community-feed-v2.js' ? file + '?media=meeting100-20261029' : file === 'rock-connect.js' ? file + '?connect=bilingual-20261029' : file === 'rock-meeting-100.js' ? file + '?meeting=20261029a' : file, self.registration.scope).href;
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
      const offline=await caches.match(new URL('offline.html',self.registration.scope).href);return offline||new Response('<h1>ROCK ESPORTS</h1><p>Offline. Connect to the internet and retry.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
  })());
});

// Only the small public App shell is cached. Backend/auth/media requests pass through uncached.
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?event.data.json():{};}catch(_){}
 const allowed=new Set(['home','about','management','members','statements','contact','tournament','registration','group-division','tdm-group-division','live-draw','connect','jersey-preview','meeting','rock-meeting-room','notifications']);
 const audience=payload?.data?.audience==='members'?'members':'public';const section=audience==='members'?'rock-meeting-room':allowed.has(payload?.data?.section)?payload.data.section:'notifications';
 const isCall=audience==='members'&&payload?.data?.kind==='call'&&/^[0-9a-f-]{36}$/i.test(payload?.data?.call_id||'');const expired=isCall&&Date.parse(payload.data.expires_at)<=Date.now();
 const deviceTest=payload?.data?.kind==='device-test'&&/^[0-9a-f-]{36}$/i.test(payload?.data?.test_id||'')?payload.data.test_id:null;
 const notice=String(payload?.data?.notice_id||'');const id=/^[0-9a-f-]{36}$/i.test(notice)?notice:'';
 event.waitUntil(self.registration.showNotification(String(expired?'ROCK ESPORTS • Missed call / छुटेको कल':payload.title||'ROCK ESPORTS').slice(0,120),{body:String(payload.body||'A new update is available.').slice(0,1200),icon:new URL('assets/icons/rock-192.png',self.registration.scope).href,tag:deviceTest?'rock-device-test-'+deviceTest:isCall?'rock-call-'+payload.data.call_id:'rock-app-'+audience+'-'+(id||section),renotify:!expired,silent:!!expired,...(isCall?{actions:[{action:'open-call',title:'Open call / कल खोल्नुहोस्'}]}:{}),data:{audience,section,notice_id:id,...(deviceTest?{kind:'device-test',test_id:deviceTest}:{}),...(isCall?{kind:'call',call_id:payload.data.call_id,expires_at:payload.data.expires_at}:{})}}).then(async()=>{if(deviceTest){const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){const u=new URL(client.url),scope=new URL(self.registration.scope);if(u.origin===scope.origin&&u.pathname.startsWith(scope.pathname))client.postMessage({type:'ROCK_DEVICE_TEST_RECEIVED',test_id:deviceTest});}}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const data=event.notification.data||{};const destination=new URL('./',self.registration.scope);destination.hash=data.audience==='members'?'rock-meeting-room':data.section||'notifications';const callId=data.kind==='call'&&/^[0-9a-f-]{36}$/i.test(data.call_id||'')?data.call_id:null;if(callId)destination.searchParams.set('call',callId);else if(data.audience==='members'&&data.notice_id)destination.searchParams.set('notice',data.notice_id);
 event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){const current=new URL(client.url),scope=new URL(self.registration.scope);if(current.origin===scope.origin&&current.pathname.startsWith(scope.pathname)){await client.focus();client.postMessage({type:data.kind==='device-test'?'ROCK_DEVICE_TEST_OPEN':callId?'ROCK_CALL_OPEN':'ROCK_NOTICE_OPEN',...data});return;}}return clients.openWindow(destination.href);})());
});
