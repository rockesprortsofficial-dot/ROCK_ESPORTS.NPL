/* ROCK ESPORTS: TDM-only live-draw and placement extension. Existing draws remain intact. */
(function(root){
'use strict';
const sizes=[8,16,24,32];
function codes(n){return Array.from({length:n/2},(_,i)=>String.fromCharCode(65+i).repeat(2));}
function model(state){
 const n=(state.participants||[]).length,all=[],initial=[],byes=[];
 if(!sizes.includes(n))return {all,initial,winner:[],loser:[],byes,places:[]};
 const add=(id,a,b,label)=>{const m={id,a,b,label};all.push(m);return m;};
 const from=(m,out='win')=>({match:m.id,out});
 codes(n).forEach((code,i)=>initial.push(add('M'+(i+1),{code,slot:0},{code,slot:1},code+' vs '+code)));
 let order=Array.from({length:n/2},(_,i)=>i);
 if(n===24&&Array.isArray(state.tdmByeOrder)&&state.tdmByeOrder.length===12&&new Set(state.tdmByeOrder).size===12&&state.tdmByeOrder.every(i=>Number.isInteger(i)&&i>=0&&i<12))order=state.tdmByeOrder;
 function route(prefix,stop){let pool=order.map(i=>from(initial[i],prefix==='W'?'win':'lose')),rounds=[],k=1;
  while(pool.length>stop){const power=2**Math.floor(Math.log2(pool.length)),pairs=pool.length===power?pool.length/2:pool.length-power,next=[],round=[];
   for(let i=0;i<pairs;i++){const m=add(prefix+k++,pool[i*2],pool[i*2+1],prefix==='W'?'WINNER MATCH':'LOSER MATCH');round.push(m);next.push(from(m));}
   const pass=pool.slice(pairs*2);if(pass.length)byes.push({prefix,refs:pass});rounds.push(round);pool=pass.length?next.flatMap((s,i)=>[s,pass[i]]):next;
  }return {rounds,pool};
 }
 const w=route('W',2),l=route('L',1),semis=w.rounds.at(-1);
 const third=add('T',from(semis[0],'lose'),from(semis[1],'lose'),'THIRD PLACE');
 const fourth=add('F',from(third,'lose'),l.pool[0],'FOURTH PLACE');
 const final=add('GF',w.pool[0],w.pool[1],'GRAND FINAL');
 const results=state.tdmFlowResults||{};
 function source(s){return s.code?s.code+' · '+(s.slot+1)+' नम्बर खेलाडी':s.match+' को '+(s.out==='win'?'विजेता':'हार्ने');}
 function resolve(s){
  if(s.code){const found=(state.chits||[]).map((c,i)=>({c,i})).filter(x=>x.c?.revealed&&x.c.value===s.code);return found[s.slot]?.i??null;}
  const m=all.find(x=>x.id===s.match);if(!m)return null;const a=resolve(m.a),b=resolve(m.b),r=results[m.id];if(a===null||b===null||a===b||(r!==a&&r!==b))return null;return s.out==='win'?r:r===a?b:a;
 }
 function pair(m){return [resolve(m.a),resolve(m.b)];}
 function winner(m){const [a,b]=pair(m),r=results[m.id];return a!==null&&b!==null&&(r===a||r===b)?r:null;}
 return {all,initial,winnerRounds:w.rounds,loserRounds:l.rounds,byes,third,fourth,final,source,resolve,pair,winner,places:[from(final),from(final,'lose'),from(third),from(fourth)]};
}
function updateResult(state,id,value){
 const m=model(state),changed=new Set([id]);state.tdmFlowResults={...(state.tdmFlowResults||{})};
 const match=m.all.find(x=>x.id===id);if(!match)return;
 const pair=m.pair(match);if(value===null)delete state.tdmFlowResults[id];else if(pair.every(Number.isInteger)&&pair.includes(value))state.tdmFlowResults[id]=value;else return;
 for(const next of m.all){if(changed.has(next.a.match)||changed.has(next.b.match)){delete state.tdmFlowResults[next.id];changed.add(next.id);}}
}
const API={sizes,codes,model,updateResult};
if(typeof module==='object'&&module.exports){module.exports=API;return;}
root.RockTdm=API;
if(root.__rockTdmReady)return;root.__rockTdmReady=true;
const el=id=>document.getElementById(id),isFlow=()=>liveDrawState.stage==='tdmGroups'&&liveDrawState.tdmFormat===2;
const old={render:renderTdmDivision,live:renderLiveDraw,admin:buildTdmAdmin,save:saveTdmAdmin,prepare:prepareLiveDraw,loadFields:loadLiveDrawProfileFields,profiles:buildLiveDrawPlayerEditor,saveProfiles:saveLiveDrawProfiles,scheduled:checkScheduledDraw,migrate:migrateLegacyTdmDraw};
let draft=null,uploading=false;
function selectedCount(){return Number(el('tdmPlayerCount')?.value)||32;}
function typedNames(){return (el('drawPlayerNames')?.value||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean);}
function player(i){return Number.isInteger(i)?tdmPlayerAt(i):null;}
function person(s,m){const p=player(m.resolve(s));return `<div class="tdmf-person">${tdmImg(p?.photo||'',p?.name||'?','tdm-avatar')}<span><b>${esc(p?.name||m.source(s))}</b><small>${esc(m.source(s))}</small></span>${p?.logo?tdmImg(p.logo,'Team logo','tdm-logo'):''}</div>`;}
function matchHTML(x,m,editable=false){const pair=m.pair(x),win=m.winner(x);return `<article class="tdmf-match"><header><b>${esc(x.id)}</b><span>${esc(x.label)}</span></header>${person(x.a,m)}<div class="tdmf-vs">VS</div>${person(x.b,m)}${win!==null?`<div class="tdmf-result">✓ ${esc(player(win)?.name)} — WINNER</div>`:''}${editable?`<select aria-label="${esc(x.id)} winner" data-tdmf-result="${esc(x.id)}" ${!pair.every(Number.isInteger)?'disabled':''}><option value="">Select winner / नतिजा बाँकी</option>${pair.filter(Number.isInteger).map(i=>`<option value="${i}" ${win===i?'selected':''}>${esc(player(i)?.name)}</option>`).join('')}</select>`:''}</article>`;}
function roundsHTML(rounds,m,prefix,editable=false){return `<div class="tdmf-rounds">${rounds.map((round,i)=>`<div class="tdmf-round"><h4>ROUND ${i+1} · ${round.length} MATCH${round.length===1?'':'ES'}</h4><div class="tdmf-round-body">${round.map(x=>matchHTML(x,m,editable)).join('')}${i===0?m.byes.filter(b=>b.prefix===prefix).map(b=>`<div class="tdmf-bye"><b>LIVE DRAW BYE → अर्को चरण</b>${b.refs.map(s=>`<div>${esc(m.source(s))}</div>`).join('')}</div>`).join(''):''}</div></div>`).join('<span class="tdmf-arrow" aria-hidden="true">→</span>')}</div>`;}
function boardHTML(m,editable=false){return `<div class="tdmf-section"><h3>① LIVE DRAW → FIRST MATCH</h3><p>एउटै कोड परेका दुई जनाबीच खेल: AA vs AA, BB vs BB…। जित्ने WINNER ROUTE मा र हार्ने LOSER ROUTE मा जान्छन्।</p><div class="tdmf-initial">${m.initial.map(x=>matchHTML(x,m,editable)).join('')}</div></div><div class="tdmf-section"><h3>② WINNER ROUTE → GRAND FINAL</h3><p>हरेक बाकसमा खेलाडी आउने खेलको नम्बर छ। अन्तिम दुई खेलका हार्ने तेस्रो स्थान खेल्छन्; यसअघिका हार्ने बाहिरिन्छन्।</p>${roundsHTML(m.winnerRounds,m,'W',editable)}</div><div class="tdmf-section tdmf-loser"><h3>③ LOSER ROUTE → FOURTH PLACE CHANCE</h3><p>पहिलो समूह खेलका हार्नेहरू खेल्छन्। यहाँ फेरि हार्ने बाहिरिन्छन्। अन्तिम विजेता चौथो स्थानको खेलमा जान्छ।</p>${roundsHTML(m.loserRounds,m,'L',editable)}</div><div class="tdmf-section"><h3>④ THIRD PLACE · FOURTH PLACE · GRAND FINAL</h3><div class="tdmf-placement">${[m.third,m.fourth,m.final].map(x=>matchHTML(x,m,editable)).join('')}</div><div class="tdmf-ranks">${m.places.map((s,i)=>`<div><strong>#${i+1}</strong>${person(s,m)}</div>`).join('')}</div></div>`;}
root.renderTdmDivision=function(){
 const h=el('tdmGroupDivisionPublic');if(!h)return;
 const section=el('tdm-group-division');const hint=section?.querySelector('.head p'),tag=section?.querySelector('.module-tag');
 if(hint)hint.textContent='8 / 16 / 24 / 32 players · LIVE DRAW code pairs → full tournament → final top 4.';
 if(tag)tag.textContent=isFlow()?liveDrawState.participants.length+' PLAYERS · LIVE DRAW':'8 / 16 / 24 / 32 PLAYERS';
 if(!isFlow()){if(liveDrawState.stage==='tdmGroups'){old.render();h.insertAdjacentHTML('afterbegin','<div class="tdm-stage-note">Existing draw retained. नयाँ AA–AA प्रणाली प्रयोग गर्न Admin → LIVE DRAW बाट 8 / 16 / 24 / 32 जना छानेर नयाँ ड्र तयार गर्नुहोस्।</div>');}else h.innerHTML='<div class="tdm-stage-note">Admin → LIVE DRAW → TDM GROUPS मा 8 / 16 / 24 / 32 जना छान्नुहोस्। AA–AA, BB–BB को खेल र फाइनलसम्मको पूरा तालिका यहाँ देखिन्छ।</div>';return;}
 const m=model(liveDrawState),n=liveDrawState.participants.length,opened=(liveDrawState.chits||[]).filter(c=>c.revealed).length;
 h.innerHTML=`<div class="tdm-board-head"><h3>ROCK ESPORTS — ${n} PLAYERS TDM</h3><span class="tdm-live-pill">⚔ LIVE DRAW ${opened}/${n}</span><button type="button" class="module-btn" onclick="downloadTdmDivision()">↓ DOWNLOAD FULL PHOTO</button></div><div class="tdm-stage-note">${opened===n?'Draw complete':'Draw in progress'} · ${n/2} code pairs · फोटो, नाम र लोगो सहित पूरा खेल तालिका${n===24?' · 12 → 8 चरणका BYE स्थान ड्रसँगै छानिएका छन्।':''}</div>${boardHTML(m)}`;
};
root.buildTdmAdmin=function(){if(!isFlow()){old.admin();return;}const h=el('tdmAdminEditor');if(!h)return;
 const m=model(liveDrawState);h.innerHTML='<p class="hint">नाम, फोटो र लोगो LIVE DRAW को Player Profiles बाट सम्पादन गर्नुहोस्। समूह कोड ड्रअनुसार कायम रहन्छ। नतिजा परिवर्तन गर्दा त्यसमा निर्भर अर्को खेलको नतिजा हट्छ।</p>'+boardHTML(m,true);
 h.querySelectorAll('[data-tdmf-result]').forEach(select=>select.addEventListener('change',()=>{const id=select.dataset.tdmfResult,v=select.value===''?null:Number(select.value);updateResult(liveDrawState,id,v);buildTdmAdmin();el('tdmAdminEditor').dataset.unsaved='true';}));
};
root.saveTdmAdmin=async function(){if(!isFlow())return old.save();if(!(await getAdminSession())){alert('Admin login required.');return;}try{await saveLiveDraw();buildTdmAdmin();showToast('✓ TDM results saved online');}catch(e){alert('TDM save failed: '+e.message);}};
root.loadLiveDrawProfileFields=function(){if(el('drawStage')?.value!=='tdmGroups')return old.loadFields();const names=typedNames();if(names.length!==selectedCount()){alert(`${selectedCount()} जना खेलाडीको नाम राख्नुहोस्। अहिले ${names.length} जना छन्।`);return;}draft={names,profiles:names.map((name,i)=>({name,...tdmProfile(name),...(liveDrawState.tdmPlayers||[]).find(p=>p.name===name)}))};buildLiveDrawPlayerEditor(true);el('liveDrawPlayerEditor')?.scrollIntoView({behavior:'smooth',block:'start'});};
root.buildLiveDrawPlayerEditor=function(force=false){if(!draft){old.profiles(force);const h=el('liveDrawPlayerEditor');if(h&&!liveDrawState.participants?.length)h.innerHTML='<p class="hint">खेलाडीका नाम राखेर LOAD PLAYER PHOTO / LOGO FIELDS थिच्नुहोस्।</p>';return;}const h=el('liveDrawPlayerEditor');if(!h)return;
 if(!force&&h.dataset.tdmDraft==='true')return;h.dataset.tdmDraft='true';h.innerHTML='<div class="live-profile-grid">'+draft.profiles.map((p,i)=>`<article class="live-profile-card"><div class="live-profile-title"><b>${i+1}. PLAYER PROFILE</b><span>NEW DRAW · ${selectedCount()} PLAYERS</span></div><label>Player Name<input data-live-name="${i}" value="${esc(p.name)}"></label><div class="live-profile-upload">${['photo','logo'].map(kind=>`<label>${kind==='photo'?'Player Photo':'Team Logo'}<input type="file" accept="image/*" data-live-${kind}="${i}" onchange="previewLiveDrawImage(this,'live-${kind}-preview-${i}')"><span id="live-${kind}-preview-${i}">${p[kind]?`<img src="${esc(p[kind])}" alt="${kind} preview">`:'PREVIEW'}</span></label>`).join('')}</div></article>`).join('')+'</div>';};
async function collectDraft(){const ps=[];for(let i=0;i<draft.profiles.length;i++){const old=draft.profiles[i],p={...old,name:document.querySelector(`[data-live-name="${i}"]`)?.value.trim()||old.name};for(const kind of ['photo','logo']){const file=document.querySelector(`[data-live-${kind}="${i}"]`)?.files?.[0];if(file)p[kind]=await compressImage(file,kind==='photo'?500:320,.8);}ps.push(p);}if(new Set(ps.map(p=>p.name.toLowerCase())).size!==ps.length)throw Error('Each player needs a unique name.');return ps;}
root.saveLiveDrawProfiles=async function(){if(!draft)return old.saveProfiles();if(uploading)return;if(!(await getAdminSession())){alert('Admin login required.');return;}uploading=true;try{draft.profiles=await collectDraft();draft.names=draft.profiles.map(p=>p.name);el('drawPlayerNames').value=draft.names.join('\n');buildLiveDrawPlayerEditor(true);showToast('✓ Profiles ready — PREPARE DRAW to save this new draw online');}catch(e){alert(e.message);}finally{uploading=false;}};
root.prepareLiveDraw=async function(){if(el('drawStage')?.value!=='tdmGroups')return old.prepare();if(uploading)return;if(!(await getAdminSession())){alert('Admin login required.');return;}
 let names=typedNames(),n=selectedCount();if(names.length!==n||new Set(names.map(x=>x.toLowerCase())).size!==n){alert(`ठीक ${n} फरक खेलाडीका नाम राख्नुहोस्।`);return;}
 if(liveDrawState.stage&&liveDrawState.status!=='idle'&&!confirm('नयाँ TDM ड्र तयार गर्दा हालको ड्र र नतिजा बदलिन्छ। अघि बढ्ने?'))return;
 uploading=true;const previous=structuredClone(liveDrawState);try{
  if(draft&&JSON.stringify(names)!==JSON.stringify(draft.names))throw Error('Player list changed. Reload the photo/logo fields before preparing the draw.');
  let profiles=draft&&draft.profiles.length===n?await collectDraft():names.map(name=>({name,...tdmProfile(name),...(liveDrawState.tdmPlayers||[]).find(p=>p.name===name)}));names=profiles.map(p=>p.name);
  const drawCodes=shuffled(codes(n).flatMap(c=>[c,c])),scheduled=el('drawScheduleAt')?.value;
  liveDrawState={stage:'tdmGroups',stageLabel:`TDM GROUPS — ${n} PLAYERS`,tdmFormat:2,participants:names,chits:drawCodes.map(value=>({value,revealed:false})),tdmPlayers:profiles.map((p,i)=>({...p,code:drawCodes[i],group:drawCodes[i]})),tdmFlowResults:{},tdmByeOrder:n===24?shuffled([...Array(12).keys()]):[],revealed:0,status:'ready',scheduledAt:scheduled?new Date(scheduled).toISOString():null,autoRevealed:false,history:[...(previous.history||[]),`${new Date().toLocaleString()} — ${n}-player TDM pair draw prepared`].slice(-50)};
  await saveLiveDraw();draft=null;const host=el('liveDrawPlayerEditor');if(host)delete host.dataset.tdmDraft;buildLiveDrawPlayerEditor();buildTdmAdmin();startDrawScheduleWatcher();showToast('✓ '+n+' player TDM draw ready');
 }catch(e){liveDrawState=previous;renderLiveDraw();alert('Could not prepare TDM draw: '+e.message);}finally{uploading=false;}
};
// Never re-shuffle a published legacy draw in a spectator's browser.
root.migrateLegacyTdmDraw=function(){return false;};
root.renderLiveDraw=function(){old.live();if(isFlow()&&liveDrawState.autoRevealed){const status=el('publicDrawStatus');if(status)status.textContent=`SCHEDULED LIVE DRAW — all ${liveDrawState.participants.length} players revealed automatically.`;}};
root.checkScheduledDraw=async function(){if(!isFlow())return old.scheduled();const s=liveDrawState;if(s.status!=='ready'||!s.scheduledAt||s.autoRevealed||Date.now()<new Date(s.scheduledAt).getTime())return;
 // Only the already-authorized admin publishes an automatic reveal; viewers stay read-only.
 if(!(await getAdminSession()))return;const previous=structuredClone(s);s.chits=s.chits.map(c=>({...c,revealed:true}));s.revealed=s.participants.length;s.status='finished';s.autoRevealed=true;s.history=[...(s.history||[]),`${new Date().toLocaleString()} — Scheduled draw revealed ${s.revealed} players`].slice(-50);try{await saveLiveDraw();}catch(e){liveDrawState=previous;console.warn('TDM scheduled reveal failed',e);}
};
root.downloadTdmDivision=async function(){
 if(!isFlow())return;const snapshot=structuredClone(liveDrawState),m=model(snapshot),n=snapshot.participants.length;
 const button=document.querySelector('#tdmGroupDivisionPublic button');if(button)button.disabled=true;
 try{
  const images={},profiles=snapshot.tdmPlayers||[];
  await Promise.all([...new Set(profiles.flatMap(p=>[p.photo,p.logo]).filter(Boolean))].map(src=>new Promise(done=>{const image=new Image();image.crossOrigin='anonymous';const timer=setTimeout(done,7000);image.onload=()=>{clearTimeout(timer);images[src]=image;done();};image.onerror=()=>{clearTimeout(timer);done();};image.src=src;})));
  await document.fonts.ready;
  const width=1800,pad=36,gap=16,cardH=148;
  const sections=[{title:'1  LIVE DRAW → FIRST MATCH · एउटै कोडको जोडी',rounds:[m.initial],grid:true},{title:'2  WINNER ROUTE → FINAL · जित्नेको बाटो',rounds:m.winnerRounds,prefix:'W'},{title:'3  LOSER ROUTE → FOURTH PLACE · हार्नेको बाटो',rounds:m.loserRounds,prefix:'L'},{title:'4  THIRD PLACE · FOURTH PLACE · GRAND FINAL',rounds:[[m.third],[m.fourth],[m.final]]}];
  for(const s of sections)s.height=95+(s.grid?Math.ceil(m.initial.length/4):Math.max(...s.rounds.map(r=>r.length)))*(cardH+gap)+(m.byes.some(b=>b.prefix===s.prefix)?90:0);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=230+sections.reduce((h,s)=>h+s.height+30,0)+170;
  const c=canvas.getContext('2d');c.fillStyle='#091425';c.fillRect(0,0,width,canvas.height);c.fillStyle='#ffcf64';c.font='900 56px Arial';c.fillText('ROCK ESPORTS',pad,75);c.font='bold 29px Arial';c.fillStyle='#fff';c.fillText(n+' PLAYERS · 1V1 TDM · FULL LIVE DRAW MATCH MAP',pad,125);c.font='20px sans-serif';c.fillStyle='#9bd7e1';c.fillText('AA vs AA · BB vs BB · हरेक बाकसमा अर्को खेलका खेलाडी आउने स्रोत लेखिएको छ।',pad,168);c.fillText('Winner route: early loss → OUT | Last round losers → T | Loser route: loss → OUT',pad,204);
  function text(label,x,y,max,font='bold 19px sans-serif'){c.font=font;label=String(label);while(c.measureText(label).width>max&&label.length>3)label=label.slice(0,-2)+'…';c.fillText(label,x,y);}
  function drawCard(match,x,y,w,loser){c.fillStyle='#11243a';c.fillRect(x,y,w,cardH);c.strokeStyle=loser?'#ed74b2':'#3bd5d9';c.strokeRect(x,y,w,cardH);c.fillStyle=loser?'#ed74b2':'#3bd5d9';text(match.id+' · '+match.label,x+12,y+25,w-24);
   [match.a,match.b].forEach((s,i)=>{const index=m.resolve(s),p=index===null?null:{...profiles[index],name:snapshot.participants[index]},yy=y+37+i*52;
    if(m.winner(match)===index&&index!==null){c.fillStyle='#164c3a';c.fillRect(x+2,yy-2,w-4,51);}
    c.fillStyle='#29435c';c.fillRect(x+12,yy,38,38);if(images[p?.photo])c.drawImage(images[p.photo],x+12,yy,38,38);
    c.fillStyle='#fff';text(p?.name||m.source(s),x+60,yy+17,w-110);c.fillStyle='#a2b9d0';text(m.source(s),x+60,yy+37,w-110,'15px sans-serif');if(images[p?.logo])c.drawImage(images[p.logo],x+w-42,yy+3,30,30);
   });
  }
  let y=230;
  for(const s of sections){c.fillStyle=s.prefix==='L'?'#ed74b2':'#3bd5d9';c.font='bold 27px sans-serif';c.fillText(s.title,pad,y+34);const top=y+60;
   if(s.grid){const w=(width-pad*2-gap*3)/4;s.rounds[0].forEach((match,i)=>drawCard(match,pad+(i%4)*(w+gap),top+Math.floor(i/4)*(cardH+gap),w,false));}
   else{const cols=s.rounds.length,w=(width-pad*2-(cols-1)*38)/cols,rows=Math.max(...s.rounds.map(r=>r.length)),usable=rows*(cardH+gap);
    s.rounds.forEach((round,j)=>round.forEach((match,i)=>{const yy=top+(i+.5)*usable/round.length-cardH/2;drawCard(match,pad+j*(w+38),yy,w,s.prefix==='L');if(s.prefix&&j<cols-1){c.fillStyle='#c8d8e5';c.font='26px Arial';c.fillText('→',pad+j*(w+38)+w+5,yy+75);}}));
    const bye=m.byes.find(b=>b.prefix===s.prefix);if(bye){c.fillStyle='#ffcf64';text('DRAW BYE → NEXT ROUND: '+bye.refs.map(m.source).join(' · '),pad,top+usable+37,width-pad*2,'21px sans-serif');}
   }y+=s.height+30;
  }
  c.fillStyle='#ffcf64';c.font='bold 30px Arial';c.fillText('FINAL RANKING',pad,y+25);
  m.places.forEach((s,i)=>{const index=m.resolve(s),name=index===null?'निर्णय बाँकी':snapshot.participants[index];c.fillStyle='#fff';text('#'+(i+1)+' '+name,pad+i*430,y+80,410,'bold 24px sans-serif');});
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Image could not be created.');const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='ROCK-ESPORTS-TDM-'+n+'-PLAYERS.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }catch(e){alert('Photo download failed: '+e.message);}finally{if(button)button.disabled=false;}
};
const style=document.createElement('style');style.id='rock-tdm-flow-styles';style.textContent=`
#tdmPlayerCount{width:100%;padding:12px;border-radius:8px;background:#102b40;color:white;border:1px solid #375b76}.tdmf-section{margin:18px 0;padding:15px;border:1px solid #b9d7cc;border-radius:10px;background:#fff;color:#111}.tdmf-section h3{margin:0 0 8px;font-size:18px;color:#087b49}.tdmf-section p{font-size:12px;color:#42565c;line-height:1.7}.tdmf-initial{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.tdmf-match{min-width:210px;border:1px solid #99bdb1;border-radius:8px;background:#fff;overflow:hidden;color:#111}.tdmf-match header{display:flex;gap:10px;align-items:center;background:#e8f5ee;padding:8px 10px;font-size:12px;color:#087b49}.tdmf-match header b{font-size:15px}.tdmf-person{display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:48px;color:#101820}.tdmf-person>span{flex:1;min-width:0}.tdmf-person b{display:block;font-size:12px;overflow-wrap:anywhere}.tdmf-person small{display:block;font-size:10px;color:#536971;margin-top:3px}.tdmf-vs{font-size:10px;text-align:center;color:#668579;font-weight:900;line-height:1}.tdmf-result{font-size:11px;color:#087b49;padding:6px 10px;background:#eaf8ed;font-weight:800}.tdmf-match select{width:calc(100% - 12px);margin:6px;padding:8px;background:#f1f6f3;color:#111;border:1px solid #a5c6b6;border-radius:5px}.tdmf-match select:disabled{opacity:.5}.tdmf-rounds{display:flex;align-items:stretch;gap:12px;overflow-x:auto;padding:10px 0}.tdmf-round{flex:1;min-width:235px;display:flex;flex-direction:column}.tdmf-round h4{font-size:11px;color:#536971}.tdmf-round-body{display:flex;flex:1;flex-direction:column;justify-content:space-around;gap:12px}.tdmf-arrow{align-self:center;color:#087b49;font-size:24px}.tdmf-bye{padding:10px;font-size:11px;line-height:1.8;border:1px dashed #ad8428;background:#fff8e6;border-radius:7px;color:#705718}.tdmf-loser{border-color:#deb5c5}.tdmf-loser h3{color:#a82e67}.tdmf-loser .tdmf-match{border-color:#deb5c5}.tdmf-loser .tdmf-match header{color:#a82e67;background:#fcecf3}.tdmf-placement{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.tdmf-ranks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:20px}.tdmf-ranks>div{border:1px solid #d4ba77;border-radius:8px;background:#fffbec}.tdmf-ranks strong{display:block;padding:8px 12px;color:#886817;font-size:20px}#tdmAdminEditor .tdmf-section{color:#111}#tdmAdminEditor .tdmf-person b{color:#111}@media(max-width:650px){.tdmf-placement{grid-template-columns:1fr}.tdmf-ranks{grid-template-columns:repeat(2,minmax(0,1fr))}.tdmf-section{padding:10px}.tdmf-round{min-width:220px}}`;
document.head.appendChild(style);
const stage=el('drawStage');if(stage){stage.querySelector('option[value="tdmGroups"]').textContent='TDM GROUPS — LIVE DRAW PAIRS (8 / 16 / 24 / 32)';const field=document.createElement('div');field.className='field';field.id='tdmCountField';field.innerHTML='<label for="tdmPlayerCount">TDM player count / खेलाडी सङ्ख्या</label><select id="tdmPlayerCount">'+sizes.map(n=>`<option value="${n}">${n} PLAYERS — ${n/2} PAIRS</option>`).join('')+'</select><small class="hint">AA–AA, BB–BB… एउटै कोड पर्ने दुई जनाबीच खेल हुन्छ।</small>';stage.parentElement.after(field);el('tdmPlayerCount').value=String(sizes.includes(liveDrawState.participants?.length)?liveDrawState.participants.length:32);const sync=()=>{field.hidden=stage.value!=='tdmGroups';if(field.hidden){draft=null;const h=el('liveDrawPlayerEditor');if(h)delete h.dataset.tdmDraft;}};stage.addEventListener('change',sync);el('tdmPlayerCount').addEventListener('change',()=>{draft=null;const h=el('liveDrawPlayerEditor');if(h){delete h.dataset.tdmDraft;h.innerHTML='<p class="hint">नयाँ सङ्ख्याअनुसार नाम राखेर LOAD PLAYER PHOTO / LOGO FIELDS थिच्नुहोस्।</p>';}});sync();}
// Update only the TDM-specific fixed-count labels, without changing site branding or other modules.
const profileButton=document.querySelector('button[onclick="loadLiveDrawProfileFields()"]');if(profileButton){profileButton.textContent='① LOAD PLAYER PHOTO / LOGO FIELDS';const hint=profileButton.parentElement.querySelector('small');if(hint)hint.textContent='छानेको सङ्ख्याअनुसार खेलाडीका नाम राख्नुहोस्, अनि फोटो र Team Logo राख्नुहोस्।';}
const sched=el('drawScheduleAt')?.parentElement.querySelector('small');if(sched)sched.textContent='Optional: set auto-reveal time, or open chits manually. Keep the authorized Admin tab open for scheduled reveal.';
const profileTitle=el('liveDrawPlayerEditor')?.parentElement.querySelector('h3');if(profileTitle)profileTitle.textContent='PLAYER PHOTO, NAME & TEAM LOGO';
renderTdmDivision();
})(typeof window==='object'?window:globalThis);
