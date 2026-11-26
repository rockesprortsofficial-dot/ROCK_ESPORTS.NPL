const sizes=[8,16,24,32];
function groupCount(n){return n===8?4:n/4;}
function graph(n,order){
 if(!sizes.includes(n))throw Error('Unsupported player count');
 const matches=[],initial=[],winnerRounds=[],loserRounds=[];let loserChampion=null;
 const add=(id,a,b,lane,round)=>{const m={id,a,b,lane,round};matches.push(m);return m;};
 const ref=(m,out='win')=>({match:m.id,out});
 for(let i=0;i<n/2;i++)initial.push(add('M'+(i+1),{slot:i*2},{slot:i*2+1},'group',0));
 order=order||Array.from({length:n/2},(_,i)=>i);
 if(order.length!==n/2||new Set(order).size!==n/2||order.some(i=>!Number.isInteger(i)||i<0||i>=n/2))throw Error('Invalid draw order');
 for(const lane of ['W','L']){
  let pool=order.map(i=>ref(initial[i],lane==='W'?'win':'lose')),r=1,k=1;
  while(pool.length>(lane==='W'?2:1)){
   const power=2**Math.floor(Math.log2(pool.length)),pairs=pool.length===power?pool.length/2:pool.length-power;
   const next=[],round=[];
   for(let i=0;i<pairs;i++){const m=add(lane+k++,pool[2*i],pool[2*i+1],lane,r);round.push(m);next.push(ref(m));}
   // Non-power-of-two fields receive explicit, persisted byes; no entrant is dropped.
   const pass=pool.slice(pairs*2);pool=next.concat(pass);
   (lane==='W'?winnerRounds:loserRounds).push({matches:round,byes:pass});r++;
  }
  if(lane==='W')add('GF',pool[0],pool[1],lane,r);else loserChampion=pool[0];
 }
 const semis=winnerRounds.at(-1).matches;const third=add('TP',ref(semis[0],'lose'),ref(semis[1],'lose'),'P',0);add('FP',ref(third,'lose'),loserChampion,'P',1);
 return {matches,initial,winnerRounds,loserRounds};
}
function model(s){
 const g=graph(s.participants.length,s.order);if(s.bracket){g.matches=s.bracket;g.initial=s.bracket.filter(x=>x.lane==='group');for(const rounds of [g.winnerRounds,g.loserRounds])for(const r of rounds)r.matches=r.matches.map(x=>s.bracket.find(b=>b.id===x.id));}const results=s.results||{},byId=new Map(g.matches.map(m=>[m.id,m]));
 function resolve(ref){
  if(Number.isInteger(ref.slot))return s.revealed>ref.slot?ref.slot:null;
  const m=byId.get(ref.match),result=results[ref.match];if(!m||!result)return null;
  const a=resolve(m.a),b=resolve(m.b);if(a===null||b===null||![a,b].includes(result.winner))return null;
  return ref.out==='lose'?(result.winner===a?b:a):result.winner;
 }
 const pair=m=>[resolve(m.a),resolve(m.b)];
 const source=r=>Number.isInteger(r.slot)?'GROUP '+String.fromCharCode(65+Math.floor(r.slot/(s.participants.length===8?2:4)))+' · '+(r.slot+1):r.match+' '+(r.out==='win'?'WINNER':'LOSER');
 const places=[resolve({match:'GF',out:'win'}),resolve({match:'GF',out:'lose'}),resolve({match:'TP',out:'win'}),resolve({match:'FP',out:'win'})];
 const semis=new Set(g.winnerRounds.at(-1).matches.map(x=>x.id));
 const out=g.matches.filter(m=>results[m.id]&&m.id!=='GF'&&m.id!=='TP'&&!semis.has(m.id)&&m.lane!=='group').map(m=>({player:resolve({match:m.id,out:'lose'}),match:m.id}));
 return {...g,resolve,pair,source,places,out};
}

export {sizes,groupCount,graph,model};
