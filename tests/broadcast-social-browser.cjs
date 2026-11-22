const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1680,height:1100}}),errors=[],requests=[],sessions={};page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({body:'',contentType:'application/javascript'}));
await page.route('https://social.test/**',async route=>{const b=route.request().postDataJSON();requests.push(b);let row=sessions[b.mode],result={ok:true};if(b.action==='create'){row=sessions[b.mode]={id:b.mode==='gameplay'?'11111111-1111-1111-1111-111111111111':'22222222-2222-2222-2222-222222222222',live:false,join_open:true};result={...row,password:'a'.repeat(48)};}else if(b.action==='status')result=row?{...row,viewers:3}:{id:null,live:false};else if(b.action==='engagement'){
 const feed=row.feed??={likes:0,comment_count:0,liked:false,comments:[]};
 if(b.operation==='like'){feed.likes=1;feed.liked=true;}
 if(b.operation==='comment'){feed.comments.push({id:1,name:b.name,message:b.message,state:'visible'});feed.comment_count=1;}
 result=feed;
}else if(b.action.endsWith('-token'))result={id:row.id,identity:b.action==='member-token'?'member-33333333-3333-3333-3333-333333333333':b.action==='viewer-token'?'viewer':b.action==='cohost-token'?'cohost':'owner',name:'Verified Member',token:b.action,renew_token:'ticket',server_url:'wss://social.test'};else if(b.action==='live'){row.live=true;}else if(b.action==='pause'){row.live=false;}return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(result)});});
await page.goto((process.env.BROADCAST_TEST_URL||'http://127.0.0.1:55361')+'/offline.html');await page.setContent('<link rel="stylesheet" href="/rock-live-broadcast.css"><link rel="stylesheet" href="/rock-broadcast-social.css"><nav class="nav-inner"><a href="#existing">EXISTING</a></nav><section id="group-division"></section>');
await page.evaluate(()=>{location.hash='live-broadcast';window.SUPABASE_URL='https://social.test';window.SUPABASE_KEY='test';window.testOwner=true;window.testMember=null;window.rockGetMemberSession=async()=>window.testMember;window.auths=[];window.__rooms=[];window.feedListeners=new Set();
window.sb={
 channel:()=>({on(event,filter,fn){this.handler=fn;this.filter=filter;return this;},subscribe(fn){window.feedListeners.add(this);fn('SUBSCRIBED');return this;}}),
 removeChannel:async channel=>window.feedListeners.delete(channel),
 auth:{getSession:async()=>({data:{session:window.testOwner?{user:{email:'rockesprorts.official@gmail.com'},access_token:'owner'}:null}}),onAuthStateChange:fn=>window.auths.push(fn)},from:()=>{const q=new Proxy({},{get:(_,k)=>k==='then'?resolve=>resolve({data:null}):()=>q});return q;}};
class Room{constructor(){this.handlers={};this.remoteParticipants=new Map();this.localParticipant={identity:'local',publishTrack:async(track,options)=>{window.lastPublishOptions??=[];window.lastPublishOptions.push(options);},unpublishTrack:async()=>{}};window.__rooms.push(this);}on(k,fn){this.handlers[k]=fn;return this;}async connect(url,token){this.token=token;this.state='connected';}async startAudio(){}async disconnect(){this.state='disconnected';}}
window.LivekitClient={Room,RoomEvent:{RoomMetadataChanged:'room-metadata',TrackSubscribed:'track',TrackUnsubscribed:'untrack',Disconnected:'disconnected',Reconnecting:'reconnecting',Reconnected:'reconnected',ParticipantConnected:'person',ParticipantDisconnected:'left'},Track:{Source:{Camera:'camera',Microphone:'microphone',ScreenShare:'screen',ScreenShareAudio:'screen-audio'}}};
const c=new AudioContext(),o=c.createOscillator(),audio=c.createMediaStreamDestination();o.connect(audio);o.start();window.testAudio=c;const makeVideo=()=>{const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const x=canvas.getContext('2d');x.fillStyle='#123960';x.fillRect(0,0,1920,1080);x.fillStyle='#73d7ff';x.font='70px Arial';x.fillText('SYNTHETIC GAME / VIDEO TEST',250,500);return canvas.captureStream(30);};navigator.mediaDevices.getDisplayMedia=async()=>{const s=makeVideo();s.addTrack(audio.stream.getAudioTracks()[0].clone());return s;};navigator.mediaDevices.getUserMedia=async constraints=>{window.lastMediaRequest=constraints;return new MediaStream([...(constraints.video?makeVideo().getVideoTracks():[]),...(constraints.audio?[audio.stream.getAudioTracks()[0].clone()]:[])]);};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'usb',label:'USB Camera'},{kind:'audioinput',deviceId:'mic',label:'Headset Microphone'}];});
for(const file of ['rock-broadcast-core.js','rock-broadcast-audio.js','rock-broadcast-compositor.js','rock-broadcast-studio.js','rock-live-broadcast.js','rock-broadcast-social-layout.js','rock-broadcast-social-compositor.js','rock-gameplay-background.js','rock-broadcast-social.js'])await page.addScriptTag({url:'/'+file});await page.waitForTimeout(150);assert.equal(await page.locator('.lb-player').count(),64);assert.equal(await page.locator('.rbs-tabs button').count(),3);
await page.click('#rbs-tab-gameplay');await page.waitForSelector('#rbs-create');assert.equal(await page.locator('#lb-tournament-panel').isHidden(),true);assert.equal(await page.locator('#rbs-screen .lb-card').count(),0);await page.click('#rbs-generate-password');
assert.match(await page.locator('#rbs-owner-password').inputValue(),/^[a-f0-9]{48}$/);
assert.equal(await page.locator('#rbs-game-fit').inputValue(),'fill');
await page.locator('#rbs-game-zoom').fill('135');
assert.equal(await page.locator('#rbs-game-zoom-value').textContent(),'135%');
assert.equal(await page.locator('#rbs-game').evaluate(v=>v.style.transform),'scale(1.35)');
await page.selectOption('#rbs-game-fit','fit');
assert.equal(await page.locator('#rbs-game-zoom').isDisabled(),true);
await page.selectOption('#rbs-game-fit','fill');
assert.equal(await page.locator('#rbs-game').evaluate(v=>getComputedStyle(v).objectFit),'cover');
assert.notEqual(await page.locator('#rbs-title strong').evaluate(v=>getComputedStyle(v).animationName),'none');
await page.click('#rbs-create');await page.waitForSelector('#rbs-camera');await page.click('#rbs-camera');
await page.check('#rbs-mirror-owner');
await page.selectOption('#rbs-filter-owner','warm');
assert.equal(await page.locator('.rbs-tile video').first().evaluate(v=>getComputedStyle(v).transform),'matrix(-1, 0, 0, 1, 0, 0)');
assert.equal(await page.locator('.rbs-tile video').first().evaluate(v=>getComputedStyle(v).objectFit),'contain');
assert.match(await page.locator('.rbs-tile video').first().evaluate(v=>getComputedStyle(v).filter),/sepia/);await page.click('#rbs-mic');
await page.evaluate(()=>{window.testDisplayMedia=navigator.mediaDevices.getDisplayMedia;navigator.mediaDevices.getDisplayMedia=undefined;});
await page.click('#rbs-share');
await page.waitForFunction(()=>document.querySelector('#rbs-status').textContent.includes('mirroring window'));
await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=()=>{if(!navigator.userActivation.isActive)throw Error('Missing click activation');return window.testDisplayMedia();};});
await page.click('#rbs-share');await page.waitForFunction(()=>document.querySelector('#rbs-game').srcObject?.getVideoTracks().length===1);
await page.selectOption('#rbs-source','capture');
assert.equal(await page.locator('#rbs-capture-profile').inputValue(),'1080-30');
await page.selectOption('#rbs-capture-video','usb');
await page.selectOption('#rbs-capture-profile','720-30');
await page.click('#rbs-share');
await page.waitForFunction(()=>window.lastMediaRequest?.video?.height?.ideal===720);
assert.equal(await page.evaluate(()=>window.lastMediaRequest.video.frameRate.max),30);
await page.evaluate(()=>{
 const video=document.querySelector('#rbs-game');
 window.previousHDMI=video.srcObject.getVideoTracks()[0];
 const acquire=navigator.mediaDevices.getUserMedia;
 navigator.mediaDevices.getUserMedia=constraints=>{
  if(constraints.video?.frameRate?.ideal===60&&window.previousHDMI.readyState!=='ended')throw Error('Previous capture still open');
  return acquire(constraints);
 };
});
await page.selectOption('#rbs-capture-profile','1080-60');
await page.click('#rbs-share');
await page.waitForFunction(()=>window.lastMediaRequest?.video?.frameRate?.ideal===60);
assert.equal(await page.evaluate(()=>window.previousHDMI.readyState),'ended');
await page.selectOption('#rbs-source','screen');
assert.equal(await page.locator('#rbs-capture-profile').isHidden(),true);
await page.click('#rbs-share');
await page.waitForFunction(()=>document.querySelector('#rbs-status').textContent.includes('Gameplay video and sound connected'));

