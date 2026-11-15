/* Pure geometry shared by the preview and outgoing 1080p video. */
((root)=>{'use strict';
function layout(count,mode='watchparty'){
 count=Math.max(1,Math.floor(Number(count)||1));
 if(mode==='gameplay')return {game:[6,54,1908,828],logo:[960,980,130],tiles:[[604,904,234,150],[1082,904,234,150]],columns:2,rows:1};
 const columns=Math.min(count,Math.max(1,Math.ceil(Math.sqrt(count*8)))),rows=Math.ceil(count/columns),w=1740/columns,h=160/rows;
 return {game:[6,54,1908,828],logo:[82,980,126],columns,rows,tiles:Array.from({length:count},(_,i)=>[166+(i%columns)*w,900+Math.floor(i/columns)*h,w-6,h-6])};
}
const api={layout};if(typeof module!=='undefined')module.exports=api;else root.RockBroadcastSocialLayout=api;
})(typeof window==='undefined'?globalThis:window);
