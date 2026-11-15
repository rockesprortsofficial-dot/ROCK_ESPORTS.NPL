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
