// Separate provider: legacy B2 uploads and posts keep their existing endpoint.
const ORIGIN = "https://rockesprortsofficial-dot.github.io";
const TYPES = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
const env = name => Deno.env.get(name) || "";
const privateKey = env("ROCK_IMAGEKIT_PRIVATE_KEY");
const publicKey = env("ROCK_IMAGEKIT_PUBLIC_KEY");
const endpoint = env("ROCK_IMAGEKIT_URL_ENDPOINT").replace(/\/$/, "");
const configured = !!(privateKey && publicKey && /^https:\/\/ik\.imagekit\.io\/[a-zA-Z0-9_-]+$/.test(endpoint));
const enabled = configured && env("ROCK_IMAGEKIT_ENABLED") === "true";
const supabaseUrl = env("SUPABASE_URL");
const anon = env("SUPABASE_ANON_KEY") || Object.values(JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}"))[0];
const cors = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json = (body, status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
const bytes = text => new TextEncoder().encode(text);
const base64 = data => btoa(String.fromCharCode(...data)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const encode = value => base64(bytes(JSON.stringify(value)));
const decode = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/").padEnd(Math.ceil(value.length/4)*4,"=")),c=>c.charCodeAt(0))));
async function hmac(text, hash="SHA-256") {
  const key=await crypto.subtle.importKey("raw",bytes(privateKey),{name:"HMAC",hash},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,bytes(text)));
}
async function seal(data) { const payload=encode(data);return payload+"."+base64(await hmac("session:"+payload)); }
async function unseal(token) {
  if(typeof token!=="string"||token.length>3000)fail("Invalid upload session");
  const [payload,signature,...extra]=token.split(".");
  if(extra.length||!payload||!signature)fail("Invalid upload session");
  const expected=base64(await hmac("session:"+payload));
  let diff=expected.length^signature.length;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(signature.charCodeAt(i)||0);
  if(diff)fail("Invalid upload session");
  let data;try{data=decode(payload);}catch{fail("Invalid upload session");}
  if(!Number.isFinite(data.exp)||data.exp<Date.now())fail("Upload session expired; please upload again");
  return data;
}
async function imagekit(path,options={}) {
  const response=await fetch("https://api.imagekit.io/v1/"+path,{...options,headers:{Authorization:"Basic "+btoa(privateKey+":"),"Content-Type":"application/json",...(options.headers||{})}});
  if(!response.ok)fail("ImageKit media service is unavailable. Please try again.",503);
  return response.status===204?null:await response.json();
}
async function rest(path,auth,options={}) {
  const r=await fetch(supabaseUrl+"/rest/v1/"+path,{...options,headers:{apikey:anon,Authorization:auth||"Bearer "+anon,"Content-Type":"application/json",Prefer:"return=representation"}});
  if(!r.ok)fail("Community database operation failed",r.status);
  return r.status===204?[]:await r.json();
}
async function user(req) {
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))fail("Sign in to upload",401);
  const r=await fetch(supabaseUrl+"/auth/v1/user",{headers:{apikey:anon,Authorization:auth}});
  if(!r.ok)fail("Sign in to upload",401);
  const u=await r.json();if(!u.id)fail("Sign in to upload",401);return {u,auth};
}
const validId = id => typeof id==="string" && /^[a-f0-9]{24}$/i.test(id);
const validPath = path => typeof path==="string" && /^\/community\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(path);
async function ownedFile(fileId, session) {
  if(!validId(fileId))fail("Invalid media file");
  const file=await imagekit("files/"+fileId+"/details");
  if(file.filePath!==session.path||!validPath(file.filePath)||file.size!==session.size||file.isPrivateFile!==true)fail("Uploaded file does not match the selected file");
  return file;
}
async function storageRoom(size) {
  // Best-effort headroom check for the whole account; ImageKit's Free plan is the hard limit.
  // Includes unposted uploads; never silently switch the account to a paid plan.
  let total=0;
  for(let skip=0;skip<20000;skip+=1000) {
    const files=await imagekit("files?type=file&limit=1000&skip="+skip+"&fileType=all");
    if(!Array.isArray(files))fail("Unable to confirm free storage",503);
    for(const file of files) {if(!Number.isFinite(file.size))fail("Unable to confirm free storage",503);total+=file.size;}
    if(total+size>2800000000)fail("Free media storage is full",409);
    if(files.length<1000)return;
  }
  fail("Unable to confirm free storage",409);
}
async function signedView(path) {
  if(!validPath(path))fail("Invalid media path");
  const expiry=Math.floor(Date.now()/1000)+3600;
  // Official ImageKit signing: path relative to endpoint, then expiry; no transformations.
  const signature=Array.from(await hmac(path.slice(1)+expiry,"SHA-1"),b=>b.toString(16).padStart(2,"0")).join("");
  return endpoint+path+"?ik-t="+expiry+"&ik-s="+signature;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST only"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return json({error:"Origin not allowed"},403);
  try {
    const raw=await req.text();if(raw.length>12000)fail("Request too large",413);
    let body;try{body=JSON.parse(raw);}catch{fail("Invalid request");}
    if(body.action==="config")return json({enabled,provider:"imagekit",maxImageBytes:25000000,maxVideoBytes:100000000});
    if(!configured)fail("ImageKit is not configured",503);
    if(body.action==="view") {
      if(typeof body.postId!=="string"||!/^[0-9a-f-]{36}$/.test(body.postId))fail("Invalid post");
      const posts=await rest("rock_community_posts?select=media_path&id=eq."+body.postId+"&status=eq.published",null);
      const marker=posts[0]?.media_path||"";
      if(!marker.startsWith("ik:")||!validId(marker.slice(3)))fail("Media not available",404);
      const file=await imagekit("files/"+marker.slice(3)+"/details");
      return json({url:await signedView(file.filePath),expiresIn:3600});
    }
    const {u,auth}=await user(req);
    if(body.action==="prepare") {
      if(!enabled)fail("ImageKit uploads are not enabled",503);
      const size=body.size,mime=body.type;
      const max=String(mime).startsWith("video/")?100000000:25000000;
      if(!TYPES[mime]||!Number.isSafeInteger(size)||size<1||size>max)fail("Choose a supported photo up to 25 MB or video up to 100 MB");
      await storageRoom(size);
      const fileName=crypto.randomUUID()+"."+TYPES[mime],folder="/community/"+u.id;
      const fields={fileName,folder,useUniqueFileName:"false",overwriteFile:"false",isPrivateFile:"true",checks:'"file.size" <= '+size+' AND "file.mime" IN ["'+mime+'"]'};
      const now=Math.floor(Date.now()/1000);
      const header=encode({alg:"HS256",typ:"JWT",kid:publicKey});
      const payload=encode({...fields,iat:now,exp:now+600});
      const token=header+"."+payload+"."+base64(await hmac(header+"."+payload));
      const session=await seal({uid:u.id,path:folder+"/"+fileName,size,mime,exp:Date.now()+60*60*1000});
      return json({url:"https://upload.imagekit.io/api/v2/files/upload",fields:{...fields,token},session});
    }
    if(body.action==="publish") {
      const session=await unseal(body.session);
      if(session.uid!==u.id||!validPath(session.path))fail("Invalid upload owner",403);
      const file=await ownedFile(body.fileId,session);
      const marker="ik:"+file.fileId;
      const existing=await rest("rock_community_posts?select=id&media_path=eq."+encodeURIComponent(marker),auth);
      if(existing.length)return json({postId:existing[0].id});
      const content=body.content||"";if(typeof content!=="string"||content.length>2000)fail("Post text is too long");
      const posts=await rest("rock_community_posts",auth,{method:"POST",body:JSON.stringify({author_id:u.id,content,media_path:marker,media_type:session.mime.startsWith("video/")?"video":"image"})});
      return json({postId:posts[0].id});
    }
    if(body.action==="remove") {
      if(typeof body.postId!=="string"||!/^[0-9a-f-]{36}$/.test(body.postId))fail("Invalid post");
      const posts=await rest("rock_community_posts?select=id,author_id,media_path&id=eq."+body.postId,auth);
      const post=posts[0];
      if(!post||(post.author_id!==u.id&&u.email?.toLowerCase()!=="rockesprorts.official@gmail.com"))fail("Not permitted",403);
      if(!post.media_path?.startsWith("ik:")||!validId(post.media_path.slice(3)))fail("Invalid media");
      await rest("rock_community_posts?id=eq."+body.postId,auth,{method:"DELETE"});
      await imagekit("files/"+post.media_path.slice(3),{method:"DELETE"});return json({ok:true});
    }
    fail("Unknown media operation");
  }catch(error){return json({error:error?.status?error.message:"ImageKit media service is temporarily unavailable"},error?.status||503);}
});
