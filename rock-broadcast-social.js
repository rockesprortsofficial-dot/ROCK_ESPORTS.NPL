/* Gameplay and members watch party are isolated from Tournament and Meeting Room calls. */
(()=>{'use strict';if(window.__rockSocialBroadcast)return;const root=document.getElementById('live-broadcast');if(!root)return;window.__rockSocialBroadcast=true;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tournament=document.createElement('div');tournament.id='lb-tournament-panel';while(root.firstChild)tournament.append(root.firstChild);root.append(tournament);
const tabs=document.createElement('div');tabs.className='rbs-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Broadcast modes');tabs.innerHTML=[['tournament','TOURNAMENT'],['gameplay','GAMEPLAY'],['watchparty','MEMBERS WATCH PARTY']].map(([id,label])=>`<button type="button" role="tab" id="rbs-tab-${id}" aria-selected="${id==='tournament'}" aria-controls="${id==='tournament'?'lb-tournament-panel':'rbs-panel'}" data-mode="${id}">${label}</button>`).join('');root.prepend(tabs);
tournament.setAttribute('role','tabpanel');tournament.setAttribute('aria-labelledby','rbs-tab-tournament');
const panel=document.createElement('div');panel.id='rbs-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.innerHTML=`<div class="rbs-screen" id="rbs-screen"><div class="rbs-title" id="rbs-title"></div><div class="rbs-shared"><span class="rbs-empty" id="rbs-empty">No website broadcast yet</span><video id="rbs-game" autoplay muted playsinline hidden></video></div><div class="rbs-logo" id="rbs-logo"><img alt="ROCK MONITORING"><span class="rbs-monitor-name"></span></div><div id="rbs-tiles"></div></div><div id="rbs-view-stage" hidden><video id="rbs-view" class="rbs-view" autoplay muted playsinline controls></video><button id="rbs-view-sound">Enable broadcast sound</button></div><div id="rbs-private" class="rbs-controls" hidden><p id="rbs-status" class="rbs-status" role="status" aria-live="polite"></p><div id="rbs-owner" hidden><div class="lb-toolbar"><button id="rbs-create">Create / reconnect this mode</button><button id="rbs-website">Start website output</button><button id="rbs-pause">Pause website output</button><button id="rbs-end">End this mode & streams</button><button id="rbs-lock">Close / reopen new entries</button></div><p class="lb-note">The call works on this website without YouTube/TikTok. Start website output to let visitors watch the composed video. Members/hosts joining consent to their display name, camera and voice appearing in website/platform output. Headphones are required for clean call audio.</p><div id="rbs-invite"></div><div class="lb-form"><label>Game/video source<select id="rbs-source"><option value="screen">App / browser tab / screen</option><option value="capture">USB / HDMI capture card</option></select></label><label>Capture video<select id="rbs-capture-video"></select></label><label>Capture sound<select id="rbs-capture-audio"></select></label></div><div class="lb-toolbar"><button id="rbs-share">Connect / replace game or video</button><button id="rbs-monitor">Game sound to headphones</button></div><details class="lb-panel"><summary>YouTube / TikTok · optional platform LIVE</summary><p class="lb-note">These controls are separate from the website call. Platform LIVE permission, RTMP destination and server egress are needed. Keys stay in this panel until submitted; the application does not save them. Changing mode clears them. Streaming can use paid server capacity.</p><div class="lb-form">${['youtube','tiktok'].map(p=>`<label><span><input type="checkbox" id="rbs-${p}-selected">${p==='youtube'?'YouTube':'TikTok'}</span>RTMP server<input id="rbs-${p}-server" type="url" autocomplete="off"></label><label>${p} stream key<input id="rbs-${p}-key" type="password" autocomplete="new-password"></label>`).join('')}</div><div class="lb-toolbar"><button id="rbs-platform-start">Start selected platforms</button><button id="rbs-platform-stop">Stop platform streams</button></div></details><h3>Call participants</h3><div id="rbs-moderation" class="rbs-moderation"></div></div><div id="rbs-entry" hidden><p class="lb-note" id="rbs-member-note">Use your existing ROCK ESPORTS Meeting Room login. Your camera/display name and voice may be broadcast. No new member account is created here.</p><label>On-screen name<input id="rbs-name" maxlength="40" autocomplete="off"></label><label id="rbs-code-label" hidden>Private co-host invitation password<input id="rbs-code" type="password" autocomplete="off"></label><button id="rbs-join">Join with Meeting Room login</button></div><div id="rbs-call-controls" hidden><div class="lb-form"><label>Camera · built-in / USB<select id="rbs-camera-device"></select></label><label>Microphone · laptop / USB / headset<select id="rbs-mic-device"></select></label></div><div class="lb-toolbar"><button id="rbs-devices">Refresh media devices</button><button id="rbs-camera">Enable / switch camera</button><button id="rbs-mic">Enable / switch microphone</button><button id="rbs-mute">Mute / unmute my mic</button><button id="rbs-hide-camera">Hide / show my camera</button><button id="rbs-sound">Enable call sound</button><button id="rbs-leave">Leave call / stop my devices</button></div><p class="lb-note">Only your selected mic is sent as your voice. Share game audio excluding this call to prevent feedback. HDMI capture does not return a laptop microphone into PUBG on an iPhone. A 3.5mm headset needs a compatible microphone/combo input.</p></div></div>`;root.append(panel);
const $=id=>panel.querySelector('#'+id),query=new URLSearchParams(location.search);let invited=!!query.get('socialCohost');
let mode='tournament',owner=false,member=null,sessionId=null,role=null,joining=false,leaving=false,switching=false,epoch=0,source=null,camera=null,ticket=null,renewalBusy=false,viewerBusy=false,viewerId=null,joinOpen=true,frameState=null;
const gameplayOptions=document.createElement('fieldset');
gameplayOptions.id='rbs-gameplay-options';
gameplayOptions.className='lb-form';
gameplayOptions.hidden=true;
gameplayOptions.innerHTML=`<legend>Gameplay setup</legend>
 <label>Co-host password<input type="password" id="rbs-owner-password" maxlength="48" autocomplete="new-password" placeholder="8 to 48 characters"></label>
 <button type="button" id="rbs-set-cohost-password" hidden>Set co-host password</button>
 <button type="button" id="rbs-generate-password">Generate co-host password</button>
 <label>Gameplay framing<select id="rbs-game-fit"><option value="fit">Fit · show the entire game</option><option value="fill" selected>Fill · crop edges</option></select></label>
 <label>Broadcast frame rate<select id="rbs-game-fps"><option value="60">60 FPS target</option><option value="30">30 FPS target</option></select></label>
 <label>Shared video zoom <output id="rbs-game-zoom-value">100%</output><input type="range" id="rbs-game-zoom" min="100" max="175" step="1" value="100"></label>
 ${['owner','cohost'].map((id,i)=>`<label>${i?'Co-host':'Host'} camera filter<select id="rbs-filter-${id}">${Object.keys(RockBroadcastSocialLayout.filters).map(f=>`<option value="${f}">${f[0].toUpperCase()+f.slice(1)}</option>`).join('')}</select></label><label><span><input type="checkbox" id="rbs-mirror-${id}"> Mirror ${i?'co-host':'host'} camera</span></label>`).join('')}`;
$('rbs-owner').prepend(gameplayOptions);
$('rbs-generate-password').onclick=()=>{
 $('rbs-owner-password').value=Array.from(crypto.getRandomValues(new Uint8Array(24)),byte=>byte.toString(16).padStart(2,'0')).join('');
};
const cohostEntry=document.createElement('button');
cohostEntry.type='button';
cohostEntry.id='rbs-open-cohost';
cohostEntry.hidden=true;
cohostEntry.textContent='Join as co-host';
cohostEntry.setAttribute('aria-controls','rbs-entry');
let cohostOpen=false;
cohostEntry.onclick=()=>{
 cohostOpen=!cohostOpen;
 renderAccess();
 if(cohostOpen)$('rbs-code').focus();
};
$('rbs-private').before(cohostEntry);
const cohostLogin=document.createElement('label');
cohostLogin.hidden=true;
cohostLogin.innerHTML='<span>Co-host ID</span><input id="rbs-cohost-login" maxlength="4" autocomplete="username" value="ROCK">';
$('rbs-code-label').before(cohostLogin);
const viewerCount=document.createElement('p');
viewerCount.hidden=true;
panel.insertBefore(viewerCount,$('rbs-private'));
const showViewers=status=>{
 if(mode!=='gameplay')return;
 viewerCount.hidden=false;
 viewerCount.textContent='Website viewers: '+(Number.isSafeInteger(status.viewers)?status.viewers:'—');
};
gameplayOptions.addEventListener('change',()=>{if(mode==='gameplay'&&owner)renderPeople();});
const engagement=document.createElement('section');
engagement.id='rbs-engagement';
engagement.className='lb-panel';
engagement.hidden=true;
engagement.innerHTML=`<h3>Live reactions</h3>
 <button type="button" id="rbs-like" aria-pressed="false">Like</button>
 <span id="rbs-live-counts"></span>
 <form id="rbs-comment-form" class="lb-form">
  <label>Display name<input id="rbs-guest-name" maxlength="32" required></label>
  <label>Comment<input id="rbs-comment" maxlength="240" required></label>
  <button id="rbs-send-comment">Submit for review</button>
 </form>
 <p id="rbs-engagement-status" role="status"></p>
 <ul id="rbs-comments"></ul>`;
viewerCount.after(engagement);

let feedId=null,feedChannel=null,feedRevision=0,guestId=null;
function visitorId(){
 if(guestId)return guestId;
 try{
  guestId=localStorage.getItem('rock-gameplay-visitor');
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(guestId||'')){
   guestId=crypto.randomUUID();
   localStorage.setItem('rock-gameplay-visitor',guestId);
  }
 }catch(_){guestId||=crypto.randomUUID();}
 return guestId;
}
function closeFeed(){
 feedId=null;feedRevision++;
 if(feedChannel)sb.removeChannel(feedChannel).catch(()=>{});
 feedChannel=null;engagement.hidden=true;
 $('rbs-comment').value='';
 $('rbs-engagement-status').textContent='';
 $('rbs-comments').replaceChildren();
}
async function refreshFeed(){
 if(!feedId||mode!=='gameplay')return;
 const revision=++feedRevision,id=feedId;
 try{
  const data=await api('engagement',{id,operation:'read',visitor:visitorId(),moderator:owner});
  if(revision!==feedRevision||id!==feedId)return;
  if(!Array.isArray(data.comments))throw Error('Live reactions unavailable');
  engagement.hidden=false;
  $('rbs-live-counts').textContent=data.likes+' likes · '+data.comment_count+' comments';
  $('rbs-like').setAttribute('aria-pressed',String(data.liked));
  const list=$('rbs-comments');
  list.replaceChildren(...data.comments.map(comment=>{
   const row=document.createElement('li');
   row.textContent=comment.name+': '+comment.message+(comment.state==='pending'?' (pending)':'');
   if(owner){
    for(const operation of comment.state==='pending'?['approve','hide','block']:['hide','block']){
     const button=document.createElement('button');
     button.type='button';button.textContent=operation[0].toUpperCase()+operation.slice(1);
     button.onclick=()=>sendReaction(button,operation,{event:comment.id});
     row.append(' ',button);
    }
   }
   return row;
  }));
 }catch(_){if(revision===feedRevision)engagement.hidden=true;}
}
function syncFeed(status){
 if(mode!=='gameplay')return;
 const id=status.live?status.id:null;
 if(id!==feedId){
  closeFeed();feedId=id;
  if(id&&typeof sb.channel==='function'){
   feedChannel=sb.channel('rock-gameplay-feed-'+id).on('postgres_changes',{
    event:'*',schema:'public',table:'rock_gameplay_feed',filter:'session_id=eq.'+id
   },refreshFeed).subscribe(state=>{if(state==='SUBSCRIBED')refreshFeed();});
  }
 }
 if(id)refreshFeed();
}
async function sendReaction(button,operation,fields={}){
 if(!feedId||mode!=='gameplay'||button.disabled)return;
 const id=feedId;
 button.disabled=true;
 try{
  await api('engagement',{id,operation,visitor:visitorId(),...fields});
  if(id!==feedId)return;
  if(operation==='comment')$('rbs-comment').value='';
  $('rbs-engagement-status').textContent=operation==='comment'?'Comment sent for owner review.':'';
  await refreshFeed();
 }catch(e){if(id===feedId)$('rbs-engagement-status').textContent=e.message;}
 finally{button.disabled=false;}
}
$('rbs-like').onclick=()=>sendReaction($('rbs-like'),'like');
$('rbs-comment-form').onsubmit=event=>{
 event.preventDefault();
 sendReaction($('rbs-send-comment'),'comment',{name:$('rbs-guest-name').value,message:$('rbs-comment').value});
};
$('rbs-game-zoom').oninput=()=>{if(mode==='gameplay'&&owner)renderPeople();};
const people=new Map(),videoNodes=new Map(),audio=new RockBroadcastAudio();
const say=(text,bad=false)=>{$('rbs-status').textContent=text;$('rbs-status').classList.toggle('lb-danger',bad);};
async function api(action,body={}){const requestMode=mode;const {data:{session}}=await sb.auth.getSession();const response=await fetch(SUPABASE_URL+'/functions/v1/rock-broadcast-social',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({action,mode:requestMode,...body})});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Broadcast call unavailable');return data;}
let joinResponse=null;
const studio=new RockBroadcastSocialStudio({audio,api:(action,b)=>action==='cohost-token'&&joinResponse?Promise.resolve(joinResponse):api(action,b),onState:value=>{if(mode==='tournament')return;say('CALL · '+value);if(value==='disconnected'&&!joining&&!leaving&&role)setTimeout(()=>leave().catch(()=>{}),0);},onTrack:(track,pub,p,added)=>{
 const S=window.LivekitClient.Track.Source;if(track.kind==='audio'&&role==='owner')audio.setRemote(track.sid,added?track.mediaStreamTrack:null).catch(()=>{});
 if(pub.source===S.ScreenShare&&track.kind==='video'){const v=$('rbs-game');v.srcObject=added?new MediaStream([track.mediaStreamTrack]):null;if(added&&track.attach)track.attach(v);v.hidden=!added;$('rbs-empty').hidden=added;return;}
 if(track.kind==='video'){ensurePerson(p.identity,p.name||'Member');const v=videoNodes.get(p.identity);v.srcObject=added?new MediaStream([track.mediaStreamTrack]):null;if(added&&track.attach)track.attach(v);v.hidden=!added;v.parentElement.dataset.empty=String(!added);}
 }});
