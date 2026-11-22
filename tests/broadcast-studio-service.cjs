const assert=require('node:assert/strict'),fs=require('node:fs'),{stripTypeScriptTypes}=require('node:module');
const policy=require('../supabase/functions/rock-broadcast-studio/policy.ts');
(async()=>{
let handler;const rows=[],participants=new Map(),egresses=[],stopped=[];
const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',LIVEKIT_URL:'wss://live.test.invalid',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret',BROADCAST_YOUTUBE_RTMP_URL:'rtmps://example.invalid/youtube/PRIVATE_KEY',BROADCAST_TIKTOK_RTMP_URL:'rtmp://example.invalid/tiktok/PRIVATE_KEY'};
function query(){let op='read',value,filters=[],one=false;const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>{let selected=rows.filter(r=>filters.every(f=>f(r)));if(op==='insert'){if(rows.some(r=>!r.ended))return resolve({error:{message:'active'}});const r={...value,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+21600000).toISOString(),ended:false,live:false,cohost_enabled:true,egress_state:'idle'};rows.push(r);selected=[r];}if(op==='update')selected.forEach(r=>Object.assign(r,value));return resolve({data:one?selected[0]||null:selected,error:null});};if(key==='eq')return (k,v)=>{filters.push(r=>r[k]===v);return q;};if(key==='gt')return (k,v)=>{filters.push(r=>r[k]>v);return q;};if(key==='lt')return (k,v)=>{filters.push(r=>r[k]<v);return q;};if(key==='insert'||key==='update')return v=>{op=key;value=v;return q;};if(key==='maybeSingle')return ()=>{one=true;return q;};return ()=>q;}});return q;}
const createClient=(url,key,opts)=>key==='service'?{from:()=>query(),rpc:async(name)=>({data:name==='rock_tournament_cohost_attempt'?true:{likes:0,comments:[],comment_count:0}})}:{auth:{getUser:async jwt=>({data:{user:jwt?{id:jwt==='owner'?'OWNER':'OTHER'}:null}})},rpc:async()=>({data:opts?.global?.headers?.Authorization==='Bearer owner'})};
class AccessToken{constructor(k,s,o){this.o=o;}addGrant(g){this.g=g;}async toJwt(){return JSON.stringify({identity:this.o.identity,grant:this.g,ttl:this.o.ttl});}}
class Rooms{async listRooms(names){return names.map(name=>({name}));}async createRoom(){}async listParticipants(room){return participants.get(room)||[];}async deleteRoom(room){participants.delete(room);}async removeParticipant(room,id){participants.set(room,(participants.get(room)||[]).filter(p=>p.identity!==id));}}
class Egress{async startRoomCompositeEgress(room,out){egresses.push({room,out});return {egressId:'EGRESS1'};}async stopEgress(id){stopped.push(id);}}
class StreamOutput{constructor(options){Object.assign(this,options);}}
let source=fs.readFileSync('supabase/functions/rock-broadcast-studio/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');source=stripTypeScriptTypes(source);
new Function('Deno','createClient','AccessToken','RoomServiceClient','EgressClient','StreamOutput','StreamProtocol',...Object.keys(policy),source)({env:{get:key=>env[key]},serve:fn=>handler=fn},createClient,AccessToken,Rooms,Egress,StreamOutput,{RTMP:0},...Object.values(policy));
const call=async(action,extra={},owner=false)=>{const response=await handler(new Request('https://test.invalid/studio',{method:'POST',headers:{'Content-Type':'application/json',...(owner?{Authorization:'Bearer owner'}:{})},body:JSON.stringify({action,...extra})}));return {status:response.status,body:await response.json()};};
assert.equal((await call('create')).status,403);const created=await call('create',{},true);assert.equal(created.status,201);const {id,password}=created.body;assert.notEqual(rows[0].invite_hash,password);
assert.equal((await call('cohost-token',{id,password:'wrong'})).status,403);const cohost=await call('cohost-token',{id,password});assert.deepEqual(JSON.parse(cohost.body.token).grant.canPublishSources,[1,2]);
assert.equal((await call('set-cohost-password',{id,password:'TourCup27'})).status,403);
assert.equal((await call('set-cohost-password',{id,password:'TourCup27'},true)).status,200);
assert.equal((await call('cohost-token',{password:'TourCup27'})).status,200);
assert.equal((await call('cohost-token',{password:'TourCup27'})).status,200);
assert.equal((await call('cohost-token',{password:'bad-pass-1'})).status,403);
assert.equal((await call('engagement',{id,visitor:'11111111-1111-1111-1111-111111111111',operation:'read'})).status,200);
assert.equal((await call('engagement',{id,visitor:'11111111-1111-1111-1111-111111111111',operation:'approve',event:1})).status,403);
const owner=await call('owner-token',{id},true);assert.equal(owner.status,200);assert.equal((await call('output-token',{id})).status,403);assert.equal((await call('viewer-token',{id})).status,409);assert.equal((await call('live',{id},true)).status,409);
const outputRoom=policy.grantFor('output',id).room;participants.set(outputRoom,[{identity:'output',tracks:[{type:0},{type:1}]}]);assert.equal((await call('live',{id},true)).status,200);
const viewer=await call('viewer-token',{id});assert.equal(viewer.status,200);assert.equal(JSON.parse(viewer.body.token).grant.canPublish,false);assert.ok(!JSON.stringify((await call('status')).body).includes(password));
assert.equal((await call('simulcast',{id,platforms:['youtube','tiktok']},true)).status,200);assert.equal(egresses.length,1);assert.equal(egresses[0].out.urls.length,2);assert.equal((await call('simulcast',{id,platforms:['youtube']},true)).status,409);assert.ok(!JSON.stringify((await call('status')).body).includes('PRIVATE_KEY'));
assert.equal((await call('stop-simulcast',{id},true)).status,200);assert.deepEqual(stopped,['EGRESS1']);assert.equal(rows[0].live,true);
env.BROADCAST_YOUTUBE_RTMP_URL='';env.BROADCAST_TIKTOK_RTMP_URL='';
const credentials={youtube:{server:'rtmps://a.rtmps.youtube.com/live2',key:'TEST_PRIVATE_KEY'}};
assert.equal((await call('simulcast',{id,platforms:['youtube'],destinations:credentials})).status,403);
for(const server of ['https://a.rtmps.youtube.com/live2','rtmp://127.0.0.1/live','rtmp://a.rtmp.youtube.com.evil.test/live','rtmp://user:pass@a.rtmp.youtube.com/live'])assert.equal((await call('simulcast',{id,platforms:['youtube'],destinations:{youtube:{server,key:'TEST_PRIVATE_KEY'}}},true)).status,400);
const direct=await call('simulcast',{id,platforms:['youtube'],destinations:credentials},true);assert.equal(direct.status,200);assert.equal(egresses.at(-1).out.urls[0],'rtmps://a.rtmps.youtube.com/live2/TEST_PRIVATE_KEY');assert.ok(!JSON.stringify(direct.body).includes('TEST_PRIVATE_KEY'));assert.ok(!JSON.stringify(rows).includes('TEST_PRIVATE_KEY'));assert.ok(!JSON.stringify((await call('status')).body).includes('TEST_PRIVATE_KEY'));await call('stop-simulcast',{id},true);
assert.equal((await call('revoke-cohost',{id},true)).status,200);assert.equal((await call('cohost-token',{id,password})).status,403);
assert.equal((await call('pause',{id},true)).status,200);assert.equal(rows[0].live,false);assert.equal((await call('viewer-token',{id})).status,409);
assert.equal((await call('stop',{id},true)).status,200);assert.equal((await call('owner-token',{id},true)).status,404);
console.log('PASS: studio endpoint owner authorization, invitation/role limits, live media preflight, viewer read-only grant, simulcast duplicate guard, key privacy, pause/stop/revoke. External SDK and database mocked; no deployment.');
})().catch(e=>{console.error(e);process.exit(1)});
