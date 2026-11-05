const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createHmac} = require('node:crypto');
const source = fs.readFileSync('supabase/functions/rock-community-imagekit/index.ts','utf8');
const uid='11111111-1111-4111-8111-111111111111';
const postId='22222222-2222-4222-8222-222222222222';
const fileId='abcdef0123456789abcdef01';
function setup(overrides={}) {
  const config={ROCK_IMAGEKIT_PRIVATE_KEY:'test-only-key',ROCK_IMAGEKIT_PUBLIC_KEY:'test-only-public',ROCK_IMAGEKIT_URL_ENDPOINT:'https://ik.imagekit.io/test',ROCK_IMAGEKIT_ENABLED:'true',SUPABASE_URL:'https://database.test',SUPABASE_ANON_KEY:'test-only-anon',...overrides};
  let handler,posts=[],files=[],file={},accountUser={id:uid,email:'member@example.test'},dbFailure=false;
  const requests=[];
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,crypto,atob,btoa,Request,Response,URL,
    Deno:{env:{get:key=>config[key]},serve:fn=>{handler=fn;}},
    fetch:async(address,options={})=>{
      requests.push({address,options});
      const url=new URL(address);let result;
      if(url.pathname==='/auth/v1/user')return Response.json(accountUser,{status:accountUser.id?200:401});
      if(url.pathname.startsWith('/rest/v1/')) {
        if(dbFailure)return Response.json({},{status:503});
        if(options.method==='POST') { const data=JSON.parse(options.body); posts=[{...data,id:postId}];result=posts; }
        else if(options.method==='DELETE'){posts=[];return new Response(null,{status:204});}
        else result=posts;
      } else if(url.pathname==='/v1/files')result=files;
      else if(url.pathname==='/v1/files/'+fileId+'/details')result=file;
      else if(url.pathname==='/v1/files/'+fileId&&options.method==='DELETE')return new Response(null,{status:204});
      else throw Error('Unexpected network request');
      return Response.json(result);
    }});
  vm.runInContext(source,context);
  async function call(body,auth='Bearer user',origin='https://rockesprortsofficial-dot.github.io') {
    const response=await handler(new Request('https://functions.test',{method:'POST',headers:{authorization:auth,origin},body:JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  }
  return {call,requests,posts:value=>{posts=value;},files:value=>{files=value;},file:value=>{file=value;},user:value=>{accountUser=value;},dbFailure:()=>{dbFailure=true;}};
}
(async()=>{
  const disabled=setup({ROCK_IMAGEKIT_ENABLED:'false'});
  assert.equal((await disabled.call({action:'config'})).body.enabled,false);
  assert.equal((await disabled.call({action:'prepare',size:10,type:'image/png'})).status,503);
  const missing=setup({ROCK_IMAGEKIT_PRIVATE_KEY:''});
  assert.equal((await missing.call({action:'config'})).body.enabled,false);
  const app=setup();
  assert.equal((await app.call({action:'prepare',size:10,type:'image/png'},'')).status,401);
  assert.equal((await app.call({action:'config'},'', 'https://attacker.test')).status,403);
  for(const [type,size] of [['image/png',25000001],['video/mp4',100000001],['image/svg+xml',100],['image/png',0]])
    assert.equal((await app.call({action:'prepare',type,size})).status,400);
  const prepared=await app.call({action:'prepare',size:1234,type:'image/png'});
  assert.equal(prepared.status,200);
  const {fields,session}=prepared.body;
  const [header,payload,signature]=fields.token.split('.');
  const decodedHeader=JSON.parse(Buffer.from(header,'base64url'));
  const claims=JSON.parse(Buffer.from(payload,'base64url'));
  assert.equal(decodedHeader.kid,'test-only-public');
  assert.equal(signature,createHmac('sha256','test-only-key').update(header+'.'+payload).digest('base64url'));
  for(const [key,value] of Object.entries(fields))if(key!=='token')assert.equal(claims[key],value);
  assert.equal(fields.isPrivateFile,'true'); assert.equal(fields.overwriteFile,'false');
  assert.ok(fields.checks.includes('1234')); assert.ok(fields.checks.includes('image/png'));
  assert.equal(claims.exp-claims.iat,600);
  const uploaded={fileId,filePath:fields.folder+'/'+fields.fileName,size:1234,isPrivateFile:true};
  app.file(uploaded);
  assert.equal((await app.call({action:'publish',session:session+'x',fileId,content:'hello'})).status,400);
  app.user({id:postId});
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,403);
  app.user({id:uid});
  app.file({...uploaded,filePath:'/other/file.png'});
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,400);
  app.file({...uploaded,isPrivateFile:false});
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,400);
  app.file({...uploaded,size:1235});
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,400);
  app.file(uploaded);
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,200);
  assert.equal((await app.call({action:'publish',session,fileId,content:'hello'})).status,200);
  assert.equal(app.requests.filter(r=>r.options.method==='POST').length,1);
  const view=await app.call({action:'view',postId},'');
  assert.equal(view.status,200);
  const signed=new URL(view.body.url);
  assert.equal(signed.origin,'https://ik.imagekit.io');
  assert.equal(signed.searchParams.get('ik-s'),createHmac('sha1','test-only-key').update(uploaded.filePath.slice(1)+signed.searchParams.get('ik-t')).digest('hex'));
  app.posts([]); assert.equal((await app.call({action:'view',postId},'')).status,404);
  app.posts([{id:postId,author_id:postId,media_path:'ik:'+fileId}]);
  assert.equal((await app.call({action:'remove',postId})).status,403);
  assert.equal(app.requests.filter(r=>r.options.method==='DELETE').length,0);
  app.posts([{id:postId,author_id:uid,media_path:'ik:'+fileId}]);
  assert.equal((await app.call({action:'remove',postId})).status,200);
  const full=setup();full.files([{size:2799999999}]);
  assert.equal((await full.call({action:'prepare',size:10,type:'image/png'})).status,409);
  const failing=setup();failing.dbFailure();
  assert.equal((await failing.call({action:'view',postId},'')).status,503);
  const feed=fs.readFileSync('rock-community-feed.js','utf8');
  assert.equal(feed,fs.readFileSync('rock-community-feed-v2.js','utf8'));
  assert.ok(feed.includes('post.media_path.startsWith("ik:") ? "imagekit" : "b2"'));
  console.log('PASS: disabled/missing config, auth, origin, file limits/types, signed upload fields, ownership, tampering, private file and size verification, idempotent publish, private signed view, missing post, authorized deletion, storage headroom, backend failure, identical feed entries.');
})().catch(error=>{console.error(error);process.exitCode=1;});
