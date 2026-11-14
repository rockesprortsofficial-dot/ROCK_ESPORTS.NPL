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
  return ['status','create','owner-token','cohost-token','output-token','viewer-token','live','pause','stop','revoke-cohost','simulcast','stop-simulcast'].includes(action);
}
export async function invitationHash(id: string, code: string) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+':'+code));
  return Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function safeStatus(row: any, platforms: {youtube:boolean,tiktok:boolean}) {
  return {id:row?.id||null,live:!!row?.live&&!row?.ended,expires_at:row?.expires_at||null,
    platforms,egress_state:row?.egress_state||'idle'};
}
