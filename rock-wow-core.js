/* Independent WOW tournament model. No existing tournament state is modified. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(mode){return {mode,teams:[],groups:[{id:'group-a',name:'GROUP A'},{id:'group-b',name:'GROUP B'}],draw:null,seeds:[],results:{}};}
function bracket(state){
 const seeds=state.seeds||[],results=state.results||{},rounds=[],all=[];
 if(seeds.length<2)return {rounds,all,places:[]};
 let size=2;while(size<seeds.length)size*=2;
 // Spread byes across the first round, rather than creating empty matches.
 const byeCount=size-seeds.length;let cursor=0,pool=[];
 for(let i=0;i<size/2;i++){pool.push({team:seeds[cursor++]});pool.push(i<byeCount?{team:null}:{team:seeds[cursor++]});}
 const resolve=ref=>{
  if(Object.hasOwn(ref,'team'))return ref.team;
  const m=all.find(x=>x.id===ref.match);if(!m)return undefined;
  const [a,b]=pair(m);if(a===undefined||b===undefined)return undefined;
  if(a===null||b===null)return ref.loser?null:(a||b);
  const win=results[m.id];return [a,b].includes(win)?(ref.loser?(win===a?b:a):win):undefined;
 };
 const pair=m=>[resolve(m.a),resolve(m.b)];
 let round=1;
 while(pool.length>1){const matches=[],next=[];for(let i=0;i<pool.length;i+=2){const m={id:`R${round}M${i/2+1}`,a:pool[i],b:pool[i+1]};matches.push(m);all.push(m);next.push({match:m.id});}rounds.push(matches);pool=next;round++;}
 const final=rounds.at(-1)[0];let third=null;
 if(seeds.length>=3){const semi=rounds.at(-2);third={id:'THIRD',a:{match:semi[0].id,loser:true},b:{match:semi[1].id,loser:true}};all.push(third);}
 const places=[resolve({match:final.id}),resolve({match:final.id,loser:true}),third?resolve({match:third.id}):null];
 return {rounds,all,third,pair,resolve,places};
}
function result(state,id,winner){const model=bracket(state),match=model.all.find(m=>m.id===id);if(!match)throw Error('Unknown match');const pair=model.pair(match);if(winner!==null&&(!pair.every(Boolean)||!pair.includes(winner)))throw Error('Both teams must be ready');state.results={...state.results};if(winner===null)delete state.results[id];else state.results[id]=winner;const changed=new Set([id]);for(const next of model.all){if(changed.has(next.a.match)||changed.has(next.b.match)){delete state.results[next.id];changed.add(next.id);}}return state;}
function reset(state){state.draw=null;state.seeds=[];state.results={};return state;}
function groups(state){return state.groups.map((g,i)=>({...g,teams:(state.draw?.order||[]).filter((_,n)=>n%state.groups.length===i).map(id=>state.teams.find(t=>t.id===id)).filter(Boolean)}));}
const api={fresh,bracket,result,reset,groups,clone};
if(typeof module==='object'&&module.exports)module.exports=api;else root.RockWow=api;
})(typeof window==='object'?window:globalThis);
