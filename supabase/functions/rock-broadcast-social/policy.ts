export const modes=['gameplay','watchparty'];
export const actions=['status','leave','create','owner-token','cohost-token','member-token','viewer-token','output-token','heartbeat','live','pause','stop','lock','remove','mute','simulcast','stop-simulcast'];
export function grant(role:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['owner','cohost','member','viewer','output'].includes(role))throw Error('Invalid role/session');
 return {roomJoin:true,room:'rock-social-'+(['output','viewer'].includes(role)?'output-':'call-')+id,canSubscribe:role!=='output',canPublish:role!=='viewer',canPublishSources:role==='owner'?[1,2,3,4]:role==='output'?[3,4]:role==='viewer'?[]:[1,2],canPublishData:false,canUpdateOwnMetadata:false};
}
export const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const publicStatus=(r:any)=>({id:r?.id||null,mode:r?.mode||null,live:!!r?.live&&!r?.ended,join_open:!!r?.join_open});