let viewerVideo=null,viewerAudio=null;const viewer=new RockBroadcastSocialStudio({audio:null,api,onState:()=>{},onTrack:(track,pub,p,added)=>{if(track.kind==='video'){viewerVideo=added?track.mediaStreamTrack:null;if(added&&track.attach)track.attach($('rbs-view'));}if(track.kind==='audio'){track.detach().forEach(el=>el.remove());viewerAudio=added?track.mediaStreamTrack:null;}const tracks=[viewerVideo,viewerAudio].filter(Boolean);$('rbs-view').srcObject=tracks.length?new MediaStream(tracks):null;}});
function branding(){return window.RockTournamentBroadcast?.branding()||RockBroadcastCore.blank().branding;}
function ensurePerson(id,label){if(people.has(id)){people.get(id).label=label;return;}people.set(id,{id,label});const figure=document.createElement('figure');figure.className='rbs-tile';figure.dataset.empty='true';const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=true;v.hidden=true;const caption=document.createElement('figcaption');figure.append(v,caption);$('rbs-tiles').append(figure);videoNodes.set(id,v);renderPeople();}
function ordered(){return [...people.values()].sort((a,b)=>(a.id==='owner'?-2:a.id==='cohost'?-1:0)-(b.id==='owner'?-2:b.id==='cohost'?-1:0)||a.id.localeCompare(b.id));}
function position(el,r){el.style.left=r[0]/19.2+'%';el.style.top=r[1]/10.8+'%';el.style.width=r[2]/19.2+'%';el.style.height=r[3]/10.8+'%';}
function renderPeople(){const list=ordered(),display=mode==='gameplay'?[{id:'owner',label:'HOST'},{id:'cohost',label:'CO-HOST'}]:list.length?list:[{id:'owner',label:'HOST'}];for(const p of display)if(!people.has(p.id)){people.set(p.id,p);const fig=document.createElement('figure');fig.className='rbs-tile';fig.dataset.empty='true';const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.hidden=true;fig.append(v,document.createElement('figcaption'));$('rbs-tiles').append(fig);videoNodes.set(p.id,v);}
 const actual=mode==='gameplay'?display:ordered(),geo=RockBroadcastSocialLayout.layout(actual.length,mode);actual.forEach((p,i)=>{const v=videoNodes.get(p.id);position(v.parentElement,geo.tiles[i]);v.parentElement.querySelector('figcaption').textContent=p.label;v.parentElement.querySelector('figcaption').style.fontSize=Math.min(16,Math.max(5,geo.tiles[i][3]*.18))/19.2+'vw';});const [x,y,d]=geo.logo;position($('rbs-logo'),[x-d/2,y-d/2,d,d]);const brand=branding();$('rbs-logo').querySelector('img').src=brand.monitorLogo||'assets/icons/rock-192.png';$('rbs-logo').querySelector('span').textContent=brand.monitorName||'ROCK MONITORING';const title=$('rbs-title'),brandName=brand.headerName||'ROCK ESPORTS';
 if(title.dataset.brand!==brandName||title.dataset.mode!==mode){
 title.dataset.brand=brandName;title.dataset.mode=mode;
 title.innerHTML=E(brandName)+' · <span style="color:'+(mode==='gameplay'?'#12eaff':'#ff23b4')+'">'+(mode==='gameplay'?'GAMEPLAY':'MEMBERS WATCH PARTY')+'</span>';
 if(mode==='gameplay'){const text=document.createElement('strong');text.append(...title.childNodes);title.append(text);}
 }
 const gameplay=mode==='gameplay';
 panel.dataset.mode=mode;
 gameplayOptions.hidden=!gameplay;
 frameState={mode,branding:brand,people:actual};
 if(gameplay){
  frameState.gameFit=$('rbs-game-fit').value;
  const zoom=$('rbs-game-zoom');
  zoom.disabled=frameState.gameFit!=='fill';
  frameState.gameZoom=zoom.disabled?1:Number(zoom.value)/100;
  $('rbs-game-zoom-value').textContent=Math.round(frameState.gameZoom*100)+'%';
  $('rbs-game').style.transform='scale('+frameState.gameZoom+')';
  frameState.cameraStyles=actual.map(({id})=>({mirror:$('rbs-mirror-'+id).checked,filter:$('rbs-filter-'+id).value}));
  $('rbs-game').style.objectFit=frameState.gameFit==='fill'?'cover':'contain';
  actual.forEach(({id},i)=>{
   const v=videoNodes.get(id),style=frameState.cameraStyles[i];
   v.style.objectFit='cover';
   v.style.transform=style.mirror?'scaleX(-1)':'';
   v.style.filter=RockBroadcastSocialLayout.filters[style.filter];
  });
 }else{
  $('rbs-game').style.removeProperty('object-fit');
  $('rbs-game').style.removeProperty('transform');
 }
 renderModeration();}
