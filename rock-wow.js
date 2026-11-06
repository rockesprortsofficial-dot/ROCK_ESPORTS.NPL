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
root.innerHTML=`<div class="container"><div class="wow-brand"><img src="${logo}" alt="ROCK ESPORTS official logo"><div><div class="eyebrow">ROCK ESPORTS · WORLD OF WONDER</div><h2>WOW TOURNAMENT</h2><p>2v2 / 3v3 / 4v4 · LIVE DRAW · GROUPS · BRACKET</p></div></div><div class="wow-bar" id="wowModes">${modes()}</div><p id="wowStatus" class="wow-status" role="status" aria-live="polite">Connecting…</p><div class="wow-bar"><button type="button" id="wowRefresh">↻ Refresh</button></div><div id="wowPublic"></div></div>`;
const anchor=document.getElementById('tournament');anchor.before(root);
const nav=document.querySelector('.nav-inner'),link=document.createElement('a');link.href='#wow-tournament';link.textContent='⚔ WOW GROUP DIVISION';const tdmLink=nav.querySelector('a[href="#tdm-group-division"]');if(tdmLink)tdmLink.after(link);else nav.insertBefore(link,nav.querySelector('#adminNavButton'));
// Keep the existing Tournament Center and its announcements intact; add WOW alongside them.
const wowEntry=document.createElement('article');wowEntry.className='card module-card';wowEntry.id='rockWowTournamentEntry';
wowEntry.innerHTML=`<div style="display:flex;align-items:center;gap:14px"><img src="${logo}" alt="ROCK ESPORTS official logo" width="64" height="64" style="object-fit:contain;border-radius:10px"><div><h3>WOW TOURNAMENT</h3><p>2v2 · 3v3 · 4v4 — Live draw, groups, bracket and final results.</p></div></div><a class="btn primary" href="#wow-tournament">⚔ OPEN WOW GROUP DIVISION</a>`;
document.getElementById('tournamentPublicList').before(wowEntry);
const eventEditor=document.getElementById('tournamentEditorList');
if(eventEditor){const addWowType=()=>{eventEditor.querySelectorAll('select[data-k="type"]').forEach(select=>{if(!Array.from(select.options).some(o=>o.value==='WOW')){const option=document.createElement('option');option.value='WOW';option.textContent='WOW';select.append(option);}if(data.tournaments?.[Number(select.dataset.tournament)]?.type==='WOW')select.value='WOW';});};new MutationObserver(addWowType).observe(eventEditor,{childList:true,subtree:true});addWowType();}
const wowAdmin=document.createElement('section');
wowAdmin.id='wowAdminTournament';
wowAdmin.hidden=true;
wowAdmin.innerHTML=`<div class="wow-panel"><h3>WOW TOURNAMENT</h3><div class="wow-bar" aria-label="WOW mode">${modes()}</div><div class="wow-bar"><button type="button" id="wowEdit" hidden>OWNER · EDIT TOURNAMENT</button></div><p id="wowAdminStatus" class="wow-status" role="status"></p><div id="wowEditor" hidden></div></div>`;
eventEditor.before(wowAdmin);
const $=s=>root.querySelector(s)||wowAdmin.querySelector(s),el=id=>document.getElementById(id);
const stage=el('drawStage'), schedule=el('drawScheduleAt'), board=el('publicDrawCards').closest('.draw-board');
const actions=el('liveDrawAdmin').querySelector('.draw-actions');
const drawView=document.createElement('select');
drawView.id='wowDrawView';
drawView.innerHTML='<option value="">TDM / Existing draws</option>';
for(const n of [2,3,4]){
 stage.add(new Option('WOW '+n+'v'+n,'wow'+n));
 drawView.add(new Option('WOW '+n+'v'+n,String(n)));
}
const viewLabel=document.createElement('label');
viewLabel.className='field';
viewLabel.textContent='Draw to watch ';
viewLabel.append(drawView);
board.before(viewLabel);
const namesField=el('drawPlayerNames').closest('.field'), profilesField=el('liveDrawPlayerEditor').closest('.field');
const rosterNote=document.createElement('p');
rosterNote.className='hint';
rosterNote.hidden=true;
rosterNote.innerHTML='WOW uses the saved teams and logos from <a href="#wow-tournament">WOW GROUP DIVISION</a>. Leave the schedule blank to open chits manually.';
namesField.after(rosterNote);
const publicRound=el('publicDrawRound'), publicStatus=el('publicDrawStatus'), publicCards=el('publicDrawCards'), publicMatches=el('publicDrawMatches'), publicPeople=el('publicDrawParticipants');
const adminStatus=el('adminDrawStatus'), adminPreview=el('adminDrawPreview'), adminLog=el('adminDrawLog');
const drawHeadings=[publicMatches.previousElementSibling,publicPeople.previousElementSibling];
const originalHeadings=drawHeadings.map(heading=>heading.textContent);
const originalStatus=()=>typeof window.renderLiveDraw==='function'&&window.renderLiveDraw();
const adminMode=()=>/^wow([234])$/.test(stage.value)?Number(stage.value.at(-1)):0;
let publicViewMode=0;
let drawMessage='';
function status(message){$('#wowStatus').textContent=message;$('#wowAdminStatus').textContent=message;}
const watched=[publicRound,publicStatus,publicCards,publicMatches,publicPeople,adminStatus,adminPreview,adminLog];
const legacyChanges=new MutationObserver(renderSharedDraw);
function renderSharedDraw(){
 legacyChanges.disconnect();
 try{
  const d=state.draw;
  const count=state.teams.length;
  const revealed=d?.revealed||0;
  const waiting=d&&!d.manual&&serverNow+(Date.now()-receivedAt)<Date.parse(d.startsAt);
  const progress=!online?'Connecting to WOW draw…':!d?'Prepare the draw using the saved WOW teams.':
    d.finished?'Round finished.':waiting?'Scheduled for '+new Date(d.startsAt).toLocaleString():
    revealed===count?'All chits are open.':revealed?revealed+' / '+count+' chits opened.':'Ready to open chits.';
  const title=mode+'v'+mode+' · WOW GROUP DRAW';
  const assignments=new Map((d?.order||[]).map((id,i)=>[id,state.groups[i%state.groups.length]?.name]));
  const cards=state.teams.map(t=>{
   const group=assignments.get(t.id);
   return `<div class="draw-card wow-shared-chit ${group?'revealed':'pending'}">${image(t.logo,'Team logo')}<div class="letter">${group?esc(group):'?'}</div><div class="draw-name">${esc(t.name)}</div><div class="hint">${group?'REVEALED':'SEALED CHITTHA'}</div></div>`;
  }).join('')||'<div class="draw-card pending">No WOW teams published.</div>';
  if(publicViewMode){
   publicRound.textContent=publicViewMode+'v'+publicViewMode+' · WOW GROUP DRAW';
   publicStatus.textContent=publicViewMode===mode?progress:'Loading WOW draw…';
   publicCards.innerHTML=publicViewMode===mode?cards:'';
   publicMatches.innerHTML=publicViewMode===mode?C.groups(state).map(group=>`<div class="draw-match"><strong>${esc(group.name)}</strong><span>${group.teams.map(t=>esc(t.name)).join(', ')||'Awaiting draw'}</span></div>`).join(''):'';
   publicPeople.innerHTML=publicViewMode===mode?state.teams.map(t=>`<div class="draw-name-row"><span>${esc(t.name)}</span><b>${esc(assignments.get(t.id)||'SEALED')}</b></div>`).join(''):'';
  }
  if(adminMode()){
   adminStatus.textContent=drawMessage||(editing?'Save or cancel your WOW team edits first.':adminMode()===mode?progress:'Loading WOW draw…');
   adminPreview.innerHTML=adminMode()===mode?cards:'';
   adminLog.textContent=title+' · Saved teams from WOW GROUP DIVISION.';
  }
 }finally{
  for(const target of watched)legacyChanges.observe(target,{childList:true,subtree:true,characterData:true});
 }
}
function showDraw(value){
 publicViewMode=Number(value);
 drawView.value=String(publicViewMode||'');
 drawHeadings.forEach((heading,i)=>heading.textContent=publicViewMode?['LIVE GROUP DIVISION','Draw teams'][i]:originalHeadings[i]);
 if(!publicViewMode)originalStatus();
 renderSharedDraw();
}
async function selectMode(next){
 if(next===mode)return true;
 if(busy||editing&&!confirm('Discard unsaved WOW team changes?'))return false;
 editing=false;$('#wowEditor').hidden=true;mode=next;online=false;state=C.fresh(mode);
 if(publicViewMode){publicViewMode=next;drawView.value=String(next);}
 if(adminMode()){stage.value='wow'+next;previousStage=stage.value;}
 render();await load(true);return true;
}
drawView.onchange=async()=>{
 const next=Number(drawView.value);
 if(next&&!await selectMode(next)){drawView.value=String(publicViewMode||'');return;}
 showDraw(next);
};
let previousStage=stage.value, tdmSchedule='', wowSchedule='';
stage.addEventListener('change',async()=>{
 const wasWow=/^wow[234]$/.test(previousStage);
 const next=adminMode();
 if(next&&!await selectMode(next)){stage.value=previousStage;return;}
 if(next&&!wasWow){tdmSchedule=schedule.value;schedule.id='wowSharedScheduleAt';schedule.value=wowSchedule;}
 if(!next&&wasWow){wowSchedule=schedule.value;schedule.id='drawScheduleAt';schedule.value=tdmSchedule;}
 previousStage=stage.value;
 namesField.hidden=profilesField.hidden=!!next;
 rosterNote.hidden=!next;
 drawMessage='';
 if(next)showDraw(next);else showDraw(0);
});
actions.addEventListener('click',async event=>{
 const wow=adminMode(), button=event.target.closest('button');
 if(!wow||!button)return;
 const action=button.getAttribute('onclick');
 if(!['prepareLiveDraw()','revealNextChit()','finishLiveDraw()','resetLiveDraw()'].includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(busy)return;
 if(!isOwner||!online||editing||wow!==mode){drawMessage='Save WOW teams and wait for the draw to connect.';renderSharedDraw();return;}
 drawMessage='';
 try{
  const draw=state.draw;
  if(action==='prepareLiveDraw()'){
   if(draw)throw Error('Reset the current WOW draw before preparing another.');
   const manual=!schedule.value;
   const start=manual?new Date():new Date(schedule.value);
   if(!Number.isFinite(start.getTime())||!manual&&start.getTime()<=Date.now())throw Error('Choose a future schedule or leave it blank.');
   await commit('draw',{startsAt:start.toISOString(),manual});
  }else if(action==='revealNextChit()'){
   if(!draw?.manual)throw Error('Prepare a manual draw with the schedule left blank to open chits yourself.');
   await commit('reveal',{});
  }else if(action==='finishLiveDraw()'){
   await commit('finish',{});
  }else if(draw&&confirm('Reset this WOW draw and bracket? Teams and logos will remain.')){
   await commit('reset',{});
  }
 }catch(error){drawMessage=error.message;}
 renderSharedDraw();
},true);
function person(team,players=true){if(!team)return '<p>Awaiting team</p>';return `<div class="wow-person">${image(team.logo,'Team logo')}<b>${esc(team.name)}</b></div>${players?(team.players||[]).map(p=>`<div class="wow-person wow-player">${image(p.photo,'Player photo')}<span>${esc(p.name)}</span></div>`).join(''):''}`;}
const team=id=>state.teams.find(t=>t.id===id);
function match(m,model,editable){const pair=model.pair(m),win=state.results[m.id],source=r=>Object.hasOwn(r,'team')?(r.team?'Team':'BYE'):`${r.loser?'Loser':'Winner'} of ${r.match}`;return `<article class="wow-match"><b>${esc(m.id)}</b>${pair.map((t,i)=>`<div class="${t&&t===win?'wow-winner':''}">${t?person(team(t),false):`<p>${t===null?'BYE':esc(source(i?m.b:m.a))}</p>`}</div>`).join('<small>VS</small>')}${editable&&pair.every(Boolean)?`<label>Winner<select data-result="${m.id}"><option value="">Choose winner</option>${pair.map(t=>`<option value="${esc(t)}" ${win===t?'selected':''}>${esc(team(t)?.name)}</option>`).join('')}</select></label>`:''}</article>`;}
function render(){
 const model=C.bracket(state);
 const groupGrid=`<div class="wow-grid">${C.groups(state).map(g=>`<article class="wow-panel"><h3>${esc(g.name)}</h3>${g.teams.map(t=>`<div class="wow-team wow-reveal">${person(t)}</div>`).join('')||'<p>Awaiting draw</p>'}</article>`).join('')}</div>`;
 $('#wowPublic').innerHTML=`<div class="wow-panel"><div class="wow-bar"><h3>${mode}v${mode} · GROUP DIVISION</h3><a href="#live-draw">Open LIVE DRAW</a></div>${groupGrid}</div><details class="wow-panel"><summary>TEAMS & PLAYERS · ${state.teams.length}</summary><div class="wow-grid">${state.teams.map(t=>`<div class="wow-team">${person(t)}</div>`).join('')||'<p>No teams published yet.</p>'}</div></details><div class="wow-panel"><h3>TOURNAMENT BRACKET</h3><p>Single elimination · semifinal losers play for #3. BYE teams advance automatically.</p>${model.rounds.length?`<div class="wow-bracket">${model.rounds.map((r,i)=>`<div class="wow-round"><h3>${i===model.rounds.length-1?'FINAL':'ROUND '+(i+1)}</h3>${r.map(m=>match(m,model,false)).join('')}</div>`).join('')}${model.third?`<div class="wow-round"><h3>THIRD PLACE</h3>${match(model.third,model,false)}</div>`:''}</div>`:'<p>Bracket will appear when the owner confirms qualifiers after the draw.</p>'}<div class="wow-grid wow-ranks">${[0,1,2].map(i=>`<article class="wow-team"><strong>#${i+1}</strong>${model.places[i]?person(team(model.places[i]),false):'<p>To be decided</p>'}</article>`).join('')}</div></div>`;
 wowAdmin.hidden=!isOwner;
 $('#wowEdit').hidden=!isOwner||!online;
 for(const panel of [root,wowAdmin])panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.mode)===mode));
 renderSharedDraw();
}
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data;}
async function load(force=false){if(editing||busy)return;const serial=++loadSerial,requestedMode=mode;try{const row=await rpc('rock_wow_public',{p_mode:requestedMode,p_known_revision:online&&!force?revision:null,p_known_revealed:state.draw?.revealed||0});if(serial!==loadSerial||requestedMode!==mode||editing||busy)return;if(row.state)state=row.state;revision=row.revision;serverNow=Date.parse(row.server_now);receivedAt=Date.now();online=true;status('✓ Online · Public groups and results synchronized');if(!row.unchanged)render();}catch(e){if(serial!==loadSerial)return;online=false;console.warn('WOW connection:',e.message);status('WOW TOURNAMENT अहिले उपलब्ध छैन। कृपया केही बेरपछि Refresh गर्नुहोस्।');$('#wowEdit').hidden=true;renderSharedDraw();}}
async function auth(){const {data:{session}}=await sb.auth.getSession();isOwner=session?.user?.email?.toLowerCase()===ownerEmail;if(!isOwner&&editing){editing=false;$('#wowEditor').hidden=true;await load(true);}if(!editing)render();}
async function commit(action,payload){if(busy)return;busy=true;root.inert=wowAdmin.inert=true;try{await rpc('rock_wow_owner',{p_mode:mode,p_revision:revision,p_action:action,p_payload:payload});editing=false;$('#wowEditor').hidden=true;status('Saved online.');}catch(e){status('Not saved: '+e.message);throw e;}finally{busy=false;root.inert=wowAdmin.inert=false;}await load(true);}
function editor(){
 const openTeams=new Set(Array.from($('#wowEditor').querySelectorAll('[data-team-editor][open]'),item=>item.dataset.teamEditor));
 const locked=!!state.draw,complete=state.draw?.revealed===state.teams.length&&(!state.draw.manual||state.draw.finished),model=C.bracket(state);
 $('#wowEditor').hidden=false;$('#wowEditor').innerHTML=`<div class="wow-panel"><h3>OWNER CONTROL · ${mode}v${mode}</h3><p>Changes stay here until SAVE. Structural changes require resetting the draw and bracket. Public viewers cannot edit.</p><div class="wow-bar"><button type="button" data-action="save">SAVE ONLINE</button><button type="button" data-action="cancel">CANCEL</button></div><h3>GROUPS</h3><div class="wow-grid">${state.groups.map((g,i)=>`<label>Group ${i+1}<input maxlength="60" data-group="${i}" value="${esc(g.name)}" ${locked?'disabled':''}><button type="button" data-remove-group="${i}" ${locked?'disabled':''}>REMOVE GROUP</button></label>`).join('')}</div><button type="button" data-action="add-group" ${locked?'disabled':''}>+ ADD GROUP</button><h3>TEAMS & PLAYERS</h3><div class="wow-grid">${state.teams.map((t,i)=>`<details class="wow-team" data-team-editor="${esc(t.id)}" ${openTeams.has(t.id)?'open':''}><summary>${esc(t.name)}</summary><label>Team name<input data-team-name="${i}" maxlength="80" value="${esc(t.name)}"></label>${person(t,false)}<label>Upload this team’s registration logo (JPG/PNG/WebP, up to 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" data-image-team="${i}"></label>${t.logo?`<button type="button" data-clear-logo="${i}">REMOVE TEAM LOGO</button>`: ''}${t.players.map((p,j)=>`<label>Player ${j+1}<input maxlength="80" data-player-name="${i},${j}" value="${esc(p.name)}"></label>${p.photo?`<div class="wow-person">${image(p.photo,'Player photo')}</div>`:''}<label>Player ${j+1} photo<input type="file" accept="image/jpeg,image/png,image/webp" data-image-player="${i},${j}"></label>`).join('')}<button type="button" class="wow-danger" data-remove-team="${i}" ${locked?'disabled':''}>REMOVE TEAM</button></details>`).join('')}</div><button type="button" data-action="add-team" ${locked?'disabled':''}>+ ADD TEAM</button><p><a href="#live-draw">Open LIVE DRAW to start, schedule or reset the WOW draw</a></p><h3>QUALIFIERS → BRACKET</h3><p>Select teams to qualify from the published groups. Building again clears previous match results.</p><div class="wow-grid">${C.groups(state).map(g=>`<div><h3>${esc(g.name)}</h3>${g.teams.map(t=>`<label><input style="display:inline;width:auto" type="checkbox" data-qualifier="${esc(t.id)}" checked> ${esc(t.name)}</label>`).join('')}</div>`).join('')}</div><button type="button" data-action="bracket" ${complete?'':'disabled'}>BUILD BRACKET FROM SELECTED TEAMS</button>${model.rounds.length?`<div class="wow-bracket">${model.rounds.map(r=>`<div class="wow-round">${r.map(m=>match(m,model,true)).join('')}</div>`).join('')}${model.third?`<div class="wow-round">${match(model.third,model,true)}</div>`:''}</div>`:''}</div>`;
}
async function imageFile(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024)throw Error('Choose a JPG, PNG or WebP image up to 5 MB.');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Image dimensions are too large.');}const canvas=document.createElement('canvas'),scale=Math.min(1,384/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.72);}
wowAdmin.addEventListener('input',e=>{const d=e.target.dataset;if(d.group!==undefined)state.groups[+d.group].name=e.target.value;if(d.teamName!==undefined)state.teams[+d.teamName].name=e.target.value;if(d.playerName){const [i,j]=d.playerName.split(',').map(Number);state.teams[i].players[j].name=e.target.value;}});
wowAdmin.addEventListener('change',async e=>{const d=e.target.dataset;try{if(d.result){C.result(state,d.result,e.target.value||null);editor();}if(d.imageTeam!==undefined||d.imagePlayer){busy=true;$('#wowEditor').inert=true;status('Preparing image…');const image=await imageFile(e.target.files[0]);if(d.imageTeam!==undefined)state.teams[+d.imageTeam].logo=image;else{const [i,j]=d.imagePlayer.split(',').map(Number);state.teams[i].players[j].photo=image;}status('Image ready. SAVE ONLINE to publish.');editor();}}catch(err){status(err.message);}finally{busy=false;$('#wowEditor').inert=false;}});
async function handleClick(e){const b=e.target.closest('button');if(!b||busy)return;const d=b.dataset;try{
 if(d.mode){await selectMode(Number(d.mode));return;}
 if(b.id==='wowRefresh'){await load(true);return;}
 if(b.id==='wowEdit'&&isOwner&&online){editing=true;editor();renderSharedDraw();return;}
 if(!editing||!isOwner)return;
 if(d.clearLogo!==undefined){state.teams[+d.clearLogo].logo='';editor();return;}
 if(d.removeTeam!==undefined){state.teams.splice(+d.removeTeam,1);editor();}if(d.removeGroup!==undefined){if(state.groups.length<=1)throw Error('Keep at least one group.');state.groups.splice(+d.removeGroup,1);editor();}
 switch(d.action){
 case 'cancel':editing=false;$('#wowEditor').hidden=true;await load(true);break;
 case 'save':await commit('save',state);break;
 case 'add-group':state.groups.push({id:id(),name:'GROUP '+(state.groups.length+1)});editor();break;
 case 'add-team':state.teams.push({id:id(),name:'TEAM '+(state.teams.length+1),logo:'',players:Array.from({length:mode},(_,i)=>({name:'Player '+(i+1),photo:''}))});editor();break;
 case 'bracket':{const seeds=Array.from(wowAdmin.querySelectorAll('[data-qualifier]:checked'),x=>x.dataset.qualifier);if(seeds.length<2)throw Error('Select at least two qualifying teams.');if(confirm('Build bracket and clear earlier results?')){state.seeds=seeds;state.results={};editor();}break;}
 }
 }catch(err){status(err.message);}}
root.addEventListener('click',handleClick);
wowAdmin.addEventListener('click',handleClick);
sb.auth.onAuthStateChange(()=>setTimeout(()=>auth().catch(e=>status(e.message)),0));
auth().catch(()=>{});load();setInterval(()=>{if(!document.hidden)load();},3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();

