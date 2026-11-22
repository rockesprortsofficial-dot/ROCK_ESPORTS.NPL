export type StudioRole = 'owner' | 'cohost' | 'output' | 'viewer';
export function grantFor(role: StudioRole, id: string, generation=0) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Invalid studio ID');
  const studio = role === 'owner' || role === 'cohost';
  const sources = role === 'owner' ? [1, 2, 3, 4] : role === 'cohost' ? [1, 2] : role === 'output' ? [3, 4] : [];
  return {roomJoin: true, room: `rock-broadcast-${studio ? 'studio' : 'output'}-${id}${studio?'-g'+generation:''}`,
    canSubscribe: role !== 'output', canPublish: role !== 'viewer', canPublishSources: sources,
    canPublishData: false, canUpdateOwnMetadata: false};
}
export function allowedAction(action: string) {
  return ['status','create','set-cohost-password','engagement','owner-token','cohost-token','output-token','viewer-token','live','pause','stop','revoke-cohost','simulcast','stop-simulcast'].includes(action);
}
export async function invitationHash(id: string, code: string) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+':'+code));
  return Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function safeStatus(row: any, platforms: {youtube:boolean,tiktok:boolean}) {
  return {id:row?.id||null,live:!!row?.live&&!row?.ended,expires_at:row?.expires_at||null,
    platforms,egress_state:row?.egress_state||'idle'};
}

// Request-only platform credentials: never persist, log or return them.
export function streamDestination(platform: string, value: any) {
  if(!value||typeof value.server!=='string'||typeof value.key!=='string')throw Error('Invalid platform destination');
  const server=value.server.trim(),key=value.key.trim();
  if(server.length>1024||!key||key.length>1024||/[\s#]/.test(key))throw Error('Invalid platform destination');
  let url: URL;try{url=new URL(server);}catch(_){throw Error('Invalid platform destination');}
  const host=url.hostname.toLowerCase(),trusted=platform==='youtube'?/^(?:[a-z0-9-]+\.)?(?:rtmp|rtmps)\.youtube\.com$/.test(host):platform==='tiktok'&&['tiktok.com','tiktokcdn.com','tiktokv.com'].some(base=>host===base||host.endsWith('.'+base));
  if(!trusted||!['rtmp:','rtmps:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||(url.port&&!['443','1935'].includes(url.port)))throw Error('Invalid platform destination');
  return url.href.replace(/\/$/,'')+'/'+key;
}

export async function customTournamentPassword(secret:string,id:string,password:string){
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,encoder.encode('rock-tournament:'+id+':'+password));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
