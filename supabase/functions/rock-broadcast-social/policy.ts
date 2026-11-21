export const modes=['gameplay','watchparty'];
export const actions=['status','engagement','save-youtube','leave','create','owner-token','cohost-token','member-token','viewer-token','output-token','heartbeat','live','pause','stop','lock','remove','mute','simulcast','stop-simulcast'];
export function grant(role:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['owner','cohost','member','viewer','output'].includes(role))throw Error('Invalid role/session');
 return {roomJoin:true,room:'rock-social-'+(['output','viewer'].includes(role)?'output-':'call-')+id,canSubscribe:role!=='output',canPublish:role!=='viewer',canPublishSources:role==='owner'?[1,2,3,4]:role==='output'?[3,4]:role==='viewer'?[]:[1,2],canPublishData:false,canUpdateOwnMetadata:false};
}
export const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const publicStatus=(r:any)=>({id:r?.id||null,mode:r?.mode||null,live:!!r?.live&&!r?.ended,join_open:!!r?.join_open});

export async function gameplayInviteHash(secret:string,id:string,password:string){
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,encoder.encode('rock-gameplay-invite:'+id+':'+password));
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function youtubeSettingsKey(secret:string,ownerId:string){
 const bytes=new TextEncoder().encode('rock-gameplay-youtube:'+ownerId+':'+secret);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);
}
export async function sealYoutubeSettings(secret:string,ownerId:string,destination:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await youtubeSettingsKey(secret,ownerId),new TextEncoder().encode(destination));
 return btoa(String.fromCharCode(...iv,...new Uint8Array(data)));
}
export async function openYoutubeSettings(secret:string,ownerId:string,sealed:string){
 const bytes=Uint8Array.from(atob(sealed),char=>char.charCodeAt(0));
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12)},await youtubeSettingsKey(secret,ownerId),bytes.subarray(12));
 return new TextDecoder().decode(data);
}
