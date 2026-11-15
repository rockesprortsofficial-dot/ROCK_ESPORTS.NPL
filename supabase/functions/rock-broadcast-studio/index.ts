import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {AccessToken,RoomServiceClient,EgressClient,StreamOutput,StreamProtocol} from 'npm:livekit-server-sdk@2.13.3';
import {grantFor,allowedAction,invitationHash,safeStatus,streamDestination} from './policy.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'POST only'},405);
  try {
    if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'Request too large'},413);
    const text=await req.text();if(text.length>4096)return reply({error:'Request too large'},413);
    const body=JSON.parse(text),action=String(body.action||'');
    if(!allowedAction(action))return reply({error:'Unknown action'},400);
    const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
    const lk=Deno.env.get('LIVEKIT_URL')||'',key=Deno.env.get('LIVEKIT_API_KEY')||'',secret=Deno.env.get('LIVEKIT_API_SECRET')||'';
    if(!url||!service||!anon||!lk||!key||!secret)return reply({error:'Broadcast studio has not been configured'},503);
    const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const endpoint=lk.replace(/^wss:/,'https:').replace(/^ws:/,'http:'),rooms=new RoomServiceClient(endpoint,key,secret),egress=new EgressClient(endpoint,key,secret);
    const youtube=Deno.env.get('BROADCAST_YOUTUBE_RTMP_URL')||'',tiktok=Deno.env.get('BROADCAST_TIKTOK_RTMP_URL')||'';
    const platforms={youtube:!!youtube,tiktok:!!tiktok};
    const owner=async()=>{
      const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
      if(!jwt)throw Error('OWNER_REQUIRED');
      const scoped=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false}});
      const {data:user,error}=await scoped.auth.getUser(jwt);if(error||!user.user)throw Error('OWNER_REQUIRED');
      const check=await scoped.rpc('rock_broadcast_is_owner');if(check.error||check.data!==true)throw Error('OWNER_REQUIRED');
      return user.user.id;
    };
    if(action==='create'){
      const ownerId=await owner(),id=crypto.randomUUID(),code=Array.from(crypto.getRandomValues(new Uint8Array(24))).map(n=>n.toString(16).padStart(2,'0')).join('');
      await db.from('rock_broadcast_studios').update({ended:true,live:false}).eq('ended',false).lt('expires_at',new Date().toISOString());
      const {error}=await db.from('rock_broadcast_studios').insert({id,owner_id:ownerId,invite_hash:await invitationHash(id,code)});
      if(error)return reply({error:'An active studio already exists or database setup is incomplete. Stop the previous studio first.'},409);
      return reply({id,password:code,expires_in:21600},201);
    }
    const statusQuery=()=>db.from('rock_broadcast_studios').select('*').eq('ended',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(action==='status'){
      const {data:row,error}=await statusQuery();if(error)return reply({error:'Studio database setup is incomplete'},503);
      // Platform configuration is only visible to the owner, never credentials.
      return reply(safeStatus(row,{youtube:false,tiktok:false}));
    }
    let id=String(body.id||'');
    if(action==='viewer-token'&&!id){const {data}=await statusQuery();id=data?.id||'';}
    if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Enter a valid studio ID'},400);
    const {data:row,error}=await db.from('rock_broadcast_studios').select('*').eq('id',id).maybeSingle();
    if(error||!row||row.ended||Date.parse(row.expires_at)<=Date.now())return reply({error:'Studio ended or expired'},404);
    const studioName=grantFor('owner',id,row.studio_generation||0).room,outputName=grantFor('output',id).room;
    const token=async(role:'owner'|'cohost'|'output'|'viewer')=>{
      const identity=role==='viewer'?'viewer-'+crypto.randomUUID():role;
      const jwt=new AccessToken(key,secret,{identity,name:role==='viewer'?'Viewer':role,ttl:'60s'});
      jwt.addGrant(grantFor(role,id,row.studio_generation||0));return reply({id,token:await jwt.toJwt(),server_url:lk,identity,role,platforms:role==='owner'?platforms:undefined});
    };
    if(action==='viewer-token'){
      if(!row.live)return reply({error:'Broadcast is offline'},409);
      const participants=await rooms.listParticipants(outputName).catch(()=>[]);
      if(!participants.some(p=>p.identity==='output'&&p.tracks.some(t=>t.type===1)))return reply({error:'Broadcaster disconnected. Please try again shortly.'},409);
      return token('viewer');
    }
    if(action==='cohost-token'){
      const code=String(body.password||'');
      if(!row.cohost_enabled||!/^[0-9a-f]{48}$/.test(code)||await invitationHash(id,code)!==row.invite_hash)return reply({error:'Invalid or revoked co-host invitation'},403);
      // Fixed identity replaces an old connection rather than allowing extra co-hosts.
      return token('cohost');
    }
    const ownerId=await owner();if(ownerId!==row.owner_id)return reply({error:'Owner access required'},403);
    if(action==='owner-token'){
      const existing=await rooms.listRooms([studioName]);if(!existing.length)await rooms.createRoom({name:studioName,maxParticipants:2,emptyTimeout:60});
      return token('owner');
    }
    if(action==='output-token')return token('output');
    if(action==='live'){
      const participants=await rooms.listParticipants(outputName);
      const publisher=participants.find(p=>p.identity==='output');
      if(!publisher?.tracks?.some(t=>t.type===1)||!publisher?.tracks?.some(t=>t.type===0))return reply({error:'Publish the composed video and mixed audio before going live'},409);
      const {error}=await db.from('rock_broadcast_studios').update({live:true}).eq('id',id);if(error)throw error;
      return reply({live:true});
    }
    if(action==='pause'||action==='stop'){
      const {error}=await db.from('rock_broadcast_studios').update({live:false,egress_state:'stopping',...(action==='stop'?{cohost_enabled:false}:{})}).eq('id',id);if(error)throw error;
      // Delete output room so existing viewers stop receiving; local publisher disconnects too.
      let failure=false;
      if(row.egress_id)try{await egress.stopEgress(row.egress_id);}catch(_){failure=true;}
      for(const name of action==='stop'?[outputName,studioName]:[outputName])try{if((await rooms.listRooms([name])).length)await rooms.deleteRoom(name);}catch(_){failure=true;}
      if(failure){await db.from('rock_broadcast_studios').update({egress_state:'stop_failed'}).eq('id',id);return reply({error:'Local output must be disconnected. Server could not confirm all remote streams stopped; retry Stop.'},502);}
      await db.from('rock_broadcast_studios').update({egress_id:null,egress_state:'idle',...(action==='stop'?{ended:true}:{})}).eq('id',id);
      return reply({live:false,ended:action==='stop'});
    }
    if(action==='revoke-cohost'){
      const {error}=await db.from('rock_broadcast_studios').update({cohost_enabled:false,studio_generation:(row.studio_generation||0)+1}).eq('id',id);if(error)throw error;
      // Future owner media uses a new room. An old/SDK-refreshed token can only join the retired room.
      await rooms.deleteRoom(studioName);
      return reply({revoked:true,reconnect_owner:true});
    }
    if(action==='stop-simulcast'){
      if(row.egress_id)await egress.stopEgress(row.egress_id);
      const {error}=await db.from('rock_broadcast_studios').update({egress_id:null,egress_state:'idle'}).eq('id',id);if(error)throw error;
      return reply({stopped:true});
    }
    if(action==='simulcast'){
      if(!row.live)return reply({error:'Start website broadcast first'},409);
      const targets=Array.isArray(body.platforms)?body.platforms:[];
      if(!targets.length||targets.some(p=>!['youtube','tiktok'].includes(p)))return reply({error:'Choose YouTube and/or TikTok'},400);
      let urls:string[];try{urls=[...new Set(targets)].map(p=>body.destinations?.[p]?streamDestination(p,body.destinations[p]):p==='youtube'?youtube:tiktok);}catch(_){return reply({error:'Enter a valid official YouTube/TikTok RTMP server and stream key in private stream setup.'},400);}
      if(urls.some(u=>!/^rtmps?:\/\//.test(u)))return reply({error:'Selected platform stream destination is not configured on the server'},503);
      // Atomic claim prevents duplicate paid egress starts from double clicks or two owner windows.
      const claim=await db.from('rock_broadcast_studios').update({egress_state:'starting'}).eq('id',id).eq('egress_state','idle').select('id').maybeSingle();
      if(claim.error||!claim.data)return reply({error:'Simulcast already starting or running'},409);
      try {
        const out=await egress.startRoomCompositeEgress(outputName,new StreamOutput({protocol:StreamProtocol.RTMP,urls}),{layout:'speaker'});
        const saved=await db.from('rock_broadcast_studios').update({egress_id:out.egressId,egress_state:'running'}).eq('id',id).eq('live',true).eq('egress_state','starting').select('id').maybeSingle();
        if(saved.error||!saved.data){await egress.stopEgress(out.egressId).catch(()=>{});throw saved.error||Error('Output stopped during simulcast startup');}
        return reply({started:true,platforms:targets});
      }catch(_){await db.from('rock_broadcast_studios').update({egress_state:'idle'}).eq('id',id).eq('egress_state','starting');return reply({error:'Platform streaming could not start. Check server egress availability and platform permissions.'},502);}
    }
    return reply({error:'Unknown action'},400);
  }catch(error){return reply({error:error instanceof Error&&error.message==='OWNER_REQUIRED'?'Owner access required':'Broadcast service request failed'},error instanceof Error&&error.message==='OWNER_REQUIRED'?403:500);}
});