await page.evaluate(()=>{
 const room=window.__rooms.findLast(r=>r.token==='owner-token');
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(0,0,320,360);ctx.fillStyle='#0f0';ctx.fillRect(320,0,320,360);
 const mediaStreamTrack=canvas.captureStream(30).getVideoTracks()[0];
 const camera={sid:'remote-cohost-camera',kind:'video',mediaStreamTrack,detach:()=>[],attach:video=>{
  if(video.hidden)throw Error('Remote camera must be visible before attachment');
  video.srcObject=new MediaStream([mediaStreamTrack]);
 }};
 window.testRemoteCamera=camera;
 room.handlers.track(camera,{source:'camera'},{identity:'cohost',name:'Remote Co-host'});
});
const remoteVideo=page.locator('#rbs-tiles .rbs-tile').filter({hasText:'CO-HOST'}).locator('video');
await remoteVideo.waitFor({state:'visible'});
await page.evaluate(()=>{
 window.SelfieSegmentation=class{
  setOptions(){}
  onResults(fn){this.result=fn;}
  async send({image}){
   const frame=document.createElement('canvas');frame.width=image.videoWidth;frame.height=image.videoHeight;
   frame.getContext('2d').drawImage(image,0,0);
   const mask=document.createElement('canvas');mask.width=frame.width;mask.height=frame.height;
   mask.getContext('2d').fillRect(mask.width/4,0,mask.width/2,mask.height);
   this.result({image:frame,segmentationMask:mask});
  }
 };
});
await page.selectOption('#rbs-background-owner','rock');
await page.selectOption('#rbs-background-cohost','violet');
await page.waitForFunction(()=>Array.from(document.querySelectorAll('.rbs-camera-background')).filter(c=>!c.hidden).length===2);
const cohostBackground=page.locator('#rbs-tiles .rbs-camera-background').last();
const framePixels=canvas=>{
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
 return {aspect:w/h,left:pixel(Math.floor(w*.43),Math.floor(h*.5)),right:pixel(Math.floor(w*.57),Math.floor(h*.5)),edge:pixel(1,Math.floor(h*.5))};
};
const normal=await cohostBackground.evaluate(framePixels);
assert.ok(normal.aspect>3&&normal.aspect<3.2);
assert.ok(normal.left[0]>220&&normal.right[1]>220);
assert.equal(normal.edge[3],255);
assert.ok(normal.edge.slice(0,3).some(channel=>channel>10));
await page.check('#rbs-mirror-cohost');
await page.waitForFunction(()=>{
 const canvas=document.querySelectorAll('#rbs-tiles .rbs-camera-background')[1];
 return canvas.getContext('2d').getImageData(canvas.width*.43,canvas.height*.5,1,1).data[1]>220;
});
assert.equal(await page.evaluate(()=>localStorage.getItem('rock-gameplay-camera-flip-cohost')),'1');
await page.uncheck('#rbs-mirror-cohost');
await page.selectOption('#rbs-background-owner','');
assert.equal(await page.locator('.rbs-camera-background').first().isHidden(),true);
assert.equal(await page.locator('.rbs-camera-background').last().isVisible(),true);
await page.selectOption('#rbs-background-cohost','');
await page.locator('#rbs-camera-zoom-cohost').fill('85');
assert.equal(await remoteVideo.evaluate(v=>v.style.transform),'scale(0.85, 0.85)');
assert.notEqual(await page.locator('#rbs-tiles video').first().evaluate(v=>v.style.transform),'scale(0.85, 0.85)');
const clip=Buffer.from(await page.evaluate(async()=>{
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
 const ctx=canvas.getContext('2d'),stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
 const data=new Promise(resolve=>recorder.ondataavailable=resolve);
 recorder.start();
 for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#21d':'#129';ctx.fillRect(0,0,160,90);await new Promise(resolve=>setTimeout(resolve,60));}
 recorder.stop();
 try{return Array.from(new Uint8Array(await (await data).data.arrayBuffer()));}
 finally{stream.getTracks().forEach(track=>track.stop());}
}));
for(const input of await page.locator('#rbs-gameplay-options input[type=file]').all()){
 await input.setInputFiles({name:'clip.webm',mimeType:'video/webm',buffer:clip});
}
await page.waitForFunction(()=>Array.from(document.querySelectorAll('.rbs-clip video')).every(v=>v.videoWidth===160&&v.loop&&getComputedStyle(v).objectFit==='cover'),{}, {timeout:7000}).catch(async e=>{console.log(await page.locator('.rbs-clip video').evaluateAll(v=>v.map(x=>({src:x.currentSrc,w:x.videoWidth,error:x.error?.message}))),clip.length);throw e;});
await page.waitForFunction(()=>[...document.querySelectorAll('.rbs-tile')].some(tile=>tile.textContent==='CO-HOST'&&tile.querySelector('video').videoWidth===640));
await page.evaluate(()=>{
 const room=window.__rooms.findLast(r=>r.token==='owner-token');
 room.handlers.untrack(window.testRemoteCamera);
});
assert.equal(await remoteVideo.isHidden(),true);
await page.evaluate(()=>{
 const room=window.__rooms.findLast(r=>r.token==='owner-token');
 room.handlers.track(window.testRemoteCamera,{source:'camera'},{identity:'cohost',name:'Remote Co-host'});
});
await remoteVideo.waitFor({state:'visible'});
const proportions=await page.evaluate(()=>{const s=document.querySelector('#rbs-screen').getBoundingClientRect(),g=document.querySelector('.rbs-shared').getBoundingClientRect(),t=document.querySelector('.rbs-tile').getBoundingClientRect();return {fraction:g.height/s.height,noOverlap:g.bottom<t.top};});assert.ok(proportions.fraction>.75);assert.equal(proportions.noOverlap,true);await page.locator('#rbs-screen').screenshot({path:path.resolve(__dirname,'../../../outputs/social-gameplay-preview.png')});await page.locator('summary').filter({hasText:'YouTube / TikTok'}).click();
await page.fill('#rbs-youtube-key','MOCK_YOUTUBE_KEY');
await page.click('#rbs-save-youtube');
await page.waitForFunction(()=>document.querySelector('#rbs-status').textContent.includes('YouTube settings saved'));
assert.equal(await page.locator('#rbs-youtube-key').inputValue(),'');
assert.ok(requests.some(b=>b.action==='save-youtube'&&b.destination.server==='rtmps://a.rtmps.youtube.com/live2'));
await page.click('#rbs-platform-status');
const relayNote=page.locator('#rbs-platform-status').locator('xpath=../following-sibling::p[1]');
await relayNote.waitFor({state:'visible'});
await page.waitForFunction(()=>document.querySelector('#rbs-platform-status').parentElement.nextElementSibling.textContent.startsWith('Relay check:'));

