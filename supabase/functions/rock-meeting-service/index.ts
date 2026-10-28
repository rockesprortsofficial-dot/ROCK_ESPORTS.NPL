import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {AccessToken,RoomServiceClient,TokenVerifier} from "npm:livekit-server-sdk@2.13.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function digest(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return reply({error:"POST only"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",lkUrl=Deno.env.get("LIVEKIT_URL")||"",key=Deno.env.get("LIVEKIT_API_KEY")||"",secret=Deno.env.get("LIVEKIT_API_SECRET")||"";
 if(!url||!serviceKey||!lkUrl||!key||!secret)return reply({error:"Meeting service is not configured"},503);
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),rooms=new RoomServiceClient(lkUrl.replace(/^wss:/,"https:").replace(/^ws:/,"http:"),key,secret);
 const form=req.headers.get("content-type")?.includes("multipart/form-data")?await req.formData():null;
 const body=form?{action:form.get("action"),id:form.get("id")}:await req.json(),action=String(body.action||""),bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 let userId:string|null=null;if(bearer){const {data}=await db.auth.getUser(bearer);userId=data.user?.id||null;}
 if(action==="history"){
  if(!userId)return reply({error:"Sign in to see hosted meetings"},401);
  const {data,error}=await db.from("rock_meetings").select("id,title,created_at,expires_at,ended,locked").eq("host_id",userId).order("created_at",{ascending:false}).limit(20);if(error)throw error;return reply({meetings:data});
 }
 if(action==="create"){
  if(!userId)return reply({error:"Sign in through CONNECT or COMMUNITY before creating a meeting"},401);
  const title=String(body.title||"").trim(),password=String(body.password||"");if(title.length<2||title.length>80||password.length<8||password.length>100)return reply({error:"Enter a title (2–80 characters) and password (8–100 characters)"},400);
  const {count,error:countError}=await db.from("rock_meetings").select("id",{count:"exact",head:true}).eq("host_id",userId).gte("created_at",new Date(Date.now()-60000).toISOString());if(countError)throw countError;if((count||0)>=2)return reply({error:"Please wait a minute before creating another meeting"},429);
  const id=crypto.randomUUID(),password_hash=await digest(id+":"+password);const {error}=await db.from("rock_meetings").insert({id,host_id:userId,title,password_hash});if(error)throw error;
  return reply({id,title,max_participants:100},201);
 }
 const id=String(body.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Enter a valid meeting ID"},400);
 const {data:meeting,error}=await db.from("rock_meetings").select("*").eq("id",id).maybeSingle();if(error)throw error;if(!meeting)return reply({error:"This meeting has ended or expired"},404);
 const host=!!userId&&userId===meeting.host_id,roomName="rock-meeting-"+id;
 if(action==="recordings"){
  if(!host){try{const claims=await new TokenVerifier(key,secret).verify(String(body.room_token||""));if(meeting.ended||claims.video?.room!==roomName||!claims.sub)return reply({error:"Join the meeting to view recordings"},403);await rooms.getParticipant(roomName,String(claims.sub));}catch(_){return reply({error:"Join the meeting to view recordings"},403);}}
  const {data:files,error}=await db.from("rock_meeting_recordings").select("id,path,name,bytes,created_at").eq("meeting_id",id).order("created_at",{ascending:false});if(error)throw error;
  const recordings=await Promise.all((files||[]).map(async file=>{const {data}=await db.storage.from("rock-meeting-recordings").createSignedUrl(file.path,300);return {id:file.id,name:file.name,bytes:file.bytes,created_at:file.created_at,url:data?.signedUrl||null};}));return reply({recordings});
 }
 if(action==="recording-upload"){
  if(!host)return reply({error:"Only the meeting host can upload recordings"},403);
  const file=form?.get("media");if(!(file instanceof File)||!file.size||file.size>26214400||!["video/webm","video/mp4","video/x-matroska"].includes(file.type))return reply({error:"Cloud recordings must be video files up to 25 MB"},400);
  const path=id+"/"+crypto.randomUUID()+(file.type==="video/mp4"?".mp4":".webm"),name=String(file.name||"ROCK-recording").replace(/[<>\\/]/g,"_").slice(0,100);
  const {data:reserved,error:reserveError}=await db.rpc("rock_meeting_reserve_recording",{p_meeting:id,p_path:path,p_name:name,p_bytes:file.size});if(reserveError)return reply({error:"Recording library is full (100 MB total) or the file exceeds 25 MB. Download to your computer instead."},409);
  const {error:uploadError}=await db.storage.from("rock-meeting-recordings").upload(path,file,{contentType:file.type,upsert:false});if(uploadError){await db.from("rock_meeting_recordings").delete().eq("id",reserved);throw uploadError;}return reply({ok:true},201);
 }
 if(meeting.ended||Date.parse(meeting.expires_at)<Date.now())return reply({error:"This meeting has ended or expired"},404);
 if(action==="refresh"){
  try{
   const claims=await new TokenVerifier(key,secret).verify(String(body.room_token||""));
   if(claims.video?.room!==roomName||!claims.sub)return reply({error:"Meeting access expired. Rejoin."},401);
   const participant=await rooms.getParticipant(roomName,String(claims.sub));
   const refreshed=new AccessToken(key,secret,{identity:participant.identity,name:participant.name,ttl:"10m"});
   refreshed.addGrant({roomJoin:true,room:roomName,canPublish:participant.permission?.canPublish??false,canSubscribe:true,canPublishData:true});
   return reply({token:await refreshed.toJwt()});
  }catch(_){return reply({error:"Meeting access expired. Rejoin."},401);}
 }
 if(action==="join"){
  const name=String(body.name||"").trim();if(name.length<2||name.length>40||/[<>\u0000-\u001f]/.test(name))return reply({error:"Enter your name (2–40 characters)"},400);
  if(!host&&(meeting.locked||await digest(id+":"+String(body.password||""))!==meeting.password_hash))return reply({error:"Meeting is locked or the password is incorrect"},403);
  const existing=await rooms.listRooms([roomName]);if(!existing.length)await rooms.createRoom({name:roomName,maxParticipants:100,emptyTimeout:300,metadata:JSON.stringify({host_identity:"host-"+meeting.host_id,locked:meeting.locked,restricted:meeting.restricted,title:meeting.title})});
  const active=await rooms.listRooms([roomName]);if(active[0]?.numParticipants>=100)return reply({error:"This meeting has reached its 100-person limit"},409);
  const identity=host?"host-"+userId:"guest-"+crypto.randomUUID();const token=new AccessToken(key,secret,{identity,name,ttl:"10m"});
  token.addGrant({roomJoin:true,room:roomName,canPublish:host||!meeting.restricted,canSubscribe:true,canPublishData:true});
  return reply({token:await token.toJwt(),server_url:lkUrl,identity,host,title:meeting.title,host_identity:"host-"+meeting.host_id,locked:meeting.locked,restricted:meeting.restricted});
 }
 if(!host)return reply({error:"Only the signed-in meeting host can do this"},403);
 if(action==="end"){
  const {error}=await db.from("rock_meetings").update({ended:true}).eq("id",id);if(error)throw error;try{await rooms.deleteRoom(roomName);}catch(_){/* no active room */}return reply({ok:true});
 }
 if(action==="lock"||action==="restrict"){
  const field=action==="lock"?"locked":"restricted",value=!!body.value;const {error}=await db.from("rock_meetings").update({[field]:value}).eq("id",id);if(error)throw error;
  if(action==="restrict"){for(const participant of await rooms.listParticipants(roomName))if(participant.identity!=="host-"+userId)await rooms.updateParticipant(roomName,participant.identity,undefined,{canPublish:!value,canSubscribe:true,canPublishData:true});}
  await rooms.updateRoomMetadata(roomName,JSON.stringify({host_identity:"host-"+userId,locked:field==="locked"?value:meeting.locked,restricted:field==="restricted"?value:meeting.restricted,title:meeting.title}));return reply({ok:true,value});
 }
 const target=String(body.identity||"");if(!target||target==="host-"+userId)return reply({error:"Choose a participant"},400);
 if(action==="remove"){await rooms.removeParticipant(roomName,target);return reply({ok:true});}
 if(action==="allow"){await rooms.updateParticipant(roomName,target,undefined,{canPublish:!!body.value,canSubscribe:true,canPublishData:true});return reply({ok:true});}
 if(action==="mute"){const participant=await rooms.getParticipant(roomName,target);for(const track of participant.tracks)if(track.type===0)await rooms.mutePublishedTrack(roomName,target,track.sid,true);return reply({ok:true});}
 return reply({error:"Unknown action"},400);
 }catch(error){console.error("Meeting service",error instanceof Error?error.message:"failed");return reply({error:"Meeting service request failed. Please try again."},500);}
});
