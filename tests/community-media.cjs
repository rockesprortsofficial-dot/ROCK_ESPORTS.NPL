const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('rock-community-feed.js', 'utf8');
assert.equal(source, fs.readFileSync('rock-community-feed-v2.js', 'utf8'));
const helper = source.slice(source.indexOf('  function attachPostMedia('), source.indexOf('  function uploadDirect('));
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(type = 'image', path = 'b2:example') {
  const listeners = {};
  const retry = {addEventListener(name, fn) { this[name] = fn; }};
  const media = {
    isConnected:true, hidden:false, loads:0,
    after(button) { assert.equal(button, retry); },
    addEventListener(name, fn) { listeners[name] = fn; },
    load() { this.loads++; },
  };
  let calls = 0, fail = true, playback = 0, resolveLink;
  const cache = new Map([['post', {url:'old'}]]);
  const timers = [];
  const context = vm.createContext({
    document:{createElement:()=>retry}, t:value=>value, mediaLinks:cache,
    privateMediaUrl:async()=>{ calls++; if (fail) throw Error('service unavailable'); return resolveLink ? await resolveLink : 'https://example.backblazeb2.com/new'; },
    client:{storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'https://example.test/public'}})})}},
    syncPlayback:()=>{playback++;}, window:{setTimeout:fn=>timers.push(fn)},
  });
  vm.runInContext(helper+';globalThis.attach = attachPostMedia;', context);
  context.attach({id:'post',media_path:path,media_type:type}, media);
  return {media,retry,listeners,cache,timers, start:()=>timers.shift()(), calls:()=>calls, playback:()=>playback,
    recover:()=>{fail=false;}, defer:promise=>{resolveLink=promise;}};
}
(async()=>{
  const image = setup(); image.start(); await flush();
  assert.equal(image.retry.hidden, false); assert.equal(image.media.hidden, true);
  assert.equal(image.calls(),1); // No automatic retries while storage is capped.
  image.recover(); image.retry.click(); await flush();
  assert.equal(image.cache.has('post'), false); assert.equal(image.media.src,'https://example.backblazeb2.com/new');
  image.listeners.load(); assert.equal(image.retry.hidden,true); assert.equal(image.media.hidden,false);
  image.listeners.error(); assert.equal(image.retry.hidden,false); // Later URL/download failure remains recoverable.
  image.retry.click(); await flush(); image.listeners.load(); assert.equal(image.calls(),3);
  const video = setup('video'); video.recover(); video.start(); await flush();
  assert.equal(video.media.loads,1); video.listeners.error(); assert.equal(video.retry.hidden,false);
  video.retry.click(); await flush(); video.listeners.loadeddata(); assert.equal(video.media.loads,2); assert.equal(video.playback(),1);
  const publicImage = setup('image','owner/photo.jpg'); publicImage.start(); await flush();
  assert.equal(publicImage.media.src,'https://example.test/public'); publicImage.listeners.error();
  publicImage.retry.click(); await flush(); publicImage.listeners.load(); assert.equal(publicImage.calls(),0);
  const detached = setup(); detached.media.isConnected=false; detached.start(); await flush(); assert.equal(detached.calls(),0);
  const pending = setup(); pending.recover(); let finish;
  pending.defer(new Promise(resolve=>{finish=resolve;})); pending.start();
  pending.retry.click(); assert.equal(pending.calls(),1); // Duplicate clicks cannot start parallel loads.
  pending.media.isConnected=false; finish('https://example.backblazeb2.com/new'); await flush();
  assert.equal(pending.media.src,undefined);
  console.log('PASS: signing failure, image/video download failure, repeated retries, fresh link, public storage, no retry loop, detached cards, duplicate clicks, both entry files identical.');
})().catch(error=>{console.error(error);process.exitCode=1;});
