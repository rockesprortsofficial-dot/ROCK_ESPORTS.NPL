/* Uses the existing Supabase session; all writes are enforced by server-side owner checks. */
(function(){
'use strict';
if(window.__rockWowReady)return;window.__rockWowReady=true;
const C=window.RockWow,logo='assets/rock-wow-logo.jpg',ownerEmail='rockesprorts.official@gmail.com';
let mode=2,state=C.fresh(2),revision=0,isOwner=false,online=false,editing=false,busy=false,serverNow=0,receivedAt=0,loadSerial=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=(src,alt)=>/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src||'')?'<img src="'+src+'" alt="'+alt+'" loading="lazy">':'';
const id=()=>crypto.randomUUID();
const modes=()=>[2,3,4].map(n=>`<button type="button" data-mode="${n}" aria-pressed="${n===2}">${n}v${n}</button>`).join('');
const root=document.createElement('section');root.id='wow-tournament';root.className='section';
root.innerHTML=`<div class="container"><div class="wow-brand"><img src="${logo}" alt="ROCK ESPORTS official logo"><div><div class="eyebrow">ROCK ESPORTS · WORLD OF WONDER</div><h2>WOW TOURNAMENT</h2><p>2v2 / 3v3 / 4v4 · LIVE DRAW · GROUPS · BRACKET</p></div></div><div class="wow-bar" id="wowModes">${modes()}</div><p id="wowStatus" class="wow-status" role="status" aria-live="polite">Connecting…</p><div class="wow-bar"><button type="button" id="wowRefresh">↻ Refresh</button><button type="button" id="wowEdit" hidden>OWNER · EDIT TOURNAMENT</button></div><div id="wowEditor" hidden></div><div id="wowPublic"></div></div>`;
const anchor=document.getElementById('tournament');anchor.before(root);
const nav=document.querySelector('.nav-inner'),link=document.createElement('a');link.href='#wow-tournament';link.textContent='⚔ WOW GROUP DIVISION';nav.insertBefore(link,nav.querySelector('#adminNavButton'));
// Keep the existing Tournament Center and its announcements intact; add WOW alongside them.
const wowEntry=document.createElement('article');wowEntry.className='card module-card';wowEntry.id='rockWowTournamentEntry';
wowEntry.innerHTML=`<div style="display:flex;align-items:center;gap:14px"><img src="${logo}" alt="ROCK ESPORTS official logo" width="64" height="64" style="object-fit:contain;border-radius:10px"><div><h3>WOW TOURNAMENT</h3><p>2v2 · 3v3 · 4v4 — Live draw, groups, bracket and final results.</p></div></div><a class="btn primary" href="#wow-tournament">⚔ OPEN WOW GROUP DIVISION</a>`;
document.getElementById('tournamentPublicList').before(wowEntry);
const eventEditor=document.getElementById('tournamentEditorList');
if(eventEditor){const addWowType=()=>{eventEditor.querySelectorAll('select[data-k="type"]').forEach(select=>{if(!Array.from(select.options).some(o=>o.value==='WOW')){const option=document.createElement('option');option.value='WOW';option.textContent='WOW';select.append(option);}if(data.tournaments?.[Number(select.dataset.tournament)]?.type==='WOW')select.value='WOW';});};new MutationObserver(addWowType).observe(eventEditor,{childList:true,subtree:true});addWowType();}
const drawRoot=document.createElement('section');
drawRoot.id='wowLiveDraw';drawRoot.className='wow-panel';
drawRoot.innerHTML=`<h3>WOW · LIVE DRAW</h3><div class="wow-bar" aria-label="WOW draw mode">${modes()}</div><p id="wowDrawStatus" class="wow-status" role="status"></p><div id="wowDrawPublic"></div><div id="wowDrawOwner" hidden><p>Prepare and save teams in <a href="#wow-tournament">WOW GROUP DIVISION</a> before starting a draw.</p><label>Schedule draw (your device timezone)<input type="datetime-local" id="wowSchedule"></label><div class="wow-bar"><button type="button" data-action="draw">START WOW DRAW NOW</button><button type="button" data-action="schedule">SCHEDULE WOW DRAW</button><button type="button" class="wow-danger" data-action="reset">RESET WOW DRAW &amp; BRACKET</button></div></div><a href="#wow-tournament">View WOW groups and results</a>`;
document.querySelector('#live-draw > .container > .head').after(drawRoot);
const $=s=>root.querySelector(s)||drawRoot.querySelector(s);
const status=s=>{for(const id of ['#wowStatus','#wowDrawStatus'])$(id).textContent=s;};
function person(team,players=true){if(!team)return '<p>Awaiting team</p>';return `<div class="wow-person">${image(team.logo,'Team logo')}<b>${esc(team.name)}</b></div>${players?(team.players||[]).map(p=>`<div class="wow-person wow-player">${image(p.photo,'Player photo')}<span>${esc(p.name)}</span></div>`).join(''):''}`;}
const team=id=>state.teams.find(t=>t.id===id);
function match(m,model,editable){const pair=model.pair(m),win=state.results[m.id],source=r=>Object.hasOwn(r,'team')?(r.team?'Team':'BYE'):`${r.loser?'Loser':'Winner'} of ${r.match}`;return `<article class="wow-match"><b>${esc(m.id)}</b>${pair.map((t,i)=>`<div class="${t&&t===win?'wow-winner':''}">${t?person(team(t),false):`<p>${t===null?'BYE':esc(source(i?m.b:m.a))}</p>`}</div>`).join('<small>VS</small>')}${editable&&pair.every(Boolean)?`<label>Winner<select data-result="${m.id}"><option value="">Choose winner</option>${pair.map(t=>`<option value="${esc(t)}" ${win===t?'selected':''}>${esc(team(t)?.name)}</option>`).join('')}</select></label>`:''}</article>`;}
function render(){
 const d=state.draw,complete=d&&d.revealed===state.teams.length,model=C.bracket(state);
 const now=serverNow+(Date.now()-receivedAt),start=d?Date.parse(d.startsAt):0;
 const drawStatus=!d?'NOT DRAWN':now<start?'SCHEDULED':complete?'DRAW COMPLETE':'● LIVE';
 const drawSummary=d?`Starts: ${esc(new Date(start).toLocaleString())} · ${d.revealed}/${state.teams.length} teams revealed · Times shown in your device timezone.`:'Owner prepares teams and groups before the draw.';
 const groupGrid=`<div class="wow-grid">${C.groups(state).map(g=>`<article class="wow-panel"><h3>${esc(g.name)}</h3>${g.teams.map(t=>`<div class="wow-team wow-reveal">${person(t)}</div>`).join('')||'<p>Awaiting draw</p>'}</article>`).join('')}</div>`;
 $('#wowDrawPublic').innerHTML=`<div class="wow-bar"><h3>${mode}v${mode} · LIVE DRAW</h3><span class="wow-live">${drawStatus}</span></div><p>${drawSummary}</p>${groupGrid}`;
 $('#wowPublic').innerHTML=`<div class="wow-panel"><div class="wow-bar"><h3>${mode}v${mode} · GROUP DIVISION</h3><a href="#live-draw">Open LIVE DRAW</a></div>${groupGrid}</div><details class="wow-panel"><summary>TEAMS & PLAYERS · ${state.teams.length}</summary><div class="wow-grid">${state.teams.map(t=>`<div class="wow-team">${person(t)}</div>`).join('')||'<p>No teams published yet.</p>'}</div></details><div class="wow-panel"><h3>TOURNAMENT BRACKET</h3><p>Single elimination · semifinal losers play for #3. BYE teams advance automatically.</p>${model.rounds.length?`<div class="wow-bracket">${model.rounds.map((r,i)=>`<div class="wow-round"><h3>${i===model.rounds.length-1?'FINAL':'ROUND '+(i+1)}</h3>${r.map(m=>match(m,model,false)).join('')}</div>`).join('')}${model.third?`<div class="wow-round"><h3>THIRD PLACE</h3>${match(model.third,model,false)}</div>`:''}</div>`:'<p>Bracket will appear when the owner confirms qualifiers after the draw.</p>'}<div class="wow-grid wow-ranks">${[0,1,2].map(i=>`<article class="wow-team"><strong>#${i+1}</strong>${model.places[i]?person(team(model.places[i]),false):'<p>To be decided</p>'}</article>`).join('')}</div></div>`;
 $('#wowEdit').hidden=!isOwner||!online;
 $('#wowDrawOwner').hidden=!isOwner||!online;
 drawRoot.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||editing||(b.dataset.action==='reset'?!d:!!d||state.teams.length<2));
 $('#wowSchedule').disabled=busy||editing||!!d;
 for(const panel of [root,drawRoot])panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.mode)===mode));
}
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data;}
async function load(force=false){if(editing||busy)return;const serial=++loadSerial,requestedMode=mode;try{const row=await rpc('rock_wow_public',{p_mode:requestedMode,p_known_revision:online&&!force?revision:null,p_known_revealed:state.draw?.revealed||0});if(serial!==loadSerial||requestedMode!==mode||editing||busy)return;if(row.state)state=row.state;revision=row.revision;serverNow=Date.parse(row.server_now);receivedAt=Date.now();online=true;status('✓ Online · Public groups and results synchronized');if(!row.unchanged)render();}catch(e){if(serial!==loadSerial)return;online=false;console.warn('WOW connection:',e.message);status('WOW TOURNAMENT अहिले उपलब्ध छैन। कृपया केही बेरपछि Refresh गर्नुहोस्।');$('#wowEdit').hidden=true;$('#wowDrawOwner').hidden=true;}}
async function auth(){const {data:{session}}=await sb.auth.getSession();isOwner=session?.user?.email?.toLowerCase()===ownerEmail;if(!isOwner&&editing){editing=false;$('#wowEditor').hidden=true;await load(true);}if(!editing)render();}
async function commit(action,payload){if(busy)return;busy=true;root.inert=drawRoot.inert=true;try{await rpc('rock_wow_owner',{p_mode:mode,p_revision:revision,p_action:action,p_payload:payload});editing=false;$('#wowEditor').hidden=true;status('Saved online.');}catch(e){status('Not saved: '+e.message);throw e;}finally{busy=false;root.inert=drawRoot.inert=false;}await load(true);}
function editor(){
 const openTeams=new Set(Array.from($('#wowEditor').querySelectorAll('[data-team-editor][open]'),item=>item.dataset.teamEditor));
 const locked=!!state.draw,complete=state.draw?.revealed===state.teams.length,model=C.bracket(state);
 $('#wowEditor').hidden=false;$('#wowEditor').innerHTML=`<div class="wow-panel"><h3>OWNER CONTROL · ${mode}v${mode}</h3><p>Changes stay here until SAVE. Structural changes require resetting the draw and bracket. Public viewers cannot edit.</p><div class="wow-bar"><button type="button" data-action="save">SAVE ONLINE</button><button type="button" data-action="cancel">CANCEL</button></div><h3>GROUPS</h3><div class="wow-grid">${state.groups.map((g,i)=>`<label>Group ${i+1}<input maxlength="60" data-group="${i}" value="${esc(g.name)}" ${locked?'disabled':''}><button type="button" data-remove-group="${i}" ${locked?'disabled':''}>REMOVE GROUP</button></label>`).join('')}</div><button type="button" data-action="add-group" ${locked?'disabled':''}>+ ADD GROUP</button><h3>TEAMS & PLAYERS</h3><div class="wow-grid">${state.teams.map((t,i)=>`<details class="wow-team" data-team-editor="${esc(t.id)}" ${openTeams.has(t.id)?'open':''}><summary>${esc(t.name)}</summary><label>Team name<input data-team-name="${i}" maxlength="80" value="${esc(t.name)}"></label>${person(t,false)}<label>Upload this team’s registration logo (JPG/PNG/WebP, up to 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" data-image-team="${i}"></label>${t.logo?`<button type="button" data-clear-logo="${i}">REMOVE TEAM LOGO</button>`: ''}${t.players.map((p,j)=>`<label>Player ${j+1}<input maxlength="80" data-player-name="${i},${j}" value="${esc(p.name)}"></label>${p.photo?`<div class="wow-person">${image(p.photo,'Player photo')}</div>`:''}<label>Player ${j+1} photo<input type="file" accept="image/jpeg,image/png,image/webp" data-image-player="${i},${j}"></label>`).join('')}<button type="button" class="wow-danger" data-remove-team="${i}" ${locked?'disabled':''}>REMOVE TEAM</button></details>`).join('')}</div><button type="button" data-action="add-team" ${locked?'disabled':''}>+ ADD TEAM</button><p><a href="#live-draw">Open LIVE DRAW to start, schedule or reset the WOW draw</a></p><h3>QUALIFIERS → BRACKET</h3><p>Select teams to qualify from the published groups. Building again clears previous match results.</p><div class="wow-grid">${C.groups(state).map(g=>`<div><h3>${esc(g.name)}</h3>${g.teams.map(t=>`<label><input style="display:inline;width:auto" type="checkbox" data-qualifier="${esc(t.id)}" checked> ${esc(t.name)}</label>`).join('')}</div>`).join('')}</div><button type="button" data-action="bracket" ${complete?'':'disabled'}>BUILD BRACKET FROM SELECTED TEAMS</button>${model.rounds.length?`<div class="wow-bracket">${model.rounds.map(r=>`<div class="wow-round">${r.map(m=>match(m,model,true)).join('')}</div>`).join('')}${model.third?`<div class="wow-round">${match(model.third,model,true)}</div>`:''}</div>`:''}</div>`;
}
async function imageFile(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024)throw Error('Choose a JPG, PNG or WebP image up to 5 MB.');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Image dimensions are too large.');}const canvas=document.createElement('canvas'),scale=Math.min(1,384/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.72);}
root.addEventListener('input',e=>{const d=e.target.dataset;if(d.group!==undefined)state.groups[+d.group].name=e.target.value;if(d.teamName!==undefined)state.teams[+d.teamName].name=e.target.value;if(d.playerName){const [i,j]=d.playerName.split(',').map(Number);state.teams[i].players[j].name=e.target.value;}});
root.addEventListener('change',async e=>{const d=e.target.dataset;try{if(d.result){C.result(state,d.result,e.target.value||null);editor();}if(d.imageTeam!==undefined||d.imagePlayer){busy=true;$('#wowEditor').inert=true;status('Preparing image…');const image=await imageFile(e.target.files[0]);if(d.imageTeam!==undefined)state.teams[+d.imageTeam].logo=image;else{const [i,j]=d.imagePlayer.split(',').map(Number);state.teams[i].players[j].photo=image;}status('Image ready. SAVE ONLINE to publish.');editor();}}catch(err){status(err.message);}finally{busy=false;$('#wowEditor').inert=false;}});
async function handleClick(e){const b=e.target.closest('button');if(!b||busy)return;const d=b.dataset;try{
 if(d.mode){if(Number(d.mode)===mode)return;if(editing&&!confirm('Discard unsaved changes?'))return;editing=false;$('#wowEditor').hidden=true;mode=Number(d.mode);$('#wowSchedule').value='';online=false;state=C.fresh(mode);render();await load();return;}
 if(b.id==='wowRefresh'){await load(true);return;}
 if(b.id==='wowEdit'&&isOwner&&online){editing=true;editor();render();return;}
 if(e.currentTarget===drawRoot){
  if(!isOwner||!online||editing)return;
  if(d.action==='reset'&&state.draw&&confirm('Reset this mode’s draw, bracket and results? Teams and logos remain.'))await commit('reset',{});
  if((d.action==='draw'||d.action==='schedule')&&!state.draw){
   const start=d.action==='schedule'?new Date($('#wowSchedule').value):new Date();
   if(!Number.isFinite(start.getTime())||(d.action==='schedule'&&start.getTime()<=Date.now()))throw Error('Choose a future date and time.');
   if(confirm('Publish the WOW draw using the saved teams?')){
    await commit('draw',{startsAt:start.toISOString()});
    $('#wowSchedule').value='';
   }
  }
  return;
 }
 if(!editing||!isOwner)return;
 if(d.clearLogo!==undefined){state.teams[+d.clearLogo].logo='';editor();return;}
 if(d.removeTeam!==undefined){state.teams.splice(+d.removeTeam,1);editor();}if(d.removeGroup!==undefined){if(state.groups.length<=1)throw Error('Keep at least one group.');state.groups.splice(+d.removeGroup,1);editor();}
 switch(d.action){
 case 'cancel':editing=false;$('#wowEditor').hidden=true;await load(true);break;
 case 'save':await commit('save',state);break;
 case 'add-group':state.groups.push({id:id(),name:'GROUP '+(state.groups.length+1)});editor();break;
 case 'add-team':state.teams.push({id:id(),name:'TEAM '+(state.teams.length+1),logo:'',players:Array.from({length:mode},(_,i)=>({name:'Player '+(i+1),photo:''}))});editor();break;
 case 'bracket':{const seeds=Array.from(root.querySelectorAll('[data-qualifier]:checked'),x=>x.dataset.qualifier);if(seeds.length<2)throw Error('Select at least two qualifying teams.');if(confirm('Build bracket and clear earlier results?')){state.seeds=seeds;state.results={};editor();}break;}
 }
 }catch(err){status(err.message);}}
root.addEventListener('click',handleClick);
drawRoot.addEventListener('click',handleClick);
sb.auth.onAuthStateChange(()=>setTimeout(()=>auth().catch(e=>status(e.message)),0));
auth().catch(()=>{});load();setInterval(()=>{if(!document.hidden)load();},3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();

