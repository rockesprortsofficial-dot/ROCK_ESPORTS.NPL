const assert=require('node:assert/strict'),C=require('../rock-broadcast-core.js');
const s=C.blank();assert.equal(s.teams.length,16);assert.equal(s.teams.flatMap(t=>t.players).length,64);C.validate(s);
for(let i=0;i<16;i++)s.teams[i].placement=i+1;
assert.deepEqual(C.ranking(s.teams).map(t=>t.placementPoints),[10,6,5,4,3,2,1,1,0,0,0,0,0,0,0,0]);
s.teams[15].players[0].kills=11;assert.equal(C.ranking(s.teams)[0].id,'A16');
s.teams[15].players[0].kills=10;assert.equal(C.ranking(s.teams)[0].id,'A16'); // elimination tie-break
s.teams[0].players[0].status='out';s.teams[0].players[1].status='knock';assert.equal(C.stats(s.teams).alive,62);assert.equal(C.stats(s.teams).knocked,1);
s.teams[0].players[0].pubg_uid='secret';s.teams[0].players[0].realName='Private';assert.ok(!JSON.stringify(C.publicState(s)).includes('secret'));assert.ok(!JSON.stringify(C.publicState(s)).includes('realName'));
const bad=structuredClone(s);bad.teams[1].placement=1;assert.throws(()=>C.validate(bad),/unique/);bad.teams[1].placement=null;assert.throws(()=>C.validate(bad,true),/Confirm/);
bad.teams[1].placement=2;bad.teams[1].players[0].kills=-1;assert.throws(()=>C.validate(bad),/Invalid/);
const start=1000;assert.equal(C.promo(start+899999,start,true).visible,false);assert.equal(C.promo(start+900000,start,true).visible,true);assert.equal(C.promo(start+933999,start,true).visible,true);assert.equal(C.promo(start+934000,start,true).visible,false);assert.equal(C.promo(start+1800000,start,true).visible,true);assert.equal(C.promo(start+900000,start,false).visible,false);
console.log('PASS: scoring, ranking, validation, 64 slots, privacy projection, promotion boundaries');
const old=C.blank();old.teams.forEach((t,i)=>t.placement=i+1);const corrected=structuredClone(old);corrected.teams[15].players[0].kills=12;
const totals=C.overall([{verified:true,created_at:'2026-01-01',snapshot:old},{verified:true,created_at:'2026-01-02',snapshot:corrected}],old.tournament);
assert.equal(totals[0].name,'TEAM 16');assert.equal(totals[0].total,12);assert.equal(totals[0].matches,1);console.log('PASS: cumulative ranking uses latest verified correction without double-counting');
