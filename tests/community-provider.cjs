const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('rock-community-feed.js','utf8');
const configCode=source.slice(source.indexOf('  let b2Enabled = false;'),source.indexOf('  function attachPostMedia('));
async function setup(imagekitConfig, b2Config={enabled:true,maxBytes:500000000}) {
  const calls=[];
  const context=vm.createContext({URL,Date,Map,
    applyLanguage:()=>{},
    client:{functions:{invoke:async(name,{body})=>{
      calls.push({name,body});
      if(body.action==='view')return {data:{url:name==='rock-community-imagekit'?'https://ik.imagekit.io/test/photo.jpg?ik-s=test':'https://bucket.s3.us-east-005.backblazeb2.com/photo.jpg'}};
      return name==='rock-community-imagekit'?imagekitConfig:{data:b2Config};
    }}}});
  vm.runInContext(configCode+';globalThis.ready=mediaConfiguration;globalThis.state=()=>({mediaProvider,b2Enabled,maxMediaBytes,maxImageBytes});globalThis.getUrl=privateMediaUrl;',context);
  await context.ready;return {context,calls};
}
(async()=>{
  const active=await setup({data:{enabled:true,provider:'imagekit',maxImageBytes:25000000,maxVideoBytes:100000000}});
  assert.equal(active.context.state().mediaProvider,'imagekit');
  assert.equal(active.context.state().maxImageBytes,25000000);
  assert.equal(active.context.state().maxMediaBytes,100000000);
  assert.equal(active.calls.length,1);
  await active.context.getUrl('legacy','b2');
  assert.equal(active.calls.at(-1).name,'rock-community-media');
  await active.context.getUrl('new','imagekit');
  assert.equal(active.calls.at(-1).name,'rock-community-imagekit');
  const unavailable=await setup({error:{message:'function missing'}});
  assert.equal(unavailable.context.state().mediaProvider,'b2');
  assert.equal(unavailable.context.state().b2Enabled,true);
  assert.equal(unavailable.context.state().maxImageBytes,500000000);
  const inactive=await setup({data:{enabled:false}});
  assert.equal(inactive.context.state().b2Enabled,true);
  const legacy=await setup({error:{}},{enabled:false});
  assert.equal(legacy.context.state().maxMediaBytes,25*1024*1024);
  assert.equal(legacy.context.state().b2Enabled,false);
  const uploads=[];
  class XHR {
    constructor(){this.upload={};uploads.push(this);}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(){throw Error('Multipart upload must not set Content-Type');}
    send(body){this.body=body;this.status=200;this.responseText=JSON.stringify({fileId:'abcdef0123456789abcdef01'});this.onload();}
  }
  const uploadContext=vm.createContext({XMLHttpRequest:XHR,FormData,Error,Object,Promise,JSON,t:s=>s,postStatus:{}});
  vm.runInContext(source.slice(source.indexOf('  function uploadDirect('),source.indexOf('  const esc ='))+';globalThis.upload=uploadDirect;',uploadContext);
  const file=new Blob(['example'],{type:'image/png'});
  const result=await uploadContext.upload({url:'https://upload.imagekit.io/api/v2/files/upload',fields:{token:'one-time',fileName:'example.png'}},file);
  assert.equal(result.fileId,'abcdef0123456789abcdef01');
  assert.equal(uploads[0].method,'POST');assert.equal(uploads[0].body.get('token'),'one-time');
  assert.equal(uploads[0].body.get('file').size,file.size);
  await assert.rejects(uploadContext.upload({url:'https://attacker.test/upload',fields:{token:'secret'}},file));
  console.log('PASS: ImageKit selection, old B2 media routing, new ImageKit routing, missing/disabled provider fallback, Supabase legacy fallback, direct multipart upload, hostile upload URL rejected.');
})().catch(error=>{console.error(error);process.exitCode=1;});
