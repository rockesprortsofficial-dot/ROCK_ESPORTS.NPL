import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetBucketCorsCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const ORIGIN = "https://rockesprortsofficial-dot.github.io";
const MAX_BYTES = 500000000;
const MAX_STORAGE = 9000000000;
const TYPES = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
const cors = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const env = name => Deno.env.get(name) || "";
const url = env("SUPABASE_URL");
const anon = env("SUPABASE_ANON_KEY") || Object.values(JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}"))[0];
const bucket = env("ROCK_B2_BUCKET_NAME");
const secret = env("ROCK_B2_APPLICATION_KEY");
const configured = !!(bucket && secret && env("ROCK_B2_KEY_ID") && env("ROCK_B2_S3_ENDPOINT"));
const s3 = configured ? new S3Client({endpoint:env("ROCK_B2_S3_ENDPOINT"),region:"us-east-005",forcePathStyle:true,credentials:{accessKeyId:env("ROCK_B2_KEY_ID"),secretAccessKey:secret},requestChecksumCalculation:"WHEN_REQUIRED",responseChecksumValidation:"WHEN_REQUIRED"}) : null;
let lastHealthCheck = 0;
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const encode = value => btoa(value).replaceAll("+","-").replaceAll("/","_").replace(/=+$/," ").trim();
const decode = value => atob(value.replaceAll("-","+").replaceAll("_","/").padEnd(Math.ceil(value.length/4)*4,"="));
async function mac(payload) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)));
}
async function seal(data) { const payload=encode(JSON.stringify(data));return payload+"."+encode(String.fromCharCode(...await mac(payload))); }
async function unseal(token) {
  if(typeof token!=="string"||token.length>2000)fail("Invalid upload session");
  const [payload,signature,...extra]=token.split(".");if(extra.length||!payload||!signature)fail("Invalid upload session");
  let given;try{given=Uint8Array.from(decode(signature),c=>c.charCodeAt(0));}catch{fail("Invalid upload session");}
  const expected=await mac(payload);let mismatch=given.length^expected.length;
  for(let i=0;i<expected.length;i++)mismatch|=expected[i]^(given[i]||0);
  if(mismatch)fail("Invalid upload session");
  let data;try{data=JSON.parse(decode(payload));}catch{fail("Invalid upload session");}
  if(data.exp<Date.now())fail("Upload session expired; please upload again");return data;
}
async function user(req) {
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))fail("Sign in to upload",401);
  const r=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,Authorization:auth}});
  if(!r.ok)fail("Sign in to upload",401);const u=await r.json();if(!u.id)fail("Sign in to upload",401);return {u,auth};
}
async function rest(path,auth,options={}) {
  const r=await fetch(url+"/rest/v1/"+path,{...options,headers:{apikey:anon,Authorization:auth||"Bearer "+anon,"Content-Type":"application/json",Prefer:"return=representation",...(options.headers||{})}});
  if(!r.ok)fail("Community database operation failed",r.status);return r.status===204?[]:await r.json();
}
function validKey(key) {return typeof key==="string"&&/^community\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(key);}
async function checkCapacity(size) {
  let total=0,token;
  for(let page=0;page<20;page++) {
    const r=await s3.send(new ListObjectsV2Command({Bucket:bucket,Prefix:"community/",ContinuationToken:token}));
    total+=(r.Contents||[]).reduce((n,item)=>n+(item.Size||0),0);
    if(total+size>MAX_STORAGE)fail("Free media storage is full",409);
    if(!r.IsTruncated)return;token=r.NextContinuationToken;
  }
  fail("Unable to confirm remaining free storage",409);
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST only"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return json({error:"Origin not allowed"},403);
  try {
    const raw=await req.text();if(raw.length>12000)fail("Request too large",413);const body=JSON.parse(raw);
    if(!configured)return json({enabled:false,maxBytes:25*1024*1024},body.action==="config"?200:503);
    if(body.action==="config") {
      if(Date.now()-lastHealthCheck>60000) {
        let rules=[];
        try { rules=(await s3.send(new GetBucketCorsCommand({Bucket:bucket}))).CORSRules||[]; }
        catch(error) { if(error?.name!=="NoSuchCORSConfiguration"&&error?.$metadata?.httpStatusCode!==404)throw error; }
        if(!rules.some(rule=>rule.AllowedOrigins?.includes(ORIGIN)&&rule.AllowedMethods?.includes("PUT"))) {
          fail("Browser uploads are not configured",503);
        }
        await checkCapacity(0);
        const probe=await getSignedUrl(s3,new PutObjectCommand({Bucket:bucket,Key:"community/health-check",ContentType:"video/mp4",ContentLength:MAX_BYTES}),{expiresIn:60,signableHeaders:new Set(["content-type","content-length"])});
        if(!new URL(probe).searchParams.get("X-Amz-SignedHeaders")?.includes("content-length"))fail("Upload length could not be secured",503);
        lastHealthCheck=Date.now();
      }
      return json({enabled:true,maxBytes:MAX_BYTES,provider:"b2"});
    }
    if(body.action==="view") {
      if(typeof body.postId!=="string"||!/^[0-9a-f-]{36}$/.test(body.postId))fail("Invalid post");
      const posts=await rest("rock_community_posts?select=media_path&id=eq."+body.postId+"&status=eq.published",null);
      const key=posts[0]?.media_path?.replace(/^b2:/,"");if(!posts[0]?.media_path?.startsWith("b2:")||!validKey(key))fail("Media not available",404);
      return json({url:await getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:3600}),expiresIn:3600});
    }
    const {u,auth}=await user(req);
    if(body.action==="prepare") {
      const size=body.size,mime=body.type;
      if(!Number.isSafeInteger(size)||size<1||size>MAX_BYTES||!TYPES[mime])fail("Choose a supported file up to 500 MB");
      await checkCapacity(size);
      const key="community/"+u.id+"/"+crypto.randomUUID()+"."+TYPES[mime];
      const session=await seal({uid:u.id,key,size,mime,exp:Date.now()+2*60*60*1000});
      const putUrl=await getSignedUrl(s3,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:mime,ContentLength:size}),{expiresIn:3600,signableHeaders:new Set(["content-type","content-length"])});
      if(!new URL(putUrl).searchParams.get("X-Amz-SignedHeaders")?.includes("content-length"))fail("Upload length could not be secured",503);
      return json({url:putUrl,session,headers:{"Content-Type":mime},maxBytes:MAX_BYTES});
    }
    if(body.action==="publish") {
      const session=await unseal(body.session);if(session.uid!==u.id||!validKey(session.key))fail("Invalid upload owner",403);
      const content=body.content||"";if(typeof content!=="string"||content.length>2000)fail("Post text is too long");
      const file=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:session.key}));
      if(file.ContentLength!==session.size||file.ContentType!==session.mime)fail("Uploaded file does not match the selected file");
      const existing=await rest("rock_community_posts?select=id&media_path=eq."+encodeURIComponent("b2:"+session.key),auth);
      if(existing.length)return json({postId:existing[0].id});
      const posts=await rest("rock_community_posts",auth,{method:"POST",body:JSON.stringify({author_id:u.id,content,media_path:"b2:"+session.key,media_type:session.mime.startsWith("video/")?"video":"image"})});
      return json({postId:posts[0].id});
    }
    if(body.action==="discard") {
      const session=await unseal(body.session);if(session.uid!==u.id||!validKey(session.key))fail("Invalid upload owner",403);
      const posts=await rest("rock_community_posts?select=id&media_path=eq."+encodeURIComponent("b2:"+session.key),auth);
      if(posts.length)fail("Published media cannot be discarded",409);
      await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:session.key}));return json({ok:true});
    }
    if(body.action==="remove") {
      if(typeof body.postId!=="string"||!/^[0-9a-f-]{36}$/.test(body.postId))fail("Invalid post");
      const posts=await rest("rock_community_posts?select=id,author_id,media_path&id=eq."+body.postId,auth);
      const post=posts[0];if(!post||(post.author_id!==u.id&&u.email?.toLowerCase()!=="rockesprorts.official@gmail.com"))fail("Not permitted",403);
      const key=post.media_path?.replace(/^b2:/,"");if(!post.media_path?.startsWith("b2:")||!validKey(key))fail("Invalid media");
      await rest("rock_community_posts?id=eq."+body.postId,auth,{method:"DELETE"});
      await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));return json({ok:true});
    }
    fail("Unknown media operation");
  }catch(error){return json({error:error?.status?error.message:"Media service is temporarily unavailable"},error?.status||503);}
});

