import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {TokenVerifier} from 'npm:livekit-server-sdk@2.13.3';
import webpush from 'npm:web-push@3.6.7';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const ownerEmail='rockesprorts.official@gmail.com';
const sections=new Set(['home','about','management','members','statements','contact','tournament','registration','group-division','tdm-group-division','live-draw','connect','jersey-preview','meeting','rock-meeting-room','notifications']);
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
function pushEndpoint(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&u.href.length<=4096&&(u.hostname==='fcm.googleapis.com'||u.hostname==='android.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch(_){return false;}}
function pushKeys(sub:any){try{const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(!/^[\w-]+={0,2}$/.test(sub?.keys?.p256dh||'')||!/^[\w-]+={0,2}$/.test(sub?.keys?.auth||''))return false;const p=decode(sub.keys.p256dh),a=decode(sub.keys.auth);return p.length===65&&p[0]===4&&a.length===16;}catch(_){return false;}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'POST only'},405);
 try{
  const b=await req.json(),action=String(b.action||'');const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!anon||!service)return json({error:'Notification service is not configured'},503);
  const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'',privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||'',subject=Deno.env.get('VAPID_SUBJECT')||'';
  if(action==='config')return json({public_key:publicKey,configured:!!(publicKey&&privateKey&&subject)});
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
  const jwt=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  async function member(){try{const key=Deno.env.get('LIVEKIT_API_KEY')||'',secret=Deno.env.get('LIVEKIT_API_SECRET')||'';if(!key||!secret||!jwt)return null;const claims=await new TokenVerifier(key,secret).verify(jwt);let metadata:any={};try{metadata=JSON.parse(String(claims.metadata||'{}'));}catch(_){}if(!String(claims.video?.room||'').startsWith('rock-private-')||claims.video?.roomJoin!==true||metadata.rock_private_member!==true||!uuid(claims.sub))return null;if(metadata.device_session_id){const valid=await checked(db.rpc('rock_member_session_valid',{p_id:metadata.device_session_id,p_member:claims.sub}));if(!valid)return null;}return await checked(db.from('rock_meeting_members').select('id,real_name').eq('id',claims.sub).eq('team_slug','rock-esports').eq('is_active',true).maybeSingle());}catch(_){return null;}}

  // A member may test only the installation they control; this never broadcasts or creates a notice/call.
  if(action==='test_device'){
   const m=await member();if(!m)return json({error:'Approved Meeting Room login required'},401);
   if(!/^[0-9a-f]{64}$/.test(b.device_token||'')||!uuid(b.test_id)||!pushEndpoint(b.endpoint))return json({error:'Invalid device test'},400);
   const d=await checked(db.from('rock_app_devices').select('endpoint,p256dh,auth').eq('manage_hash',await hash(b.device_token)).eq('member_id',m.id).eq('member_opt_in',true).eq('endpoint',b.endpoint).maybeSingle());
   if(!d||!pushEndpoint(d.endpoint))return json({error:'Enable private notifications on this device first'},403);
   if(!publicKey||!privateKey||!subject)return json({error:'Push configuration unavailable'},503);
   webpush.setVapidDetails(subject,publicKey,privateKey);
   try{await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},JSON.stringify({title:'ROCK ESPORTS • Device test / परीक्षण',body:'Notification test only — no actual call. / यो परीक्षण मात्र हो; वास्तविक call होइन।',data:{kind:'device-test',audience:'members',section:'rock-meeting-room',test_id:b.test_id}}),{TTL:60,urgency:'high',timeout:5000});}
   catch(e){if([404,410].includes((e as {statusCode?:number}).statusCode||0))return json({error:'Subscription expired. Reset notifications on this device.'},410);return json({error:'Push provider did not accept the test. Try again.'},502);}
   return json({accepted:true,test_id:b.test_id,targets:1,delivery_confirmed:false});
  }
  if(action==='private_inbox'){const m=await member();if(!m)return json({error:'Sign in with your approved Meeting Room details'},401);const notices=await checked(db.from('rock_app_notices').select('id,title,message,section,created_at').eq('audience','members').order('created_at',{ascending:false}).limit(50));return json({notices,member_name:m.real_name});}
  if(['register','preferences','status'].includes(action)){
   const endpoint=String(b.endpoint||b.subscription?.endpoint||''),deviceToken=String(b.device_token||'');if(!pushEndpoint(endpoint)||!/^[0-9a-f]{64}$/.test(deviceToken))return json({error:'Invalid device registration'},400);
   const manageHash=await hash(deviceToken);const existing=await checked(db.from('rock_app_devices').select('*').eq('endpoint',endpoint).maybeSingle());
   if(existing&&existing.manage_hash!==manageHash)return json({error:'This subscription belongs to a different installation. Reset notifications on this device.'},403);
   if(action==='status'){if(!existing)return json({registered:false});const active=existing.member_id?await checked(db.from('rock_meeting_members').select('id').eq('id',existing.member_id).eq('team_slug','rock-esports').eq('is_active',true).maybeSingle()):null;return json({registered:true,public_opt_in:existing.public_opt_in,member_linked:!!(existing.member_opt_in&&active)});}
   if(!existing&&action!=='register')return json({error:'Enable notifications on this device first'},404);
   let m=null;if(b.member_opt_in===true){m=await member();if(!m)return json({error:'Approved Meeting Room login is required on this device'},401);}
   let row:any={updated_at:new Date().toISOString()};
   if(action==='register'){if(!pushKeys(b.subscription))return json({error:'Invalid browser push keys'},400);row={...row,endpoint,p256dh:b.subscription.keys.p256dh,auth:b.subscription.keys.auth,manage_hash:manageHash};}
   if(typeof b.public_opt_in==='boolean')row.public_opt_in=b.public_opt_in;
   if(b.member_opt_in===true){row.member_id=m.id;row.member_opt_in=true;}else if(b.member_opt_in===false){row.member_id=null;row.member_opt_in=false;}
   const saved=existing?await db.from('rock_app_devices').update(row).eq('endpoint',endpoint).eq('manage_hash',manageHash):await db.from('rock_app_devices').insert(row);
   if(saved.error){if(saved.error.code==='23505')return json({error:'Subscription changed. Reload the App and retry.'},409);throw saved.error;}
   return json({success:true,member_linked:b.member_opt_in===true?true:b.member_opt_in===false?false:!!existing?.member_opt_in});
  }
  if(!['preview','publish'].includes(action))return json({error:'Unknown notification action'},400);
  if(!jwt)return json({error:'Owner login required'},401);
  const authClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data:auth,error:authError}=await authClient.auth.getUser(jwt);
  if(authError||auth.user?.email?.toLowerCase()!==ownerEmail||!auth.user.email_confirmed_at)return json({error:'Only the verified ROCK ESPORTS Owner may publish notifications'},403);
  if(action==='preview'){const counts=await checked(db.rpc('rock_app_push_counts'));return json({counts,configured:!!(publicKey&&privateKey&&subject),sends_notifications:false});}
  const audience=String(b.audience||''),title=String(b.title||'').trim(),message=String(b.message||'').trim(),section=audience==='members'?'rock-meeting-room':String(b.section||'notifications');
  if(!['public','members'].includes(audience)||!uuid(b.notification_id)||!title||title.length>120||!message||message.length>1200||!sections.has(section))return json({error:'Check the audience, title, message and target section'},400);
  if(!publicKey||!privateKey||!subject)return json({error:'Push is not configured; nothing was published'},503);
  const published=await checked(db.rpc('rock_app_publish',{p_id:b.notification_id,p_audience:audience,p_title:title,p_message:message,p_section:section,p_owner:ownerEmail}));const notice=Array.isArray(published)?published[0]:published;if(!notice?.id)throw Error('Publication was not returned');
  const targets=await checked(db.rpc('rock_app_push_targets',{p_notice:notice.id,p_limit:100}));
  webpush.setVapidDetails(subject,publicKey,privateKey);
  let offset=0;const payload=JSON.stringify({title,body:Array.from(message).slice(0,300).join('')+(Array.from(message).length>300?'…':''),data:{audience,notice_id:notice.id,section}});
  await Promise.all(Array.from({length:Math.min(8,targets.length)},async()=>{while(offset<targets.length){const item=targets[offset++];const claimed=await checked(db.rpc('rock_app_claim_push',{p_notice:notice.id,p_endpoint_hash:item.endpoint_hash}));if(!claimed)continue;let state='failed';try{if(!pushEndpoint(item.endpoint))throw Error('Unsupported push provider');await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},payload,{TTL:3600,urgency:'high',timeout:5000});state='sent';}catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410){await db.from('rock_app_devices').delete().eq('endpoint',item.endpoint);await db.from('rock_push_subscriptions').delete().eq('endpoint',item.endpoint);}}await checked(db.from('rock_app_push_deliveries').update({state}).eq('notice_id',notice.id).eq('endpoint_hash',item.endpoint_hash));}}));
  const remaining=await checked(db.rpc('rock_app_push_targets',{p_notice:notice.id,p_limit:1}));const logs=await checked(db.from('rock_app_push_deliveries').select('state').eq('notice_id',notice.id));
  return json({success:true,notification_id:notice.id,audience,has_more:remaining.length>0,sent:logs.filter((x:any)=>x.state==='sent').length,failed:logs.filter((x:any)=>x.state==='failed').length,pending:logs.filter((x:any)=>x.state==='pending').length});
 }catch(error){console.error('ROCK App notification request failed',error instanceof Error?error.name:'Error');return json({error:'Notification request could not be completed. Retry with the same publication.'},500);}
});
