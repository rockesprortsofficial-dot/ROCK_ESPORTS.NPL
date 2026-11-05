const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

const uid = '11111111-2222-4333-8444-555555555555';
const owner = 'rock-community:' + uid;
const env = {ROCK_MUX_TOKEN_ID:'test-id', ROCK_MUX_TOKEN_SECRET:'test-secret', ROCK_MUX_ENABLED:'true', SUPABASE_URL:'https://supabase.test', SUPABASE_ANON_KEY:'anon'};
let serve, uploadOwner = owner, assetOwner = owner, status = 'preparing', assetCount = 0, row, deleted = false;
const response = data => Response.json(data);
const ctx = vm.createContext({
  Deno:{env:{get:key=>env[key]},serve:fn=>{serve=fn;}},
  Response, URL, TextEncoder, Uint8Array, btoa, crypto:webcrypto,
  fetch:async(input, opts) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') return opts.headers.Authorization === 'Bearer valid' ? response({id:uid}) : new Response(null,{status:401});
    if (url.hostname === 'api.mux.com') {
      if (url.pathname.endsWith('/assets')) return response({data:Array(assetCount).fill({})});
      if (url.pathname.endsWith('/uploads') && opts.method === 'POST') {
        assert.equal(JSON.parse(opts.body).new_asset_settings.passthrough,owner);
        return response({data:{id:'Upload123',url:'https://upload.test/temporary'}});
      }
      if (url.pathname.endsWith('/uploads/Upload123')) return response({data:{new_asset_settings:{passthrough:uploadOwner},status:'asset_created',asset_id:'Asset123'}});
      if (url.pathname.endsWith('/assets/Asset123') && opts.method === 'DELETE') { deleted=true; return new Response(null,{status:204}); }
      if (url.pathname.endsWith('/assets/Asset123')) return response({data:{passthrough:assetOwner,status,playback_ids:[{policy:'public',id:'Playback123'}]}});
    }
    if (url.pathname.endsWith('/rock_community_posts')) {
      if (opts.method === 'POST') { row ||= JSON.parse(opts.body); return response([row]); }
      if (opts.method === 'DELETE') { row = null; return response([]); }
      return response(row ? [row] : []);
    }
    throw Error('Unexpected endpoint ' + url.pathname);
  },
});
vm.runInContext(fs.readFileSync('supabase/functions/rock-community-mux/index.ts','utf8'),ctx);
async function call(action, args={}, auth='Bearer valid') {
  const r = await serve(new Request('https://function.test',{method:'POST',headers:{authorization:auth},body:JSON.stringify({action,...args})}));
  return {status:r.status,data:await r.json()};
}

(async()=>{
  assert.equal((await call('config')).data.maxVideoBytes,500000000);
  assert.equal((await call('prepare',{size:500000000,type:'video/mp4'},'')).status,401);
  assert.equal((await call('prepare',{size:500000001,type:'video/mp4'})).status,400);
  assert.equal((await call('prepare',{size:500000000,type:'video/mp4'})).data.uploadId,'Upload123');
  assetCount=10;
  assert.equal((await call('prepare',{size:500000000,type:'video/mp4'})).status,409);
  assert.equal((await call('publish',{uploadId:'Upload123'})).data.pending,true);
  uploadOwner='other';
  assert.equal((await call('publish',{uploadId:'Upload123'})).status,403);
  uploadOwner=owner;
  status='ready';
  const first = (await call('publish',{uploadId:'Upload123'})).data;
  assert.equal(row.media_path,'mux:Asset123:Playback123');
  assert.equal((await call('publish',{uploadId:'Upload123'})).data.postId,first.postId);
  assetOwner='other';
  assert.equal((await call('remove',{postId:first.postId})).status,403);
  assert.equal(deleted,false);
  assetOwner=owner;
  assert.equal((await call('remove',{postId:first.postId})).data.ok,true);
  assert.equal(deleted,true);
  assert.equal(row,null);
  console.log('PASS: authenticated 500 MB boundary, full quota, processing, ownership, repeat publish, safe deletion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
