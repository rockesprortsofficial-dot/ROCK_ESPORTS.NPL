const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const base = 'https://rock.test/ROCK_ESPORTS.NPL/';
    const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    page.setDefaultTimeout(10000);
    await page.route(base + '**', route => route.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width, initial-scale=1"><style>#rockIntroSequence{display:none}#rockIntroSequence.active{display:block;position:fixed;inset:0;background:#001;z-index:10}</style><section id="home" hidden><div class="hero-content"><h1>ROCK ESPORTS</h1></div></section><section id="rockCommunityFeed"><div class="container"><h2>Community</h2></div></section><div id="rockIntroSequence"><button id="rockIntroSkip">Skip intro</button></div>'
    }));
    await page.goto(base);
    await page.evaluate(() => {
      window.SUPABASE_URL = 'https://broadcast.test';
      window.SUPABASE_KEY = 'test-publishable';
      window.liveModes = [];
      window.disconnected = 0;
      window.requests = [];
      window.fetch = async (url, options) => {
        const {action, mode = 'tournament', id} = JSON.parse(options.body);
        window.requests.push([action, mode, id]);
        return {ok: true, json: async () => action === 'status'
          ? {id: mode + '-session', live: window.liveModes.includes(mode)}
          : {server_url: 'wss://broadcast.test', token: mode}};
      };
      window.RockBroadcastStudio = class {
        async sdk() {
          return {
            RoomEvent: {TrackPublished: 'published', TrackSubscribed: 'subscribed', TrackUnsubscribed: 'unsubscribed', Disconnected: 'disconnected'},
            Room: class {
              events = {};
              remoteParticipants = new Map();
              on(event, callback) { this.events[event] = callback; }
              async connect(url, token, options) {
                if (!options.autoSubscribe) window.manualSubscriptions = true;
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                this.stream = canvas.captureStream(15);
                const ctx = canvas.getContext('2d');
                this.draw = setInterval(() => ctx.fillRect(0, 0, 320, 180), 50);
                const videoTrack = {kind: 'video', attach: video => { video.srcObject = this.stream; }};
                const video = {kind: 'video', setSubscribed: () => this.events.subscribed(videoTrack)};
                const audio = {kind: 'audio', setSubscribed: () => { window.audioSubscribed = true; }};
                this.remoteParticipants.set(token, {trackPublications: new Map([['video', video], ['audio', audio]])});
              }
              async disconnect() {
                clearInterval(this.draw);
                this.stream?.getTracks().forEach(track => track.stop());
                window.disconnected++;
                this.events.disconnected();
              }
            }
          };
        }
      };
    });
    await page.addScriptTag({path: path.join(__dirname, '..', 'rock-home-live.js')});
    const grid = page.locator('#rock-home-live');
    assert.equal(await grid.evaluate(element => element.closest('section[id="rockCommunityFeed"]').id), 'rockCommunityFeed');
    assert.equal(await grid.isHidden(), true);
    await page.evaluate(() => {
      window.liveModes = ['tournament', 'gameplay', 'watchparty'];
      window.dispatchEvent(new Event('hashchange'));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('#rock-home-live video')].filter(video => video.videoWidth === 320 && video.muted).length === 3);
    const links = await grid.locator('a').evaluateAll(links => links.map(link => link.href));
    assert.deepEqual(links, [base + '#live-broadcast', base + '?broadcastMode=gameplay#live-broadcast', base + '?broadcastMode=watchparty#live-broadcast']);
    assert.equal(await page.evaluate(() => window.audioSubscribed), undefined);
    assert.equal(await page.evaluate(() => window.manualSubscriptions), true);
    await grid.getByRole('link', {name: /Tournament/}).click();
    await page.waitForURL(base + '#live-broadcast');
    await page.waitForFunction(() => window.disconnected === 3);
    assert.equal(await grid.isHidden(), true);
    await page.evaluate(() => {
      window.liveModes = ['gameplay'];
      const intro = document.getElementById('rockIntroSequence');
      intro.classList.add('active');
      document.getElementById('rockIntroSkip').onclick = () => intro.classList.remove('active');
      window.RockBroadcastSocial = {select(mode) { window.selectedMode = mode; }};
      location.hash = 'rockCommunityFeed';
    });
    await page.locator('#rockIntroSequence').getByRole('link', {name: /Gameplay/}).click();
    await page.waitForURL(base + '#live-broadcast');
    assert.equal(await page.evaluate(() => window.selectedMode), 'gameplay');
    assert.equal(await page.locator('#rockIntroSequence').isHidden(), true);
    await page.evaluate(() => { delete window.RockBroadcastSocial; });
    await page.evaluate(() => { window.liveModes = ['watchparty']; document.getElementById('home').hidden = false; location.hash = 'home'; });
    await page.waitForFunction(() => document.querySelector('#home #rock-home-live'));
    await grid.getByRole('link', {name: /Members Watch Party/}).click();
    await page.waitForURL(base + '?broadcastMode=watchparty#live-broadcast');
    console.log('PASS: offline homepage, three muted previews, preview cleanup, live navigation from welcome and Watch Party URL.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