function renderModeration(){const list=$('rbs-moderation');list.replaceChildren();if(!owner)return;for(const p of ordered()){if(p.id==='owner')continue;const item=document.createElement('div');item.className='rbs-person';item.textContent=p.label;for(const action of ['mute','remove']){const b=document.createElement('button');b.textContent=action==='mute'?'Mute':'Remove';b.onclick=run(async()=>{await api(action,{id:sessionId,identity:p.id});say(action==='mute'?'Participant microphone muted.':'Participant removed from this call.');});item.append(b);}list.append(item);}}
function renderAccess(){
 if(mode==='tournament')return;
 const gameplay=mode==='gameplay';
 const canOpen=gameplay&&!owner&&!role;
 const expanded=invited||cohostOpen;
 const eligible=gameplay?expanded:!!member;
 cohostEntry.hidden=!canOpen||invited;
 cohostEntry.setAttribute('aria-expanded',String(canOpen&&expanded));
 cohostEntry.textContent=expanded?'Close co-host sign-in':'Join as co-host';
 $('rbs-owner').hidden=!owner;
 $('rbs-entry').hidden=!!role||owner||!eligible;
 $('rbs-private').hidden=!(owner||eligible||role);
 $('rbs-call-controls').hidden=!role;
 $('rbs-set-cohost-password').hidden=!(gameplay&&role==='owner'&&owner);
 $('rbs-code-label').hidden=!(gameplay||invited);
 cohostLogin.hidden=!gameplay;
 $('rbs-join').textContent=gameplay||invited?'Join as co-host':'Join with Meeting Room login';
 $('rbs-member-note').textContent=gameplay?
  'Enter the private password from the owner. Your camera and voice may appear in the broadcast.':
  'Existing Meeting Room member login is required. Your on-screen name, camera and voice may appear to website viewers and on platform LIVE.';
}
async function access(){const wasOwner=owner;const {data:{session}}=await sb.auth.getSession();owner=!!session&&session.user.email?.toLowerCase()==='rockesprorts.official@gmail.com';try{member=await window.rockGetMemberSession?.()||null;}catch(_){member=null;}if(role==='owner'&&!owner||role&&role!=='owner'&&mode==='watchparty'&&!member)await leave();if(!owner){$('rbs-owner-password').value='';for(const p of ['youtube','tiktok']){$('rbs-'+p+'-key').value='';$('rbs-'+p+'-server').value='';}$('rbs-invite').replaceChildren();}renderAccess();if(wasOwner!==owner&&feedId){$('rbs-comments').replaceChildren();refreshFeed();}if(mode!=='tournament')renderPeople();}
function run(fn){return async event=>{const b=event?.currentTarget;if(b?.disabled)return;if(b){b.disabled=true;b.setAttribute('aria-busy','true');}try{await fn();}catch(e){say(e.message||'Could not complete this action',true);}finally{if(b){b.disabled=false;b.removeAttribute('aria-busy');}}};}
async function requireOwner(){await access();if(!owner)throw Error('Owner login required');}
async function devices(){if(!navigator.mediaDevices?.enumerateDevices)return;const d=await navigator.mediaDevices.enumerateDevices();for(const [id,kind,label] of [['rbs-camera-device','videoinput','Default camera'],['rbs-mic-device','audioinput','Default microphone'],['rbs-capture-video','videoinput','Choose capture card'],['rbs-capture-audio','audioinput','Video only / no game audio']]){const select=$(id),selected=select.value;select.replaceChildren(new Option(label,''));d.filter(x=>x.kind===kind).forEach((x,i)=>select.append(new Option(x.label||kind+' '+(i+1),x.deviceId)));if(d.some(x=>x.deviceId===selected))select.value=selected;}}
function attachLocal(){if(!role)return;const id=role==='owner'?'owner':joinResponse?.identity;if(id){ensurePerson(id,role==='owner'?'HOST':$('rbs-name').value.trim()||joinResponse?.name||'Member');const v=videoNodes.get(id);v.srcObject=camera;v.hidden=!camera;v.parentElement.dataset.empty=String(!camera);}if(role==='owner'){$('rbs-game').srcObject=source;$('rbs-game').hidden=!source;$('rbs-empty').hidden=!!source;}}
async function join(asOwner=false){if(joining||role)return;joining=true;const start=epoch,startMode=mode;try{await access();if(asOwner){if(!owner)throw Error('Owner login required');const password=$('rbs-owner-password').value.trim();$('rbs-owner-password').value='';const result=await api('create',mode==='gameplay'&&password?{password}:{});if(start!==epoch||mode!==startMode)throw Error('Call cancelled');sessionId=result.id;joinOpen=result.join_open!==false;if(result.password)showInvite(result.password);joinResponse=null;role='owner';joinResponse=await studio.connect('owner',sessionId);}else{const status=await api('status');if(start!==epoch||mode!==startMode)throw Error('Call cancelled');sessionId=invited?query.get('socialStudio')||status.id:status.id;const cohost=mode==='gameplay'||invited;if(mode==='gameplay'&&!sessionId)throw Error('Ask the owner to start the GAMEPLAY call first');if(mode==='watchparty'&&!member)throw Error('Sign in in the existing Meeting Room first');joinResponse=await api(cohost?'cohost-token':'member-token',{id:sessionId,...(mode==='gameplay'?{login:$('rbs-cohost-login').value.trim()}:{}),password:$('rbs-code').value.trim(),member_token:member?.token,display_name:$('rbs-name').value.trim()});role=cohost?'cohost':'member';await studio.connect('cohost',sessionId);$('rbs-code').value='';}
 if(start!==epoch)throw Error('Call cancelled');ticket=joinResponse.renew_token;const S=window.LivekitClient.RoomEvent;studio.room.on(S.ParticipantConnected,p=>ensurePerson(p.identity,p.name||'Member'));studio.room.on(S.ParticipantDisconnected,p=>{people.delete(p.identity);videoNodes.get(p.identity)?.parentElement.remove();videoNodes.delete(p.identity);renderPeople();});for(const p of studio.room.remoteParticipants?.values()||[])ensurePerson(p.identity,p.name||'Member');ensurePerson(joinResponse.identity,role==='owner'?'HOST':joinResponse.name);attachLocal();renderAccess();await devices();await viewer.disconnect();viewerId=null;$('rbs-view-stage').hidden=true;$('rbs-screen').hidden=false;say('Joined website call. Enable your camera and microphone below. YouTube/TikTok are not required.');
 }catch(e){await leave();throw e;}finally{joining=false;}}
