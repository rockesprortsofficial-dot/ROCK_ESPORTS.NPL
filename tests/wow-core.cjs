const assert=require('node:assert/strict');
const C=require('../rock-wow-core.js');
for(let n=2;n<=96;n++){
 const s=C.fresh(2);s.seeds=Array.from({length:n},(_,i)=>'t'+i);
 let m=C.bracket(s);
 const initial=m.rounds[0].flatMap(x=>m.pair(x)).filter(Boolean);
 assert.equal(new Set(initial).size,n);assert.equal(initial.length,n);
 for(const row of m.rounds){for(const match of row){m=C.bracket(s);const pair=m.pair(match);if(pair.every(Boolean))C.result(s,match.id,pair[0]);}}
 m=C.bracket(s);if(m.third){const pair=m.pair(m.third);if(pair.every(Boolean))C.result(s,'THIRD',pair[0]);}
 m=C.bracket(s);assert.ok(m.places[0]);assert.ok(m.places[1]);assert.equal(new Set(m.places.filter(Boolean)).size,Math.min(3,n));
 if(n>=4){const first=m.rounds[0].find(x=>m.pair(x).every(Boolean));C.result(s,first.id,m.pair(first)[1]);assert.equal(s.results[m.rounds.at(-1)[0].id],undefined);assert.equal(s.results.THIRD,undefined);}
}
for(const mode of [2,3,4]){const s=C.fresh(mode);s.teams=Array.from({length:17},(_,i)=>({id:'t'+i}));s.groups.push({id:'c',name:'C'});s.draw={order:s.teams.map(t=>t.id)};const g=C.groups(s);assert.equal(g.flatMap(x=>x.teams).length,17);assert.ok(Math.max(...g.map(x=>x.teams.length))-Math.min(...g.map(x=>x.teams.length))<=1);C.reset(s);assert.equal(s.draw,null);assert.deepEqual(s.seeds,[]);}
console.log('PASS: 2–96 teams, byes, top three, corrected winners invalidate dependent results, balanced groups, mode reset');

