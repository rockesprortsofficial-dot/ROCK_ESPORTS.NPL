import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TokenVerifier } from "npm:livekit-server-sdk@2.13.3";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-rock-room","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const bucket="rock-meeting-media";
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]);
const reply=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
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