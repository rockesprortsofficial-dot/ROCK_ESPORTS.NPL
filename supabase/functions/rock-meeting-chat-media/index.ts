import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TokenVerifier, AccessToken } from "npm:livekit-server-sdk@2.13.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-rock-room","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const bucket="rock-meeting-media";
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]);
const reply=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function privateMessenger(req:Request,claims:{sub?:string;metadata?:string},db:any,key:string,secret:string){
 const me=String(claims.sub||'');const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 const {data:actor,error:actorError}=await db.from('rock_meeting_members').select('id,real_name').eq('id',me).eq('team_slug','rock-esports').eq('is_active',true).maybeSingle();if(actorError||!actor)return reply({error:'Active approved members only'},403);
 const form=(req.headers.get('content-type')||'').includes('multipart/form-data')?await req.formData():null;
 const b=form?Object.fromEntries(form.entries()):await req.json().catch(()=>({}));const action=String(b.action||'');const fail=(message:string,status=400)=>reply({error:message},status);
 const checked=async(query:any)=>{const r=await query;if(r.error)throw r.error;return r.data;};
 const member=async(id:unknown)=>{if(!uuid(id))return false;return !!await checked(db.from('rock_pm_members').select('room_id').eq('room_id',id).eq('member_id',me).maybeSingle());};
 const decorate=async(rows:any[])=>Promise.all(rows.map(async m=>{let media_url=null;if(m.media_path){const {data,error}=await db.storage.from('rock-private-messenger-media').createSignedUrl(m.media_path,1800);if(error)throw error;media_url=data.signedUrl;}return {...m,media_url};}));
 if(action==='sync'){
  const actions=['rooms','calls',...(b.include_directory?['directory']:[]),...(b.room_id?['messages']:[])];const results=await Promise.all(actions.map(async action=>{const response=await privateMessenger(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,room_id:b.room_id})}),claims,db,key,secret);return {action,status:response.status,data:await response.json()};}));
  const failed=results.find(r=>r.status!==200);if(failed)return reply(failed.data,failed.status);
  return reply(Object.fromEntries(results.map(r=>[r.action,r.data])));
 }
 if(action==='directory'){const people=await checked(db.from('rock_meeting_members').select('id,real_name').eq('team_slug','rock-esports').eq('is_active',true).order('real_name'));return reply({me:actor,members:people});}
 if(action==='create_room'){if(!Array.isArray(b.members)||!b.members.length||b.members.some((x:unknown)=>!uuid(x)))return fail('Choose approved members');const id=await checked(db.rpc('rock_pm_create_room',{p_actor:me,p_people:b.members,p_title:String(b.title||'').trim()}));return reply({room_id:id});}
 if(action==='rooms'){
  const own=await checked(db.from('rock_pm_members').select('room_id,last_read_at').eq('member_id',me));const ids=own.map((x:any)=>x.room_id);if(!ids.length)return reply({rooms:[]});
  const rooms=await checked(db.from('rock_pm_rooms').select('id,kind,title,created_at').in('id',ids));const members=await checked(db.from('rock_pm_members').select('room_id,member_id,last_read_at,typing_until').in('room_id',ids));const messages=await checked(db.from('rock_pm_messages').select('id,room_id,sender_id,body,media_type,created_at').in('room_id',ids).order('created_at',{ascending:false}).limit(500));
  return reply({rooms:rooms.map((r:any)=>({...r,members:members.filter((m:any)=>m.room_id===r.id),last:messages.find((m:any)=>m.room_id===r.id)||null,last_read_at:own.find((m:any)=>m.room_id===r.id)?.last_read_at}))});
 }
 if(action==='calls'){
  await checked(db.from('rock_pm_calls').update({status:'ended'}).neq('status','ended').lt('expires_at',new Date().toISOString()));
  const memberships=await checked(db.from('rock_pm_members').select('room_id').eq('member_id',me));const ids=memberships.map((m:any)=>m.room_id);if(!ids.length)return reply({calls:[],invites:[]});
  const calls=await checked(db.from('rock_pm_calls').select('*').in('room_id',ids).order('created_at',{ascending:false}).limit(30));const invites=calls.length?await checked(db.from('rock_pm_call_invites').select('*').eq('member_id',me).in('call_id',calls.map((c:any)=>c.id))):[];return reply({calls,invites});
 }
 let roomId=b.room_id;if(action.startsWith('call_')&&action!=='call_start'){if(!uuid(b.call_id))return fail('Invalid call');const call=await checked(db.from('rock_pm_calls').select('*').eq('id',b.call_id).maybeSingle());if(!call)return fail('Call unavailable',404);roomId=call.room_id;b._call=call;}
 if(!await member(roomId))return fail('This conversation is private',403);
 if(action==='messages'){
  let q=db.from('rock_pm_messages').select('*').eq('room_id',roomId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
  if(b.before){if(!uuid(b.before.id)||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(b.before.at)))return fail('Invalid message cursor');q=q.or(`created_at.lt.${b.before.at},and(created_at.eq.${b.before.at},id.lt.${b.before.id})`);}
  const messages=await checked(q);const ids=messages.map((m:any)=>m.id);const reactions=ids.length?await checked(db.from('rock_pm_reactions').select('*').in('message_id',ids)):[];
  if(!b.before)await checked(db.from('rock_pm_members').update({last_read_at:new Date().toISOString()}).eq('room_id',roomId).eq('member_id',me));
  const members=await checked(db.from('rock_pm_members').select('member_id,last_read_at,typing_until').eq('room_id',roomId));return reply({messages:await decorate(messages.reverse()),reactions,members,has_more:messages.length===60});
 }
 if(action==='typing'){await checked(db.from('rock_pm_members').update({typing_until:new Date(Date.now()+5000).toISOString()}).eq('room_id',roomId).eq('member_id',me));return reply({ok:true});}
 if(action==='send'){
  const body=String(b.body||'').trim();if(body.length>2000||!uuid(b.id))return fail('Message is too long or invalid');const media=form?.get('media');const file=media instanceof File&&media.size>0?media:null;if(!body&&!file)return fail('Write a message or attach media');
  const exists=await checked(db.from('rock_pm_messages').select('*').eq('id',b.id).maybeSingle());if(exists){if(exists.sender_id!==me||exists.room_id!==roomId)return fail('Invalid message id',403);return reply({message:(await decorate([exists]))[0]});}
  if(b.reply_id){if(!uuid(b.reply_id))return fail('Invalid reply');const parent=await checked(db.from('rock_pm_messages').select('id').eq('id',b.reply_id).eq('room_id',roomId).maybeSingle());if(!parent)return fail('Reply is unavailable');}
  const mime=file?.type.split(';')[0]||'';const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a'};
  if(file&&(!ext[mime]||file.size>25*1024*1024))return fail('Choose supported media up to 25 MB');
  let path:string|null=null;if(file){path=`${roomId}/${b.id}.${ext[mime]}`;const {error}=await db.storage.from('rock-private-messenger-media').upload(path,file,{contentType:mime,upsert:false});if(error)throw error;}
  const {data,error}=await db.from('rock_pm_messages').insert({id:b.id,room_id:roomId,sender_id:me,body,reply_id:b.reply_id||null,media_path:path,media_type:file?mime.split('/')[0]:null}).select('*').single();if(error){if(path)await db.storage.from('rock-private-messenger-media').remove([path]);throw error;}return reply({message:(await decorate([data]))[0]},201);
 }
 if(action==='react'){if(!uuid(b.message_id)||!['👍','❤️','😂','😮','😢','🔥'].includes(b.emoji))return fail('Invalid reaction');const message=await checked(db.from('rock_pm_messages').select('id').eq('room_id',roomId).eq('id',b.message_id).maybeSingle());if(!message)return fail('Message unavailable',404);const prior=await checked(db.from('rock_pm_reactions').select('emoji').eq('message_id',b.message_id).eq('member_id',me).maybeSingle());if(prior?.emoji===b.emoji)await checked(db.from('rock_pm_reactions').delete().eq('message_id',b.message_id).eq('member_id',me));else await checked(db.from('rock_pm_reactions').upsert({message_id:b.message_id,member_id:me,emoji:b.emoji}));return reply({ok:true});}
 if(action==='call_start'){
  if(!['audio','video'].includes(b.mode))return fail('Invalid call mode');await checked(db.from('rock_pm_calls').update({status:'ended'}).eq('room_id',roomId).neq('status','ended').lt('expires_at',new Date().toISOString()));
  const existing=await checked(db.from('rock_pm_calls').select('*').eq('room_id',roomId).neq('status','ended').maybeSingle());if(existing)return reply({call:existing});
  const {data:call,error}=await db.from('rock_pm_calls').insert({room_id:roomId,caller_id:me,mode:b.mode}).select('*').single();if(error)return fail('A call already started. Try joining it.',409);
  const participants=await checked(db.from('rock_pm_members').select('member_id').eq('room_id',roomId).neq('member_id',me));const {error:inviteError}=await db.from('rock_pm_call_invites').insert(participants.map((p:any)=>({call_id:call.id,member_id:p.member_id})));if(inviteError){await db.from('rock_pm_calls').update({status:'ended'}).eq('id',call.id);throw inviteError;}return reply({call});
 }
 const call=b._call;
 if(action==='call_decline'){await checked(db.from('rock_pm_call_invites').update({state:'declined'}).eq('call_id',call.id).eq('member_id',me));const waiting=await checked(db.from('rock_pm_call_invites').select('member_id').eq('call_id',call.id).neq('state','declined'));if(!waiting.length&&call.status==='ringing')await checked(db.from('rock_pm_calls').update({status:'ended'}).eq('id',call.id));return reply({ok:true});}
 if(action==='call_end'){const room=await checked(db.from('rock_pm_rooms').select('kind').eq('id',roomId).single());if(call.caller_id===me||room.kind==='dm')await checked(db.from('rock_pm_calls').update({status:'ended'}).eq('id',call.id));return reply({ok:true});}
 if(action==='call_token'){
  if(call.status==='ended'||Date.parse(call.expires_at)<Date.now())return fail('This call has ended',410);
  if(call.caller_id!==me){await checked(db.from('rock_pm_call_invites').update({state:'accepted'}).eq('call_id',call.id).eq('member_id',me));await checked(db.from('rock_pm_calls').update({status:'active',expires_at:new Date(Date.now()+7200000).toISOString()}).eq('id',call.id).neq('status','ended'));}
  const token=new AccessToken(key,secret,{identity:me,name:actor.real_name,ttl:'2h',metadata:JSON.stringify({rock_private_member:true})});token.addGrant({roomJoin:true,room:'rock-private-call-'+call.id,canPublish:true,canSubscribe:true,canPublishData:true});return reply({token:await token.toJwt(),server_url:Deno.env.get('LIVEKIT_URL')});
 }
 return fail('Unknown messenger action');
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="GET"&&req.method!=="POST")return reply({error:"GET or POST only"},405);
 try{
  const key=Deno.env.get("LIVEKIT_API_KEY")||"", secret=Deno.env.get("LIVEKIT_API_SECRET")||"", url=Deno.env.get("SUPABASE_URL")||"", service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!key||!secret||!url||!service)return reply({error:"Service is not configured"},500);
  const jwt=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()||""; if(!jwt)return reply({error:"Join the meeting first"},401);
  let claims: {sub?:string;name?:string;metadata?:string;video?:{room?:string;roomJoin?:boolean}};
  try { claims=await new TokenVerifier(key,secret).verify(jwt); } catch (_) { return reply({error:"Meeting access expired. Please rejoin."},401); }
  const room=claims.video?.room||"", identity=claims.sub||"", name=(claims.name||identity).slice(0,100);
  if(!identity||!room||claims.video?.roomJoin!==true)return reply({error:"Invalid meeting access"},401);
  if(room.startsWith("rock-private-")){let metadata: {rock_private_member?:boolean}={};try{metadata=JSON.parse(claims.metadata||"{}");}catch(_){}if(metadata.rock_private_member!==true||identity.startsWith("guest-"))return reply({error:"Approved ROCK ESPORTS members only"},403);}
  if(new URL(req.url).searchParams.get('messenger')==='1'){
   let metadata: {rock_private_member?:boolean}={};try{metadata=JSON.parse(claims.metadata||'{}');}catch(_){}
   if(!room.startsWith('rock-private-')||metadata.rock_private_member!==true)return reply({error:'Approved members only'},403);
   const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
   return await privateMessenger(req,claims,db,key,secret);
  }
  const requested=req.method==="GET"?new URL(req.url).searchParams.get("room"):req.headers.get("x-rock-room"); if(requested!==room)return reply({error:"Wrong room"},403);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  if(req.method==="GET"){
   const {data,error}=await db.from("rock_public_meeting_messages").select("id,room_name,sender_id,sender_name,message,media_path,media_type,created_at").eq("room_name",room).order("created_at",{ascending:false}).limit(100); if(error)throw error;
   const messages=await Promise.all((data||[]).map(async m=>{let media_url=null;if(m.media_path){const {data:s}=await db.storage.from(bucket).createSignedUrl(m.media_path,3600);media_url=s?.signedUrl||null;}return {...m,media_url};})); return reply({messages:messages.reverse()});
  }
  let message="",file:File|null=null;
  if((req.headers.get("content-type")||"").includes("multipart/form-data")){const f=await req.formData();message=String(f.get("message")||"").trim().slice(0,2000);const x=f.get("media");if(x instanceof File&&x.size)file=x;}else{const b=await req.json();message=String(b.message||"").trim().slice(0,2000);}
  if(!message&&!file)return reply({error:"Add a message or a photo/video"},400);
  if(file&&(!allowed.has(file.type)||file.size>25*1024*1024))return reply({error:"Photo/video must be supported type and at most 25 MB"},400);
  let media_path:string|null=null,media_type:string|null=null;
  if(file){const ext:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};media_path=room+"/"+crypto.randomUUID()+"."+ext[file.type];media_type=file.type.startsWith("video/")?"video":"image";const {error}=await db.storage.from(bucket).upload(media_path,file,{contentType:file.type});if(error)throw error;}
  const {data,error}=await db.from("rock_public_meeting_messages").insert({room_name:room,sender_id:identity,sender_name:name,message,media_path,media_type}).select("id,room_name,sender_id,sender_name,message,media_path,media_type,created_at").single();if(error){if(media_path)await db.storage.from(bucket).remove([media_path]);throw error;}
  let media_url=null;if(media_path){const {data:s}=await db.storage.from(bucket).createSignedUrl(media_path,3600);media_url=s?.signedUrl||null;}return reply({message:{...data,media_url}},201);
 }catch(e){console.error("Meeting chat/media error",e);return reply({error:"Chat or media could not be saved"},500);}
});