(() => {
  'use strict';
  const hero = document.querySelector('#home .hero-content');
  if (!hero || !window.RockBroadcastStudio || document.getElementById('rock-home-live')) return;

  const modes = [
    ['tournament', 'Tournament', 'rock-broadcast-studio'],
    ['gameplay', 'Gameplay', 'rock-broadcast-social'],
    ['watchparty', 'Members Watch Party', 'rock-broadcast-social']
  ];
  const grid = document.createElement('section');
  grid.id = 'rock-home-live';
  grid.setAttribute('aria-label', 'Live broadcasts');
  grid.hidden = true;
  const styles = document.createElement('style');
  styles.textContent = `
    #rock-home-live[hidden] { display:none }
    #rock-home-live { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:12px; max-width:880px; margin:0 auto 22px }
    #rock-home-live a { display:block; width:min(100%,420px); margin:auto; overflow:hidden; color:#fff; text-decoration:none; text-align:left; border:1px solid #287dad; border-radius:12px; background:#07172b }
    #rock-home-live a:focus-visible { outline:3px solid #fff; outline-offset:3px }
    #rock-home-live video { display:block; width:100%; aspect-ratio:16/9; object-fit:contain; background:#020710 }
    #rock-home-live video[hidden] { display:none }
    #rock-home-live .rock-live-label { display:flex; align-items:center; gap:8px; padding:10px; flex-wrap:wrap }
    #rock-home-live .rock-live-badge { color:#fff; background:#a6002a; border-radius:4px; padding:3px 6px; font-size:.75em; font-weight:800 }
    #rock-home-live .rock-live-action { margin-left:auto; color:#a9e8ff; font-size:.85em }
    #rockIntroSequence > #rock-home-live { position:absolute; z-index:3; inset-block-start:max(12px,env(safe-area-inset-top)); inset-inline:12px; max-width:840px; max-height:50vh; overflow:auto; margin:0 auto }
    #rockIntroSequence #rock-home-live a { width:min(100%,280px) }
  `;
  document.head.append(styles);

  const sdkLoader = new RockBroadcastStudio({});
  const intro = document.getElementById('rockIntroSequence');
  const cards = new Map();
  let refreshing = false;
  let pageActive = true;
  const isHome = () => pageActive && !document.hidden && ['', '#home', '#rockCommunityFeed'].includes(location.hash);

  async function request(endpoint, mode, action, id) {
    const response = await fetch(SUPABASE_URL + '/functions/v1/' + endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {'Content-Type': 'application/json', apikey: SUPABASE_KEY},
      body: JSON.stringify({action, ...(mode === 'tournament' ? {} : {mode}), id}),
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw Error('Live broadcast unavailable');
    return response.json();
  }

  function remove(mode) {
    const card = cards.get(mode);
    if (!card) return;
    cards.delete(mode);
    card.link.remove();
    card.room?.disconnect().catch(() => {});
  }

  function makeCard(mode, label, id) {
    const link = document.createElement('a');
    const url = new URL(location.pathname, location.origin);
    if (mode !== 'tournament') url.searchParams.set('broadcastMode', mode);
    url.hash = 'live-broadcast';
    link.href = url;
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const broadcast = window.RockBroadcastSocial;
      event.preventDefault();
      if (intro?.classList.contains('active')) document.getElementById('rockIntroSkip')?.click();
      document.getElementById('rockAiChatClose')?.click();
      location.hash = 'live-broadcast';
      if (broadcast) broadcast.select(mode);
      else history.replaceState(history.state, '', url);
    });
    const video = document.createElement('video');
    video.autoplay = video.defaultMuted = video.muted = video.playsInline = true;
    video.hidden = true;
    video.setAttribute('aria-hidden', 'true');
    link.innerHTML = '<span class="rock-live-label"><span class="rock-live-badge">LIVE</span><strong></strong><span class="rock-live-action">Watch live &#8594;</span></span>';
    link.querySelector('strong').textContent = label;
    link.prepend(video);
    grid.append(link);
    const card = {id, link, video, room: null, connecting: false};
    cards.set(mode, card);
    return card;
  }

  async function connectPreview(mode, endpoint, card) {
    if (card.connecting || card.room) return;
    card.connecting = true;
    let room;
    const current = () => isHome() && cards.get(mode) === card;
    try {
      const token = await request(endpoint, mode, 'viewer-token', card.id);
      if (!current()) return;
      const sdk = await sdkLoader.sdk();
      if (!current()) return;
      room = new sdk.Room({adaptiveStream: true, disconnectOnPageLeave: true});
      card.room = room;
      const subscribe = publication => {
        if (publication.kind === 'video') publication.setSubscribed(true);
      };
      room.on(sdk.RoomEvent.TrackPublished, subscribe);
      room.on(sdk.RoomEvent.TrackSubscribed, track => {
        if (!current() || track.kind !== 'video') return;
        card.video.hidden = false;
        track.attach(card.video);
        card.video.play().catch(() => {});
      });
      room.on(sdk.RoomEvent.TrackUnsubscribed, track => {
        if (track.kind !== 'video') return;
        track.detach(card.video);
        card.video.hidden = true;
      });
      room.on(sdk.RoomEvent.Disconnected, () => {
        if (card.room !== room) return;
        card.room = null;
        card.video.hidden = true;
        card.video.srcObject = null;
      });
      await room.connect(token.server_url, token.token, {autoSubscribe: false});
      if (!current()) {
        await room.disconnect();
        return;
      }
      for (const participant of room.remoteParticipants.values()) {
        participant.trackPublications.forEach(subscribe);
      }
    } catch (_) {
      if (card.room === room) card.room = null;
      if (room) await room.disconnect().catch(() => {});
    } finally {
      card.connecting = false;
    }
  }

  async function refresh() {
    if (!isHome()) {
      for (const mode of cards.keys()) remove(mode);
      grid.hidden = true;
      return;
    }
    const landing = location.hash === '#home' ? hero : document.querySelector('#rockCommunityFeed > .container') || hero;
    const mount = intro?.classList.contains('active') ? intro : landing;
    if (grid.parentNode !== mount) mount.prepend(grid);
    if (refreshing) return;
    refreshing = true;
    try {
      await Promise.allSettled(modes.map(async ([mode, label, endpoint]) => {
        const {id, live} = await request(endpoint, mode, 'status');
        if (!isHome()) return;
        if (cards.get(mode)?.id !== id || !live) remove(mode);
        if (live && id) connectPreview(mode, endpoint, cards.get(mode) || makeCard(mode, label, id));
        grid.hidden = cards.size === 0;
      }));
    } finally {
      refreshing = false;
    }
  }

  window.addEventListener('hashchange', refresh);
  if (intro) new MutationObserver(refresh).observe(intro, {attributes:true, attributeFilter:['class']});
  window.addEventListener('rock-navigation-updated', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', () => { pageActive = true; refresh(); });
  window.addEventListener('pagehide', () => { pageActive = false; refresh(); });
  setInterval(refresh, 15000);
  refresh();
})();
