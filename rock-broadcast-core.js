/* Pure broadcast calculations. No game data is inferred from video. */
(function(root){'use strict';
const points=[0,10,6,5,4,3,2,1,1];
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function validate(s,final=false){
 if(!s||!Array.isArray(s.teams)||s.teams.length!==16)throw Error('Exactly 16 teams required');
 const places=new Set(),ids=new Set();
 for(const t of s.teams){if(!t.id||ids.has(t.id))throw Error('Team IDs must be unique');ids.add(t.id);
 if(!Array.isArray(t.players)||t.players.length!==4)throw Error('Four players required per team');
 if(t.placement!==null){if(!integer(t.placement,1,16)||places.has(t.placement))throw Error('Placements must be unique, 1–16');places.add(t.placement);}
 if(final&&t.placement===null)throw Error('Confirm all 16 placements before approval');
 for(const p of t.players){if(!integer(p.kills,0,63)||!integer(p.health,0,100)||!['alive','knock','out'].includes(p.status))throw Error('Invalid player kills, health or status');}
 }
 return s;
}
const kills=t=>t.players.reduce((n,p)=>n+p.kills,0);
const placement=t=>t.placement===null?0:(points[t.placement]||0);
function ranking(teams){return teams.map(t=>({...t,kills:kills(t),placementPoints:placement(t),total:kills(t)+placement(t)})).sort((a,b)=>b.total-a.total||b.kills-a.kills||(a.placement??99)-(b.placement??99)||a.id.localeCompare(b.id));}
function stats(teams){const p=teams.flatMap(t=>t.players);return {alive:p.filter(p=>p.status==='alive').length,knocked:p.filter(p=>p.status==='knock').length,out:p.filter(p=>p.status==='out').length,remaining:teams.filter(t=>t.players.some(p=>p.status!=='out')).length,kills:teams.reduce((n,t)=>n+kills(t),0)};}
function blank(){return {tournament:'ROCK ESPORTS CLASSIC TOURNAMENT',tournamentId:'',match:1,group:'A',map:'Erangel',phase:'setup',startedAt:null,endedAt:null,branding:{headerName:'ROCK ESPORTS',headerLogo:'assets/icons/rock-192.png',monitorName:'ROCK MONITORING',monitorLogo:'assets/icons/rock-192.png'},hosts:['OWNER','CO-HOST'],channels:{youtube:'',tiktok:''},hostStyles:Array.from({length:2},()=>({theme:'neon',brightness:1,contrast:1,zoom:1,background:''})),promotion:{enabled:false,links:[]},teams:Array.from({length:16},(_,i)=>({id:'A'+String(i+1).padStart(2,'0'),name:'TEAM '+(i+1),short:'A'+(i+1),logo:'',placement:null,players:Array.from({length:4},(_,j)=>({name:'Player '+(j+1),realName:'',photo:'',health:100,status:'alive',kills:0,knocks:null,revives:null,damage:null,survival:null}))}))};}
function publicState(s){validate(s);return {...s,teams:s.teams.map(t=>({id:t.id,name:t.name,short:t.short,logo:t.logo,placement:t.placement,players:t.players.map(p=>({name:p.name,photo:p.photo,health:p.health,status:p.status,kills:p.kills}))}))};}
function promo(now,start,enabled){const elapsed=now-start;if(!enabled||!start||elapsed<900000)return {visible:false,next:900000-Math.max(0,elapsed)};const offset=elapsed%900000;return {visible:offset<34000,next:900000-offset};}
function overall(matches,tournament){const seen=new Set(),totals=new Map();for(const r of [...matches].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))){const s=r.snapshot;if(!r.verified||(s.tournamentId||s.tournament)!==tournament)continue;const key=s.group+'|'+s.match;if(seen.has(key))continue;seen.add(key);for(const t of ranking(s.teams)){const id=t.registrationId||t.name.trim().toLowerCase(),v=totals.get(id)||{name:t.name,kills:0,total:0,matches:0};v.kills+=t.kills;v.total+=t.total;v.matches++;totals.set(id,v);}}return [...totals.values()].sort((a,b)=>b.total-a.total||b.kills-a.kills||a.name.localeCompare(b.name));}
const api={blank,validate,ranking,stats,publicState,promo,overall};if(typeof module!=='undefined')module.exports=api;else root.RockBroadcastCore=api;
})(typeof window==='undefined'?globalThis:window);