await page.click('#rbs-website');await page.waitForFunction(()=>document.querySelector('#rbs-status').textContent.includes('Website output started'));assert.equal(requests.filter(b=>b.action==='simulcast').length,0);
assert.equal(await page.evaluate(()=>window.lastPublishOptions.find(o=>o.name==='social-composite').screenShareEncoding.maxFramerate),60);
await page.click('#rbs-tab-watchparty');await page.fill('#rbs-watchparty-password','WatchCup27');await page.click('#rbs-create');await page.waitForSelector('#rbs-camera');assert.ok(requests.some(b=>b.action==='create'&&b.mode==='watchparty'&&b.password==='WatchCup27'));
const flip=page.locator('#rbs-moderation').getByRole('button',{name:'Flip left / right'}).first();
await flip.click();
assert.equal(await page.locator('#rbs-tiles video').first().evaluate(v=>v.style.transform),'scaleX(-1)');
await flip.click();
assert.equal(await page.locator('#rbs-tiles video').first().evaluate(v=>v.style.transform),'');
await page.selectOption('#rbs-source','capture');
assert.equal(await page.locator('#rbs-capture-profile').inputValue(),'1080-60');
await page.selectOption('#rbs-capture-video','usb');
await page.selectOption('#rbs-capture-profile','1080-30');
await page.click('#rbs-share');
await page.waitForFunction(()=>window.lastMediaRequest?.video?.height?.ideal===1080&&window.lastMediaRequest.video.frameRate.ideal===30);
await page.evaluate(()=>{window.testOwner=false;window.testMember={token:'EXISTING_MEETING_ROOM_TOKEN',identity:'33333333-3333-3333-3333-333333333333'};window.auths.forEach(fn=>fn());});await page.waitForSelector('#rbs-join');assert.equal(await page.locator('#rbs-owner').isHidden(),true);await page.fill('#rbs-name','Member Alias');assert.equal(await page.locator('#rbs-cohost-login').inputValue(),'ROCK');await page.fill('#rbs-code','WatchCup27');await page.click('#rbs-join');await page.waitForSelector('#rbs-call-controls',{state:'visible'});assert.ok(requests.some(b=>b.action==='member-token'&&b.member_token==='EXISTING_MEETING_ROOM_TOKEN'));await page.evaluate(()=>{const room=window.__rooms.findLast(r=>r.token==='member-token');for(let i=0;i<13;i++){const p={identity:'member-test-'+i,name:'Member '+i};room.remoteParticipants.set(p.identity,p);room.handlers.person(p);}});await page.evaluate(()=>{const room=window.__rooms.findLast(r=>r.token==='member-token'),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d');c.fillStyle='#123960';c.fillRect(0,0,1920,1080);c.fillStyle='#73d7ff';c.font='70px Arial';c.fillText('SYNTHETIC WATCH PARTY VIDEO',220,500);const track=canvas.captureStream().getVideoTracks()[0];room.handlers.track({sid:'owner-screen',kind:'video',mediaStreamTrack:track,detach:()=>[],attach:v=>{window.__sdkAttachCount=(window.__sdkAttachCount||0)+1;v.srcObject=new MediaStream([track]);}},{source:'screen'},{identity:'owner',name:'HOST'});});assert.equal(await page.evaluate(()=>window.__sdkAttachCount),1);assert.equal(await page.locator('#rbs-tiles .rbs-tile').count(),15);const small=await page.locator('#rbs-tiles .rbs-tile').first().boundingBox();await page.locator('#rbs-screen').screenshot({path:path.resolve(__dirname,'../../../outputs/social-watchparty-15-preview.png')});await page.evaluate(()=>{const room=window.__rooms.findLast(r=>r.token==='member-token');for(let i=0;i<5;i++){const p=room.remoteParticipants.get('member-test-'+i);room.remoteParticipants.delete(p.identity);room.handlers.left(p);}});assert.equal(await page.locator('#rbs-tiles .rbs-tile').count(),10);const larger=await page.locator('#rbs-tiles .rbs-tile').first().boundingBox();assert.ok(larger.width>small.width);
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.click('#rbs-leave');await page.evaluate(()=>{window.testMember=null;dispatchEvent(new CustomEvent('rock-member-session'));});await page.waitForSelector('#rbs-private',{state:'hidden'});assert.equal(await page.locator('#rbs-entry').isHidden(),true);await page.click('#rbs-tab-tournament');assert.equal(await page.locator('.lb-player').count(),64);assert.equal(await page.locator('#lb-tournament-panel').isVisible(),true);assert.equal(await page.locator('.nav-inner a[href="#existing"]').textContent(),'EXISTING');sessions.gameplay.live=true;await page.click('#rbs-tab-gameplay');await page.waitForSelector('#rbs-view-stage',{state:'visible'});
await page.waitForSelector('#rbs-like',{state:'visible'});
assert.equal(await page.getByText('Website viewers: 3').count(),1);
await page.click('#rbs-like');
await page.waitForFunction(()=>document.querySelector('#rbs-like').getAttribute('aria-pressed')==='true');
await page.fill('#rbs-guest-name','Visitor');
await page.fill('#rbs-comment','<img src=x> test');
await page.click('#rbs-send-comment');
await page.waitForFunction(()=>document.querySelector('#rbs-comments').textContent.includes('<img src=x> test'));
assert.equal(await page.locator('#rbs-comments img').count(),0);
sessions.gameplay.feed.likes=7;
await page.evaluate(()=>window.feedListeners.forEach(channel=>channel.handler()));
await page.waitForFunction(()=>document.querySelector('#rbs-live-counts').textContent.startsWith('7 likes'));
assert.equal(await page.evaluate(()=>window.feedListeners.size),1);
await page.evaluate(()=>{const room=window.__rooms.findLast(r=>r.token==='viewer-token'),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').fillRect(0,0,640,360);const video=canvas.captureStream(30).getVideoTracks()[0],sound=window.testAudio.createMediaStreamDestination(),tone=window.testAudio.createOscillator();tone.connect(sound);tone.start();const v={sid:'output-video',kind:'video',mediaStreamTrack:video,attach:el=>{el.srcObject=new MediaStream([video]);},detach:()=>[document.querySelector('#rbs-view')]},a={sid:'output-audio',kind:'audio',mediaStreamTrack:sound.stream.getAudioTracks()[0],attach:()=>{throw Error('Viewer audio must use video controls');},detach:()=>[]};room.handlers.track(v,{source:'screen'},{identity:'output'});room.handlers.track(a,{source:'screen-audio'},{identity:'output'});});await page.waitForFunction(()=>document.querySelector('#rbs-view').srcObject?.getAudioTracks().length===1);assert.equal(await page.locator('audio[data-broadcast-audio]').count(),0);await page.click('#rbs-view-sound');assert.equal(await page.locator('#rbs-view').evaluate(v=>v.muted),false);
await page.evaluate(()=>{Object.defineProperty(document,'fullscreenEnabled',{value:false,configurable:true});});
await page.click('#rbs-view-fullscreen');
await page.setViewportSize({width:844,height:390});
assert.equal(await page.locator('#rbs-view-stage').evaluate(el=>getComputedStyle(el).position),'fixed');
assert.equal(Math.round((await page.locator('#rbs-view-stage').boundingBox()).width),844);
await page.click('#rbs-view-fullscreen');
assert.equal(await page.locator('#rbs-view-stage').evaluate(el=>el.classList.contains('rbs-view-expanded')),false);
await page.setViewportSize({width:390,height:844});
await page.click('#rbs-tab-tournament');assert.equal(await page.locator('#rbs-view').count(),1);await page.waitForFunction(()=>window.feedListeners.size===0);
await page.evaluate(()=>{document.querySelector('#lb-watch-stage').hidden=false;document.querySelector('#lb-board').hidden=true;});await page.click('#rbs-tab-gameplay');await page.click('#rbs-tab-tournament');assert.equal(await page.locator('#lb-board').isVisible(),true);assert.equal(await page.locator('#lb-watch-stage').isHidden(),true);await page.click('#rbs-tab-gameplay');
await page.waitForSelector('#rbs-open-cohost');
assert.equal(await page.locator('#rbs-code').isHidden(),true);
await page.click('#rbs-open-cohost');
assert.equal(await page.locator('#rbs-cohost-dialog').evaluate(d=>d.open),true);
await page.keyboard.press('Escape');
assert.equal(await page.locator('#rbs-cohost-dialog').evaluate(d=>d.open),false);
await page.click('#rbs-open-cohost');
assert.equal(await page.locator('#rbs-cohost-login').inputValue(),'ROCK');
assert.equal(await page.locator('#rbs-owner').isHidden(),true);
await page.fill('#rbs-code','a'.repeat(48));
await page.click('#rbs-join');
await page.waitForSelector('#rbs-call-controls',{state:'visible'});
assert.ok(requests.some(b=>b.action==='cohost-token'&&b.mode==='gameplay'&&b.login==='ROCK'&&b.id===sessions.gameplay.id));
await page.click('#rbs-av');
await page.waitForFunction(()=>document.querySelector('#rbs-status').textContent.includes('camera and microphone are on'));
assert.deepEqual(await page.evaluate(()=>window.lastPublishOptions.slice(-2).map(o=>o.source).sort()),['camera','microphone']);
const cohostVideo=page.locator('#rbs-tiles .rbs-tile').filter({hasText:'CO-HOST'}).locator('video');
await cohostVideo.waitFor({state:'visible'});
await page.evaluate(()=>{
 const room=window.__rooms.findLast(r=>r.token==='cohost-token');
 room.handlers['room-metadata'](JSON.stringify({rockCohostBackground:'rock'}));
});
const cohostPreview=page.locator('#rbs-tiles .rbs-camera-background').last();
await cohostPreview.waitFor({state:'visible'});
await page.evaluate(()=>{
 const room=window.__rooms.findLast(r=>r.token==='cohost-token');
 room.handlers['room-metadata'](JSON.stringify({rockCohostBackground:''}));
});
await cohostPreview.waitFor({state:'hidden'});
assert.equal(await cohostVideo.evaluate(v=>getComputedStyle(v).objectFit),'contain');
assert.equal(await page.locator('#rbs-cohost-dialog').evaluate(d=>d.open),false);
assert.equal(await page.locator('#rbs-tiles .rbs-tile').filter({hasText:'CO-HOST'}).evaluate(tile=>getComputedStyle(tile).getPropertyValue('--rbs-led').trim()),'#ff56ca');
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.click('#rbs-leave');
await page.click('#rbs-tab-watchparty');
assert.equal(await page.locator('#rbs-open-cohost').isHidden(),true);
assert.deepEqual(errors,[]);console.log('PASS: three inner tabs, original 16×4 preserved, large gameplay, owner source/camera/mic and website output without platforms, existing Meeting Room token reuse, 15→10 adaptive member tiles, guest read-only controls and mobile overflow. Synthetic media and mock transport.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
