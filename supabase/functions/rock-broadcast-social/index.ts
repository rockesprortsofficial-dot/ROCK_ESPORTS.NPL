import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {AccessToken,TokenVerifier,RoomServiceClient,EgressClient,StreamOutput,StreamProtocol} from 'npm:livekit-server-sdk@2.13.3';
import {modes,actions,grant,digest,publicStatus} from './policy.ts';
import {streamDestination} from './destinations.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'POST only'},405);
 try{
 const text=await req.text();if(text.length>8192)return reply({error:'Request too large'},413);
 const b=JSON.parse(text),action=String(b.action||''),mode=String(b.mode||'');if(!actions.includes(action)||!modes.includes(mode))return reply({error:'Invalid action or mode'},400);
 const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',lk=Deno.env.get('LIVEKIT_URL')||'',key=Deno.env.get('LIVEKIT_API_KEY')||'',secret=Deno.env.get('LIVEKIT_API_SECRET')||'';
 if(!url||!service||!anon||!lk||!key||!secret)return reply({error:'Broadcast call service is not configured'},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),endpoint=lk.replace(/^wss:/,'https:').replace(/^ws:/,'http:'),rooms=new RoomServiceClient(endpoint,key,secret),egress=new EgressClient(endpoint,key,secret);
 const capacity=Math.min(500,Math.max(2,Number(Deno.env.get('BROADCAST_SOCIAL_MAX_PARTICIPANTS'))||100));
 const checked=async(q:any)=>{const r=await q;if(r.error)throw Error('DATABASE');return r.data;};
 const owner=async()=>{const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)throw Error('OWNER');const scoped=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false}});const {data,error}=await scoped.auth.getUser(jwt);if(error||!data.user||(await scoped.rpc('rock_broadcast_is_owner')).data!==true)throw Error('OWNER');return data.user.id;};
 const latest=()=>checked(db.from('rock_broadcast_social_sessions').select('*').eq('mode',mode).eq('ended',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle());
 if(action==='status'){
  const row=await latest(),status=publicStatus(row);
  if(mode!=='gameplay')return reply(status);
  let viewers:number|null=0;
  if(status.live){
   try{const participants=await rooms.listParticipants(grant('viewer',row.id).room);
    viewers=participants.filter(p=>p.identity.startsWith('viewer-')).length;
   }catch(_){viewers=null;}
  }
  return reply({...status,viewers});
 }
 if(action==='create'){
  const ownerId=await owner();const active=await latest();if(active)return reply({...publicStatus(active),existing:true,capacity});
  await checked(db.from('rock_broadcast_social_sessions').update({ended:true,live:false}).eq('mode',mode).eq('ended',false).lt('expires_at',new Date().toISOString()));
  const supplied=mode==='gameplay'?String(b.password||''):'';
  if(supplied&&(!/^[0-9a-f]{48}$/.test(supplied)||new Set(supplied).size<10))return reply({error:'Use a randomly generated 48-character hexadecimal password'},400);
  const id=crypto.randomUUID(),password=supplied||Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,'0')).join('');
  await checked(db.from('rock_broadcast_social_sessions').insert({id,mode,owner_id:ownerId,invite_hash:await digest(id+':'+password)}));return reply({id,mode,password,capacity},201);
 }
 let id=String(b.id||'');if(!id&&['member-token','viewer-token'].includes(action))id=(await latest())?.id||'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Owner must start this mode first'},404);
 const row=await checked(db.from('rock_broadcast_social_sessions').select('*').eq('id',id).eq('mode',mode).maybeSingle());
 if(!row||row.ended||Date.parse(row.expires_at)<=Date.now())return reply({error:'This call has ended or expired'},404);
 if(action==='engagement'){
  if(mode!=='gameplay')return reply({error:'Gameplay only'},404);
  const operation=String(b.operation||'');
  if(!['read','like','comment','approve','hide','block'].includes(operation))return reply({error:'Invalid interaction'},400);
  const moderating=['approve','hide','block'].includes(operation);
  const ownerId=moderating||b.moderator===true?await owner():null;
  if(ownerId&&ownerId!==row.owner_id)return reply({error:'Owner access required'},403);
  const visitor=String(b.visitor||'');
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(visitor))return reply({error:'Invalid visitor ID'},400);
  if(moderating&&(!Number.isSafeInteger(b.event)||b.event<=0))return reply({error:'Invalid comment'},400);
  const result=await checked(db.rpc('rock_gameplay_interact',{
   p_session:id,p_action:operation,p_visitor:visitor,
   p_name:operation==='comment'?String(b.name||'').trim():null,
   p_message:operation==='comment'?String(b.message||'').trim():null,
   p_event:moderating?b.event:null,p_owner:ownerId
  }));
  return reply(result,result.error?400:200);
 }
 const callRoom=grant('owner',id).room,outRoom=grant('output',id).room;
 const activeMember=async(memberId:string)=>checked(db.from('rock_meeting_members').select('id,real_name,is_active').eq('id',memberId).eq('team_slug','rock-esports').eq('is_active',true).maybeSingle());
 const token=async(role:string,identity:string,name:string)=>{const t=new AccessToken(key,secret,{identity,name,ttl:'60s',metadata:JSON.stringify({rock_social:true,role,session:id})});t.addGrant(grant(role,id));const ticket=new AccessToken(key,secret,{identity,name,ttl:'6h',metadata:JSON.stringify({rock_social:true,role,session:id,purpose:'heartbeat'})});ticket.addGrant({room:grant('owner',id).room,roomJoin:false,canPublish:false,canSubscribe:false});return {id,mode,token:await t.toJwt(),renew_token:await ticket.toJwt(),server_url:lk,identity,role,name,capacity};};
 if(action==='viewer-token'){
  if(!row.live)return reply({error:'Website broadcast has not started'},409);
  const p=await rooms.listParticipants(outRoom).catch(()=>[]);if(!p.some(x=>x.identity==='output'&&x.tracks.some(t=>t.type===1)))return reply({error:'Broadcaster is reconnecting'},409);
  return reply(await token('viewer','viewer-'+crypto.randomUUID(),'Viewer'));
 }
 if(action==='member-token'||action==='cohost-token'){
  if(!row.join_open)return reply({error:'Owner has closed new entries'},403);
  let member:any=null,deviceSession:any=null;
  if(mode==='watchparty'||action==='member-token'){
   if(mode!=='watchparty')return reply({error:'Gameplay uses a private co-host invitation'},403);
   try{const claims=await new TokenVerifier(key,secret).verify(String(b.member_token||'')),meta=JSON.parse(String(claims.metadata||'{}'));
    if(meta.rock_private_member!==true||claims.video?.roomJoin!==true||!String(claims.video?.room||'').startsWith('rock-private-')||!claims.sub)throw Error();
    if(meta.device_session_id&&!(await checked(db.rpc('rock_member_session_valid',{p_id:meta.device_session_id,p_member:claims.sub}))))throw Error();
    deviceSession=meta.device_session_id||null;member=await activeMember(String(claims.sub));if(!member)throw Error();
   }catch(_){return reply({error:'Sign in through the existing ROCK ESPORTS Meeting Room. Active membership is required.'},403);}
  }
  if(action==='cohost-token'&&mode==='gameplay'&&b.login!=='ROCK')return reply({error:'Invalid co-host invitation'},403);
  if(action==='cohost-token'&&(!/^[0-9a-f]{48}$/.test(String(b.password||''))||await digest(id+':'+b.password)!==row.invite_hash))return reply({error:'Invalid co-host invitation'},403);
  const identity=action==='cohost-token'?'cohost':'member-'+member.id;
  if(row.blocked.includes(identity))return reply({error:'Owner has removed this participant'},403);
  const present=await rooms.listParticipants(callRoom).catch(()=>[]);if(present.length>=capacity&&!present.some(p=>p.identity===identity))return reply({error:'Call capacity reached. Owner can increase server capacity.'},409);
  const display=String(b.display_name||member?.real_name?.split(' ')[0]||'CO-HOST').replace(/[<>\u0000-\u001f]/g,'').slice(0,40);
  const result=await token(action==='cohost-token'?'cohost':'member',identity,display);
  // Membership identity is signed separately from the display name and co-host room identity.
  if(member){const t=new AccessToken(key,secret,{identity,name:display,ttl:'60s',metadata:JSON.stringify({rock_social:true,role:result.role,session:id,member_id:member.id})});t.addGrant(grant(result.role,id));result.token=await t.toJwt();const ticket=new AccessToken(key,secret,{identity,name:display,ttl:'6h',metadata:JSON.stringify({rock_social:true,role:result.role,session:id,member_id:member.id,device_session_id:deviceSession,purpose:'heartbeat'})});ticket.addGrant({room:callRoom,roomJoin:false,canPublish:false,canSubscribe:false});result.renew_token=await ticket.toJwt();}
  return reply(result);
 }
 if(action==='leave'){
  try{const c=await new TokenVerifier(key,secret).verify(String(b.call_token||'')),meta=JSON.parse(String(c.metadata||'{}'));if(meta.rock_social!==true||meta.purpose!=='heartbeat'||meta.session!==id||c.video?.roomJoin!==false||c.video?.room!==callRoom||!['member','cohost','owner'].includes(meta.role))return reply({error:'Call access required'},403);
   if(meta.role==='owner'){await checked(db.from('rock_broadcast_social_sessions').update({live:false}).eq('id',id));if(row.egress_id)await egress.stopEgress(row.egress_id);if((await rooms.listRooms([outRoom])).length)await rooms.deleteRoom(outRoom);await checked(db.from('rock_broadcast_social_sessions').update({egress_id:null,egress_state:'idle'}).eq('id',id));}
   try{await rooms.removeParticipant(callRoom,String(c.sub));}catch(_){}return reply({ok:true});
  }catch(_){return reply({error:'Could not confirm call/output cleanup'},403);}
 }
 if(action==='heartbeat'){
  try{const c=await new TokenVerifier(key,secret).verify(String(b.call_token||'')),meta=JSON.parse(String(c.metadata||'{}'));
   if(meta.rock_social!==true||meta.purpose!=='heartbeat'||c.video?.roomJoin!==false||meta.session!==id||c.video?.room!==callRoom||!['member','cohost','owner'].includes(meta.role)||row.blocked.includes(String(c.sub)))throw Error();
   if(meta.role!=='owner'&&mode==='watchparty'&&(!meta.member_id||!await activeMember(meta.member_id)))throw Error();
   if(meta.device_session_id&&!(await checked(db.rpc('rock_member_session_valid',{p_id:meta.device_session_id,p_member:meta.member_id}))))throw Error();await rooms.getParticipant(callRoom,String(c.sub));
   const renewed=new AccessToken(key,secret,{identity:String(c.sub),name:String(c.name||'Member'),ttl:'60s',metadata:String(c.metadata)});renewed.addGrant(grant(meta.role,id));return reply({token:await renewed.toJwt(),join_open:row.join_open});
  }catch(_){return reply({error:'Call membership expired or revoked; sign in again'},403);}
 }
 const ownerId=await owner();if(ownerId!==row.owner_id)return reply({error:'Owner access required'},403);
 if(action==='owner-token'){if(!(await rooms.listRooms([callRoom])).length)await rooms.createRoom({name:callRoom,maxParticipants:capacity,emptyTimeout:300});return reply(await token('owner','owner','HOST'));}
 if(action==='output-token')return reply(await token('output','output','Broadcast'));
 if(action==='lock'){await checked(db.from('rock_broadcast_social_sessions').update({join_open:!b.closed}).eq('id',id));return reply({join_open:!b.closed});}
 if(action==='remove'||action==='mute'){
  const identity=String(b.identity||'');if(!/^(cohost|member-[0-9a-f-]{36})$/.test(identity))return reply({error:'Choose a co-host/member'},400);
  if(action==='remove'){await checked(db.from('rock_broadcast_social_sessions').update({blocked:[...new Set([...row.blocked,identity])]}).eq('id',id));await rooms.removeParticipant(callRoom,identity);}
  else {const p=await rooms.getParticipant(callRoom,identity);for(const t of p.tracks)if(t.type===0)await rooms.mutePublishedTrack(callRoom,identity,t.sid,true);}
  return reply({ok:true});
 }
 if(action==='live'){const p=await rooms.listParticipants(outRoom);if(!p.some(x=>x.identity==='output'&&x.tracks.some(t=>t.type===1)&&x.tracks.some(t=>t.type===0)))return reply({error:'Publish composed video/audio first'},409);await checked(db.from('rock_broadcast_social_sessions').update({live:true}).eq('id',id));return reply({live:true});}
 if(action==='pause'||action==='stop'||action==='stop-simulcast'){
  // Mark website output unavailable before stopping any transport.
  if(action!=='stop-simulcast')await checked(db.from('rock_broadcast_social_sessions').update({live:false,...(action==='stop'?{join_open:false}:{})}).eq('id',id));
  let failed=false;if(row.egress_id)try{await egress.stopEgress(row.egress_id);}catch(_){failed=true;}
  if(action!=='stop-simulcast')for(const name of action==='stop'?[callRoom,outRoom]:[outRoom])try{if((await rooms.listRooms([name])).length)await rooms.deleteRoom(name);}catch(_){failed=true;}
  if(failed)return reply({error:'Could not confirm every stream stopped. Retry Stop.'},502);
  await checked(db.from('rock_broadcast_social_sessions').update({egress_id:null,egress_state:'idle',...(action==='stop'?{ended:true}:{})}).eq('id',id));return reply({ok:true});
 }
 if(action==='simulcast'){
  if(!row.live)return reply({error:'Start website output first'},409);
  const selected=Array.isArray(b.platforms)?[...new Set<string>(b.platforms)]:[];if(!selected.length||selected.some(p=>!['youtube','tiktok'].includes(p)))return reply({error:'Select YouTube/TikTok'},400);
  let urls:string[];try{urls=selected.map(p=>b.destinations?.[p]?streamDestination(p,b.destinations[p]):Deno.env.get(p==='youtube'?'BROADCAST_YOUTUBE_RTMP_URL':'BROADCAST_TIKTOK_RTMP_URL')||'');}catch(_){return reply({error:'Invalid private platform RTMP settings'},400);}
  if(urls.some(u=>!/^rtmps?:\/\//.test(u)))return reply({error:'Enter platform RTMP server/key; a channel link is not a streaming destination'},503);
  const claim=await checked(db.from('rock_broadcast_social_sessions').update({egress_state:'starting'}).eq('id',id).eq('egress_state','idle').select('id').maybeSingle());if(!claim)return reply({error:'Platform output is already starting/running'},409);
  try{const result=await egress.startRoomCompositeEgress(outRoom,new StreamOutput({protocol:StreamProtocol.RTMP,urls}),{layout:'speaker'});const saved=await checked(db.from('rock_broadcast_social_sessions').update({egress_id:result.egressId,egress_state:'running'}).eq('id',id).eq('live',true).eq('ended',false).eq('egress_state','starting').select('id').maybeSingle());if(!saved){await egress.stopEgress(result.egressId);throw Error();}return reply({started:true,platforms:selected});}
  catch(_){await db.from('rock_broadcast_social_sessions').update({egress_state:'idle'}).eq('id',id).eq('egress_state','starting');return reply({error:'Platform streaming failed; check permissions and egress availability'},502);}
 }
 return reply({error:'Unknown action'},400);
 }catch(e){return reply({error:e instanceof Error&&e.message==='OWNER'?'Owner access required':'Broadcast call service unavailable'},e instanceof Error&&e.message==='OWNER'?403:500);}
});