function showInvite(password){const url=new URL(location.pathname,location.origin);url.searchParams.set('broadcastMode',mode);url.searchParams.set('socialStudio',sessionId);url.searchParams.set('socialCohost','1');url.hash='live-broadcast';const area=$('rbs-invite');area.replaceChildren();const text=document.createElement('textarea');text.className='rbs-invite';text.readOnly=true;text.setAttribute('aria-label','Private co-host invitation');text.value='Join: '+url.href+(mode==='gameplay'?'\nID: ROCK':'')+'\nPassword: '+password+(mode==='watchparty'?'\nUse your existing approved Meeting Room login.':'');const copy=document.createElement('button');copy.textContent='COPY PRIVATE CO-HOST INVITATION';copy.onclick=run(async()=>{try{await navigator.clipboard.writeText(text.value);say('Private invitation copied; share only with your co-host.');}catch(_){text.focus();text.select();say('Invitation selected; copy and share privately.');}});area.append(text,copy);}
async function leave(){if(leaving)return;leaving=true;epoch++;try{if(role&&ticket)await api('leave',{id:sessionId,call_token:ticket}).catch(()=>{});await studio.disconnect();source?.getTracks().forEach(t=>t.stop());camera?.getTracks().forEach(t=>t.stop());source=camera=null;await audio.stop();role=null;ticket=null;joinResponse=null;people.clear();videoNodes.clear();$('rbs-tiles').replaceChildren();$('rbs-game').srcObject=null;$('rbs-game').hidden=true;$('rbs-empty').hidden=false;renderPeople();renderAccess();}finally{leaving=false;}}
async function enableCamera(){if(!role)throw Error('Join the call first');const gen=epoch,id=$('rbs-camera-device').value;const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(id?{deviceId:{exact:id}}:{}),width:{ideal:640},height:{ideal:360},frameRate:{ideal:20,max:30},facingMode:'user'}});if(gen!==epoch||!role){next.getTracks().forEach(t=>t.stop());throw Error('Camera request cancelled');}camera?.getTracks().forEach(t=>t.stop());camera=next;camera.getVideoTracks()[0].onended=()=>{if(camera!==next)return;camera=null;attachLocal();};attachLocal();await studio.sync({camera,mic:audio.mic,screen:source});await devices();say(mode==='gameplay'?'Camera connected.':'Camera connected. Original orientation; no mirror.');}
async function enableMic(){if(!role)throw Error('Join the call first');const gen=epoch;await audio.enableMic($('rbs-mic-device').value);if(gen!==epoch||!role){await audio.stop();throw Error('Mic request cancelled');}await studio.sync({camera,mic:audio.mic,screen:source});await devices();say('Microphone connected to the website call.');}
async function shareGameplayWindow(){
 if(!owner||role!=='owner')throw Error('Create / reconnect this mode first');
 const devices=navigator.mediaDevices;
 if(typeof devices?.getDisplayMedia!=='function'){
  throw Error('Screen sharing is unavailable in this browser. Mirror the phone to a computer and share the mirroring window, or use a USB / HDMI capture card.');
 }
 const gen=epoch;
 let next;
 try{
  // Open the browser picker before awaiting any network or auth work.
  next=await devices.getDisplayMedia({video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:60,max:60}},audio:true});
  if(gen!==epoch||role!=='owner'||mode!=='gameplay')return;
  const video=next.getVideoTracks()[0];
  if(!video||video.readyState!=='live')throw Error('The selected window sent no live video.');
  source?.getTracks().forEach(track=>track.stop());
  source=next;
  video.onended=()=>{
   if(source!==next)return;
   source=null;
   next.getTracks().forEach(track=>track.stop());
   attachLocal();
   audio.setScreen(null).catch(()=>{});
   studio.sync({camera,mic:audio.mic,screen:null}).catch(()=>{});
   say('Screen sharing ended. Click Connect / replace game or video to share again.');
  };
  attachLocal();
  await audio.setScreen(next);
  await studio.sync({screen:next,camera,mic:audio.mic});
  if(gen!==epoch||source!==next)return;
  say(next.getAudioTracks().length?'Gameplay video and sound connected.':'Gameplay video connected without shared sound.');
 }catch(error){
  if(gen!==epoch)return;
  if(error.name==='NotAllowedError')throw Error('Screen sharing was cancelled or blocked. Click Connect again and choose the phone mirroring window.');
  if(error.name==='InvalidStateError')throw Error('Open GAMEPLAY in an active browser window, then click Connect again.');
  throw error;
 }finally{
  if(next&&source!==next)next.getTracks().forEach(track=>track.stop());
 }
}
async function share(){
 if(mode==='gameplay'&&$('rbs-source').value==='screen')return shareGameplayWindow();
await requireOwner();if(role!=='owner')throw Error('Create / reconnect this mode first');const gen=epoch;let next;try{if($('rbs-source').value==='capture'){const id=$('rbs-capture-video').value;if(!id)throw Error('Select the capture card video device');next=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:60,max:60}},audio:false});const aid=$('rbs-capture-audio').value;if(aid){const sound=await navigator.mediaDevices.getUserMedia({video:false,audio:{deviceId:{exact:aid},echoCancellation:false,noiseSuppression:false,autoGainControl:false,sampleRate:{ideal:48000},channelCount:{ideal:2}}});sound.getAudioTracks().forEach(t=>next.addTrack(t));}}else next=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:60,max:60}},audio:true});if(gen!==epoch||role!=='owner')throw Error('Source request cancelled');source?.getTracks().forEach(t=>t.stop());source=next;await audio.setScreen(source);source.getVideoTracks()[0].onended=()=>{if(source!==next)return;source=null;audio.setScreen(null);attachLocal();studio.sync({camera,mic:audio.mic,screen:null}).catch(()=>{});};attachLocal();await studio.sync({screen:source,camera,mic:audio.mic});say(source.getAudioTracks().length?'Game/video and its audio shared with the call.':'Video shared without game audio. Select capture audio or share tab audio to include game sound.');}catch(e){if(next!==source)next?.getTracks().forEach(t=>t.stop());throw e;}}
async function syncViewer(){if(viewerBusy||mode==='tournament'||(role&&mode!=='gameplay'))return;viewerBusy=true;const gen=epoch;try{if(document.hidden||location.hash!=='#live-broadcast'){await viewer.disconnect();viewerId=null;closeFeed();return;}const status=await api('status');if(gen!==epoch)return;showViewers(status);syncFeed(status);if(role)return;if(!status.live){if(viewer.role)await viewer.disconnect();viewerId=null;$('rbs-view-stage').hidden=true;$('rbs-screen').hidden=false;return;}if(viewerId!==status.id||!viewer.room||viewer.room.state==='disconnected'){await viewer.connect('viewer',status.id);if(gen!==epoch||role){await viewer.disconnect();return;}viewerId=status.id;}$('rbs-view-stage').hidden=false;$('rbs-screen').hidden=true;}catch(_){/* Quiet public retry; visitors never get member/admin controls. */}finally{viewerBusy=false;}}
async function select(next){if(switching||next===mode)return;switching=true;tabs.querySelectorAll('button').forEach(b=>b.disabled=true);try{if(mode==='tournament')await window.RockTournamentBroadcast?.suspend();else{if(studio.output)await studio.stopOutput(true);await leave();await viewer.disconnect();viewerId=null;}for(const p of ['youtube','tiktok']){$('rbs-'+p+'-key').value='';$('rbs-'+p+'-server').value='';}$('rbs-invite').replaceChildren();closeFeed();cohostOpen=false;cohostEntry.hidden=true;$('rbs-code').value='';mode=next;viewerCount.hidden=true;$('rbs-owner-password').value='';invited=query.get('broadcastMode')===mode&&!!query.get('socialCohost');window.rockBroadcastSelectedMode=mode;tournament.hidden=mode!=='tournament';panel.hidden=mode==='tournament';panel.setAttribute('aria-labelledby','rbs-tab-'+mode);tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));const u=new URL(location.href);if(!invited){u.searchParams.delete('socialCohost');u.searchParams.delete('socialStudio');}if(mode==='tournament')u.searchParams.delete('broadcastMode');else u.searchParams.set('broadcastMode',mode);history.replaceState(null,'',u);if(mode!=='tournament'){renderPeople();await access();await syncViewer();}window.dispatchEvent(new Event('rock-broadcast-mode-changed'));}catch(e){say(e.message,true);}finally{switching=false;tabs.querySelectorAll('button').forEach(b=>b.disabled=false);}}
tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.mode));
$('rbs-set-cohost-password').onclick=run(async()=>{
 const password=$('rbs-owner-password').value.trim(),gen=epoch;
 if(mode!=='gameplay'||role!=='owner'||!owner)throw Error('Connect the owner call first');
 if(password.length<8)throw Error('Enter a password with at least 8 characters');
 const result=await api('create',{password});
 if(gen!==epoch||mode!=='gameplay')return;
 $('rbs-owner-password').value='';
 showInvite(result.password);
 say('Co-host password updated for new sign-ins.');
});
$('rbs-create').onclick=run(()=>join(true));$('rbs-join').onclick=run(()=>join(false));$('rbs-leave').onclick=run(async()=>{if(studio.output)await studio.stopOutput(true);await leave();say('Left the call; local devices stopped.');});$('rbs-camera').onclick=run(enableCamera);$('rbs-mic').onclick=run(enableMic);$('rbs-share').onclick=run(share);$('rbs-devices').onclick=run(devices);$('rbs-sound').onclick=run(()=>studio.resumeAudio());$('rbs-monitor').onclick=run(async()=>{if(role!=='owner')throw Error('Owner call required');await audio.init();audio.monitorOn(!audio.monitoring);say(audio.monitoring?'Game-only headphone sound ON. Own mic is excluded.':'Game headphone sound OFF.');});
$('rbs-mute').onclick=run(async()=>{if(!audio.mic)throw Error('Enable your microphone first');const muted=audio.mic.getAudioTracks()[0].enabled;audio.mic.getAudioTracks().forEach(t=>t.enabled=!muted);studio.mute('mic',muted);say(muted?'Your mic is muted.':'Your mic is enabled.');});$('rbs-hide-camera').onclick=run(async()=>{if(!camera)throw Error('Enable your camera first');const hidden=camera.getVideoTracks()[0].enabled;camera.getVideoTracks().forEach(t=>t.enabled=!hidden);studio.mute('camera',hidden);});
$('rbs-website').onclick=run(async()=>{await requireOwner();if(!source)throw Error('Connect game/video first');if(document.hidden)throw Error('Keep this page visible while composing video');const fps=mode==='gameplay'&&$('rbs-game-fps').value==='60'?60:30;await studio.startOutput(new RockBroadcastSocialCompositor(()=>frameState,()=>({game:$('rbs-game'),people:frameState.people.map(p=>videoNodes.get(p.id))})),fps);say(mode==='gameplay'?'Website output started at 1080p with a '+fps+' FPS target. Actual frame rate depends on the source and connection.':'Website output started. Visitors can watch only; YouTube/TikTok are still separate.');});$('rbs-pause').onclick=run(async()=>{await requireOwner();await studio.stopOutput(true);say('Website/platform output paused. The private call remains connected.');});$('rbs-end').onclick=run(async()=>{await requireOwner();const id=sessionId||(await api('status')).id;if(!id)throw Error('No active call');await api('stop',{id});await leave();sessionId=null;$('rbs-invite').replaceChildren();say('This mode ended; its calls and streams stopped. Tournament is unchanged.');});$('rbs-lock').onclick=run(async()=>{await requireOwner();if(!sessionId)throw Error('Start this mode first');const r=await api('lock',{id:sessionId,closed:joinOpen});joinOpen=r.join_open;say(joinOpen?'New verified member/co-host entries OPEN.':'New entries CLOSED; existing call continues.');});
$('rbs-platform-start').onclick=run(async()=>{await requireOwner();const platforms=['youtube','tiktok'].filter(p=>$('rbs-'+p+'-selected').checked);if(!platforms.length)throw Error('Select YouTube/TikTok');const destinations={};for(const p of platforms){const server=$('rbs-'+p+'-server').value.trim(),key=$('rbs-'+p+'-key').value.trim();if(server||key){if(!server||!key)throw Error('Enter both RTMP server and stream key for '+p);destinations[p]={server,key};}}await api('simulcast',{id:sessionId,platforms,destinations});for(const p of platforms)$('rbs-'+p+'-key').value='';say('Platform output requested. Confirm picture and audio in each platform studio.');});$('rbs-platform-stop').onclick=run(async()=>{await requireOwner();await api('stop-simulcast',{id:sessionId});say('Platform streams stopped; website call/output continues.');});$('rbs-view-sound').onclick=run(async()=>{await viewer.resumeAudio();$('rbs-view').muted=false;await $('rbs-view').play();});
window.addEventListener('rock-member-session',()=>access().catch(()=>{}));window.addEventListener('rock-member-logout',()=>access().catch(()=>{}));sb.auth.onAuthStateChange(()=>setTimeout(()=>access().catch(()=>{}),0));window.addEventListener('hashchange',syncViewer);window.addEventListener('pagehide',()=>{closeFeed();leave();viewer.disconnect();});
document.addEventListener('visibilitychange',()=>{if(mode==='gameplay')syncViewer();});navigator.mediaDevices?.addEventListener?.('devicechange',()=>devices().catch(()=>{}));setInterval(()=>{if(mode!=='tournament'){access().catch(()=>{});syncViewer();}},15000);
setInterval(async()=>{if(!role||!ticket||renewalBusy)return;renewalBusy=true;try{await api('heartbeat',{id:sessionId,call_token:ticket});}catch(e){await leave();say(e.message,true);}finally{renewalBusy=false;}},20000);
window.RockBroadcastSocial={select,get mode(){return mode;}};
const requested=query.get('broadcastMode');if(['gameplay','watchparty'].includes(requested))select(requested);
})();
