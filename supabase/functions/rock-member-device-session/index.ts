import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {AccessToken,TokenVerifier} from 'npm:livekit-server-sdk@2.13.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'POST only'},405);
 try{
 const b=await req.json(),action=String(b.action||''),device=String(b.device_token||''),refresh=String(b.refresh_token||'');
 if(!['create','resume','revoke'].includes(action)||!/^[0-9a-f]{64}$/.test(device)||(action!=='create'&&!/^[0-9a-f]{64}$/.test(refresh)))return json({error:'Invalid device session'},400);
 const key=Deno.env.get('LIVEKIT_API_KEY')||'',secret=Deno.env.get('LIVEKIT_API_SECRET')||'',url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!key||!secret||!url||!service)return json({error:'Member session service unavailable'},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),deviceHash=await hash(device);
 const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
 if(action==='revoke'){await checked(db.rpc('rock_member_revoke_device',{p_token_hash:await hash(refresh),p_device_hash:deviceHash}));return json({success:true});}
 let memberId='',record:any=null;
 if(action==='create'){
  try{const jwt=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'').trim()||'',c=await new TokenVerifier(key,secret).verify(jwt),meta=JSON.parse(String(c.metadata||'{}'));
   if(!c.sub||meta.rock_private_member!==true||c.video?.roomJoin!==true||!String(c.video?.room||'').startsWith('rock-private-'))throw Error();if(meta.device_session_id){const valid=await checked(db.rpc('rock_member_session_valid',{p_id:meta.device_session_id,p_member:c.sub}));if(!valid)throw Error();}memberId=c.sub;
  }catch(_){return json({error:'Approved Meeting Room login required'},401);}
 }else{record=await checked(db.from('rock_member_device_sessions').select('*').eq('token_hash',await hash(refresh)).eq('device_hash',deviceHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());if(!record){await checked(db.rpc('rock_member_revoke_device',{p_token_hash:await hash(refresh),p_device_hash:deviceHash}));return json({error:'Device login expired. Sign in again.'},401);}memberId=record.member_id;}
 const member=await checked(db.from('rock_meeting_members').select('id,real_name,login_code_hash,password_hash').eq('id',memberId).eq('team_slug','rock-esports').eq('is_active',true).maybeSingle());
 if(!member){if(record)await checked(db.rpc('rock_member_revoke_device',{p_token_hash:record.token_hash,p_device_hash:deviceHash}));return json({error:'Membership is no longer active'},403);}
 const version=await hash(member.login_code_hash+':'+member.password_hash);
 if(record&&record.credential_version!==version){await checked(db.rpc('rock_member_revoke_device',{p_token_hash:record.token_hash,p_device_hash:deviceHash}));return json({error:'Member credentials changed. Sign in again.'},401);}
 let nextRefresh:string|undefined;
 if(action==='create'){nextRefresh=random();await checked(db.from('rock_member_device_sessions').update({revoked_at:new Date().toISOString()}).eq('device_hash',deviceHash).is('revoked_at',null));await checked(db.from('rock_app_devices').update({member_id:null,member_opt_in:false}).eq('manage_hash',deviceHash));record=await checked(db.from('rock_member_device_sessions').insert({member_id:member.id,token_hash:await hash(nextRefresh),device_hash:deviceHash,credential_version:version}).select('id,expires_at').single());}
 else await checked(db.from('rock_member_device_sessions').update({last_seen_at:new Date().toISOString()}).eq('id',record.id).is('revoked_at',null));
 const token=new AccessToken(key,secret,{identity:member.id,name:member.real_name,ttl:'2h',metadata:JSON.stringify({rock_private_member:true,device_session_id:record.id})});token.addGrant({roomJoin:true,room:'rock-private-member-messenger',canPublish:true,canSubscribe:true,canPublishData:true});
 return json({token:await token.toJwt(),identity:member.id,name:member.real_name,server_url:Deno.env.get('LIVEKIT_URL'),access_expires_at:new Date(Date.now()+7000000).toISOString(),session_expires_at:record.expires_at,...(nextRefresh?{refresh_token:nextRefresh}:{})});
 }catch(e){console.error('Member device session failed',e instanceof Error?e.name:'Error');return json({error:'Could not verify device session. Retry when connected.'},500);}
});
