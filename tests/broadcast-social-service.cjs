const assert=require('node:assert/strict'),fs=require('node:fs'),{stripTypeScriptTypes}=require('node:module');
const policy=require('../supabase/functions/rock-broadcast-social/policy.ts'),dest=require('../supabase/functions/rock-broadcast-social/destinations.ts');
(async()=>{let handler;const rows=[],members=[{id:'22222222-2222-2222-2222-222222222222',real_name:'Member One',team_slug:'rock-esports',is_active:true}],participants=new Map(),egresses=[];let deviceValid=true;const youtubeSettings=new Map();
function query(table){
 if(table==='rock_gameplay_youtube_settings')return {
  upsert:async row=>{youtubeSettings.set(row.owner_id,row);return {data:null};},
  select:()=>({eq:(_,id)=>({maybeSingle:async()=>({data:youtubeSettings.get(id)||null})})})
 };
let op='read',value,filters=[],one=false;const q=new Proxy({},{get(_,k){if(k==='then')return done=>{const all=table==='rock_meeting_members'?members:rows;let selected=all.filter(r=>filters.every(f=>f(r)));if(op==='insert'){const r={ended:false,live:false,join_open:true,blocked:[],egress_state:'idle',expires_at:new Date(Date.now()+21600000).toISOString(),...value};all.push(r);selected=[r];}if(op==='update')selected.forEach(r=>Object.assign(r,value));done({data:one?selected[0]||null:selected,error:null});};if(k==='eq')return (name,v)=>{filters.push(r=>r[name]===v);return q;};if(k==='gt')return (name,v)=>{filters.push(r=>r[name]>v);return q;};if(k==='lt')return (name,v)=>{filters.push(r=>r[name]<v);return q;};if(k==='insert'||k==='update')return v=>{op=k;value=v;return q;};if(k==='maybeSingle')return ()=>{one=true;return q;};return ()=>q;}});return q;}
const createClient=(url,key,opt)=>key==='service'?{from:query,rpc:async()=>({data:deviceValid})}:{auth:{getUser:async()=>({data:{user:opt?.global?.headers?.Authorization==='Bearer OWNER'?{id:'OWNER'}:null}})},rpc:async()=>({data:opt?.global?.headers?.Authorization==='Bearer OWNER'})};
class AccessToken{constructor(k,s,o){this.o=o;}addGrant(g){this.g=g;}async toJwt(){return JSON.stringify({...this.o,sub:this.o.identity,video:this.g});}}
class TokenVerifier{async verify(t){const c=JSON.parse(t);if(c.forged)throw Error('signature');return c;}}
class Rooms{async listRooms(names){return names.map(name=>({name}));}async createRoom(){}async updateRoomMetadata(room,metadata){assert.ok(room);assert.equal(JSON.parse(metadata).rockCohostBackground,'rock');}async listParticipants(room){return participants.get(room)||[];}async getParticipant(room,id){const p=(participants.get(room)||[]).find(p=>p.identity===id);if(!p)throw Error();return p;}async removeParticipant(room,id){participants.set(room,(participants.get(room)||[]).filter(p=>p.identity!==id));}async mutePublishedTrack(){}async deleteRoom(room){participants.delete(room);}}
class Egress{async startRoomCompositeEgress(room,out){egresses.push(out);return {egressId:'EGRESS'};}async stopEgress(){}async listEgress(){return [{egressId:'EGRESS',status:4,error:'invalid stream key',streamResults:[{url:'rtmps://a.rtmps.youtube.com/live2/DO_NOT_EXPOSE',status:2,error:'403 DO_NOT_EXPOSE'}]}];}}
class StreamOutput{constructor(x){Object.assign(this,x);}}
const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',LIVEKIT_URL:'wss://test.invalid',LIVEKIT_API_KEY:'key',LIVEKIT_API_SECRET:'secret'};
const exports={...policy,...dest};const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/rock-broadcast-social/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));new Function('Deno','createClient','AccessToken','TokenVerifier','RoomServiceClient','EgressClient','StreamOutput','StreamProtocol',...Object.keys(exports),source)({env:{get:n=>env[n]},serve:fn=>handler=fn},createClient,AccessToken,TokenVerifier,Rooms,Egress,StreamOutput,{RTMP:1},...Object.values(exports));
const call=async(action,body={},owner=false,mode='watchparty')=>{const r=await handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(owner?{Authorization:'Bearer OWNER'}:{})},body:JSON.stringify({action,mode,...body})}));return {status:r.status,body:await r.json()};};
assert.equal((await call('create')).status,403);const created=await call('create',{},true);assert.equal(created.status,201);const {id,password}=created.body;assert.equal((await call('create',{},true)).body.existing,true);assert.equal((await call('create',{},true,'gameplay')).status,201);assert.equal(rows.length,2);
assert.equal((await call('member-token',{id})).status,403);assert.equal((await call('owner-token',{id})).status,403);
const memberToken=JSON.stringify({sub:members[0].id,metadata:JSON.stringify({rock_private_member:true,device_session_id:'DEVICE'}),video:{roomJoin:true,room:'rock-private-member-messenger'}});
const joined=await call('member-token',{id,member_token:memberToken,display_name:'Visible Name'});assert.equal(joined.status,200);assert.equal(joined.body.identity,'member-'+members[0].id);assert.deepEqual(JSON.parse(joined.body.token).video.canPublishSources,[1,2]);assert.equal(JSON.parse(joined.body.renew_token).video.roomJoin,false);
const room=policy.grant('owner',id).room;participants.set(room,[{identity:joined.body.identity,tracks:[]}]);assert.equal((await call('heartbeat',{id,call_token:joined.body.renew_token})).status,200);deviceValid=false;assert.equal((await call('member-token',{id,member_token:memberToken})).status,403);assert.equal((await call('heartbeat',{id,call_token:joined.body.renew_token})).status,403);deviceValid=true;
assert.equal((await call('cohost-token',{id,password})).status,403);assert.equal((await call('cohost-token',{id,password,member_token:memberToken})).status,200);assert.equal((await call('lock',{id,closed:true})).status,403);await call('lock',{id,closed:true},true);assert.equal((await call('member-token',{id,member_token:memberToken})).status,403);await call('lock',{id,closed:false},true);
members.push({id:'33333333-3333-3333-3333-333333333333',real_name:'New Member',team_slug:'rock-esports',is_active:true});const newToken=JSON.stringify({sub:members[1].id,metadata:JSON.stringify({rock_private_member:true}),video:{roomJoin:true,room:'rock-private-member-messenger'}});assert.equal((await call('member-token',{id,member_token:newToken})).status,200);assert.equal((await call('member-token',{id,member_token:JSON.stringify({forged:true})})).status,403);members[1].is_active=false;assert.equal((await call('member-token',{id,member_token:newToken})).status,403);
await call('remove',{id,identity:joined.body.identity},true);assert.equal((await call('member-token',{id,member_token:memberToken})).status,403);assert.equal((await call('viewer-token',{id})).status,409);const out=policy.grant('output',id).room;participants.set(out,[{identity:'output',tracks:[{type:0},{type:1}]}]);assert.equal((await call('live',{id},true)).status,200);const viewer=await call('viewer-token',{id});assert.equal(viewer.status,200);assert.equal(JSON.parse(viewer.body.token).video.canPublish,false);assert.equal((await call('heartbeat',{id,call_token:viewer.body.renew_token})).status,403);
const destinations={youtube:{server:'rtmps://a.rtmps.youtube.com/live2',key:'FAKE_KEY'}};assert.equal((await call('simulcast',{id,platforms:['youtube'],destinations})).status,403);assert.equal((await call('simulcast',{id,platforms:['youtube'],destinations},true)).status,200);assert.ok(!JSON.stringify(rows).includes('FAKE_KEY'));assert.ok(!JSON.stringify((await call('status')).body).includes(password));assert.equal((await call('leave',{id,call_token:viewer.body.renew_token})).status,403);const host=await call('owner-token',{id},true);assert.equal((await call('leave',{id,call_token:host.body.renew_token})).status,200);assert.equal(rows.find(r=>r.id===id).live,false);await call('stop',{id},true);assert.equal(rows.find(r=>r.id===id).ended,true);assert.equal(rows.find(r=>r.mode==='gameplay').ended,false);
const watchparty=await call('create',{password:'WatchCup27'},true,'watchparty');
assert.equal(watchparty.status,201);
assert.equal((await call('member-token',{id:watchparty.body.id,login:'ROCK',password:'WatchCup27'},false,'watchparty')).status,403);
assert.equal((await call('member-token',{id:watchparty.body.id,login:'ROCK',password:'wrong-password',member_token:memberToken},false,'watchparty')).status,403);
assert.equal((await call('member-token',{id:watchparty.body.id,login:'ROCK',password:'WatchCup27',member_token:memberToken},false,'watchparty')).status,200);
const browserId='44444444-4444-4444-4444-444444444444';
const direct={id:watchparty.body.id,login:'ROCK',password:'WatchCup27',visitor:browserId};
assert.equal((await call('watchparty-token',{...direct,password:'wrong-password'},false,'watchparty')).status,403);
const guest=await call('watchparty-token',direct,false,'watchparty');
assert.equal(guest.status,200);
assert.equal(guest.body.identity,'member-'+browserId);
assert.equal(watchparty.body.capacity,21);
const directRoom=policy.grant('owner',watchparty.body.id).room;
participants.set(directRoom,[{identity:guest.body.identity,tracks:[]}]);
assert.equal((await call('heartbeat',{id:watchparty.body.id,call_token:guest.body.renew_token},false,'watchparty')).status,200);
participants.set(directRoom,Array.from({length:20},(_,i)=>({identity:'member-capacity-'+i,tracks:[]})));
assert.equal((await call('watchparty-token',direct,false,'watchparty')).status,409);
participants.delete(directRoom);
const rotated=await call('create',{password:'WatchCup28'},true,'watchparty');
assert.equal(rotated.body.id,watchparty.body.id);
assert.equal((await call('member-token',{id:watchparty.body.id,login:'ROCK',password:'WatchCup27',member_token:memberToken},false,'watchparty')).status,403);
assert.equal((await call('member-token',{id:watchparty.body.id,login:'ROCK',password:'WatchCup28',member_token:memberToken},false,'watchparty')).status,200);
const gameplay=rows.find(r=>r.mode==='gameplay');
const gid=gameplay.id;
assert.equal((await call('cohost-token',{id:gid,password:'a'.repeat(48)},false,'gameplay')).status,403);
assert.equal((await call('cohost-token',{id:gid,login:'ROCK',password:'a'.repeat(48)},false,'gameplay')).status,403);
await call('stop',{id:gid},true,'gameplay');
assert.equal((await call('create',{password:'weak'},true,'gameplay')).status,400);
const chosen='RockCup27';
const createdGameplay=await call('create',{password:chosen},true,'gameplay');
assert.equal(createdGameplay.status,201);
assert.equal((await call('cohost-token',{id:createdGameplay.body.id,login:'BAD',password:chosen},false,'gameplay')).status,403);
const cohost=await call('cohost-token',{id:createdGameplay.body.id,login:'ROCK',password:chosen},false,'gameplay');
assert.equal(cohost.status,200);
assert.deepEqual(JSON.parse(cohost.body.token).video.canPublishSources,[1,2]);
assert.equal(JSON.stringify(rows).includes(chosen),false);
const updated=await call('create',{password:'RockCup28'},true,'gameplay');
assert.equal(updated.body.id,createdGameplay.body.id);
assert.equal((await call('cohost-token',{id:updated.body.id,login:'ROCK',password:chosen},false,'gameplay')).status,403);
assert.equal((await call('cohost-token',{id:updated.body.id,login:'ROCK',password:'RockCup28'},false,'gameplay')).status,200);
const newOut=policy.grant('output',createdGameplay.body.id).room;
participants.set(newOut,[{identity:'output',tracks:[{type:0},{type:1}]},{identity:'viewer-a'},{identity:'viewer-b'}]);
await call('live',{id:createdGameplay.body.id},true,'gameplay');
assert.equal((await call('status',{},false,'gameplay')).body.viewers,2);
assert.equal((await call('cohost-background',{id:createdGameplay.body.id,background:'rock'},false,'gameplay')).status,403);
assert.equal((await call('cohost-background',{id:createdGameplay.body.id,background:'rock'},true,'gameplay')).status,200);
const savedDest={server:'rtmps://a.rtmps.youtube.com/live2',key:'SAVED_TEST_KEY'};
assert.equal((await call('save-youtube',{destination:savedDest},false,'gameplay')).status,403);
assert.equal((await call('save-youtube',{destination:savedDest},true,'watchparty')).status,404);
const saved=await call('save-youtube',{destination:savedDest},true,'gameplay');
assert.deepEqual(saved.body,{saved:true});
assert.equal(JSON.stringify([...youtubeSettings.values()]).includes(savedDest.key),false);
const savedStream=await call('simulcast',{id:createdGameplay.body.id,platforms:['youtube']},true,'gameplay');
assert.equal(savedStream.status,200);
assert.ok(egresses.at(-1).urls[0].endsWith('/SAVED_TEST_KEY'));
assert.equal((await call('platform-status',{id:createdGameplay.body.id},false,'gameplay')).status,403);
const state=await call('platform-status',{id:createdGameplay.body.id},true,'gameplay');
assert.equal(state.body.state,'failed');
assert.equal(state.body.destinations[0].platform,'YouTube');
assert.equal(state.body.destinations[0].status,'failed');
assert.doesNotMatch(JSON.stringify(state.body),/DO_NOT_EXPOSE/);
assert.equal((await call('engagement',{id:createdGameplay.body.id,operation:'approve',event:1},false,'gameplay')).status,403);
console.log('PASS: existing Meeting Room signed login, revoked device/inactive/new members, visitor denial/read-only playback, co-host membership, owner lock/remove, isolated modes, website output independent from platforms, key privacy (mock SDK/database).');
})().catch(e=>{console.error(e);process.exit(1)});
