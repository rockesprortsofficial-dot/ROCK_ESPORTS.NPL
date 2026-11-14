/* 1080p outgoing canvas. HUD is cached; only video rectangles redraw each frame. */
(()=>{'use strict';
class BroadcastCompositor {
  constructor(getState,getVideos){
    this.getState=getState;this.getVideos=getVideos;this.canvas=document.createElement('canvas');
    this.canvas.width=1920;this.canvas.height=1080;this.ctx=this.canvas.getContext('2d',{alpha:false});
    this.hud=document.createElement('canvas');this.hud.width=1920;this.hud.height=1080;this.h=this.hud.getContext('2d');
    this.images=new Map();this.key='';this.running=false;this.frames=0;this.last=0;this.fps=30;
  }
  image(url){
    if(!url||!(/^(data:image\/(png|jpeg|webp);base64,|assets\/)/i.test(url)))return null;
    if(!this.images.has(url)){const i=new Image();i.onload=()=>{this.key='';};i.onerror=()=>{};i.src=url;this.images.set(url,i);}
    const image=this.images.get(url);return image.complete&&image.naturalWidth?image:null;
  }
  text(text,x,y,size=20,color='#fff',max=1000){const h=this.h;h.fillStyle=color;h.font=`bold ${size}px Arial`;h.fillText(String(text??''),x,y,max);}
  panel(x,y,w,h,color='#19baff'){const c=this.h;c.fillStyle='#030a19';c.fillRect(x,y,w,h);c.strokeStyle=color;c.lineWidth=3;c.shadowColor=color;c.shadowBlur=10;c.strokeRect(x,y,w,h);c.shadowBlur=0;}
  picture(url,x,y,w,h,out=false){const i=this.image(url),c=this.h;c.fillStyle='#17324c';c.fillRect(x,y,w,h);if(i){c.save();if(out)c.filter='grayscale(1)';c.drawImage(i,x,y,w,h);c.restore();}else{c.fillStyle='#60849d';c.beginPath();c.arc(x+w/2,y+h*.3,Math.min(w,h)*.2,0,Math.PI*2);c.fill();c.fillRect(x+w*.2,y+h*.6,w*.6,h*.4);}}
  rebuild(s){
    const C=RockBroadcastCore,h=this.h;h.clearRect(0,0,1920,1080);h.fillStyle='#020614';h.fillRect(0,0,1920,1080);
    this.panel(8,8,1904,74);this.picture(s.branding.headerLogo,18,14,62,62);
    this.text(s.branding.headerName,95,48,30,'#fff',410);this.text(s.tournament,530,43,29,'#fff',880);
    this.text(`CLASSIC · GROUP ${s.group} · MATCH ${s.match} · ${s.map}`,540,68,17,'#82dfff',900);
    this.text('LIVE BROADCAST',1640,42,25,'#ff4b65',260);this.text('MANUAL DATA · VERIFY',1635,67,17,'#81dfff',270);
    s.teams.forEach((t,index)=>{
      const x=index<8?10:1570,y=96+(index%8)*115;this.panel(x,y,340,107,index%2?'#239cff':'#ff2255');
      this.text('A'+(index+1),x+6,y+25,24,'#ff697e',48);this.text(t.name,x+58,y+23,18,'#fff',215);
      this.text('K'+t.players.reduce((n,p)=>n+p.kills,0),x+295,y+24,17,'#fff',40);
      if(t.logo)this.picture(t.logo,x+5,y+37,42,42);
      t.players.forEach((p,j)=>{const px=x+51+j*71;this.picture(p.photo,px+7,y+30,52,43,p.status==='out');this.text(p.name,px,y+87,12,'#fff',68);h.fillStyle=p.status==='out'?'#ea1b37':p.status==='knock'?'#e1bd00':p.health<40?'#e3ab00':'#10cc36';h.fillRect(px,y+91,67,12);this.text(p.status==='out'?'OUT':p.status==='knock'?'KNOCK':p.health+'% · K'+p.kills,px+2,y+101,10,'#fff',63);});
    });
    this.panel(364,96,1192,662);this.text('GAMEPLAY NOT CONNECTED',650,420,30,'#8dc5e5');
    const ended=s.phase==='ended';this.gameRect=ended?[368,100,1184,360]:[368,100,1184,654];this.hostRects=ended?[[370,485,465,425],[1085,485,465,425]]:[[370,780,350,130],[1200,780,350,130]];this.ringY=ended?695:843;
    this.hostRects.forEach((r,i)=>{const style=s.hostStyles?.[i]||{},color=({neon:'#ff2454',blue:'#15bfff',gold:'#ffc83b',clean:'#c9dbea'})[style.theme]||'#ff2454';this.panel(r[0]-4,r[1]-4,r[2]+8,r[3]+8,color);const background=this.image(style.background);if(background)this.h.drawImage(background,r[0],r[1],r[2],r[3]);this.text(s.hosts[i],r[0]+15,r[1]+r[3]-12,22,'#fff',r[2]-30);});
    h.strokeStyle='#1ec8ff';h.lineWidth=5;h.beginPath();h.ellipse(960,this.ringY,ended?110:215,65,0,0,2*Math.PI);h.stroke();
    this.picture(s.branding.monitorLogo,923,this.ringY-53,74,62);this.text(s.branding.monitorName,ended?865:790,this.ringY+47,ended?15:24,'#fff',ended?190:340);
    this.panel(364,930,460,91);this.text('LIVE RANKING · PROVISIONAL',376,950,16,'#9be6ff');
    C.ranking(s.teams).slice(0,4).forEach((t,i)=>this.text(`${i+1}   ${t.short||t.name}    K ${t.kills}    PTS ${t.total}`,378,966+i*16,14,i===0?'#ffd94a':'#fff',430));
    this.panel(836,930,345,91);this.text(`MAP ${s.map}`,849,955,18);this.text(`MATCH ${s.match} · GROUP ${s.group}`,849,982,18);this.text('PMWC 10/6/5/4/3/2/1/1 + ELIMS',849,1007,14,'#9be6ff');
    const st=C.stats(s.teams);this.panel(1193,930,363,91);this.text(`ALIVE ${st.alive}   KNOCK ${st.knocked}`,1207,957,21);this.text(`OUT ${st.out}   ELIMS ${st.kills}`,1207,986,21);this.text(`TEAMS REMAINING ${st.remaining}`,1207,1009,16,'#9be6ff');
    this.panel(10,1035,1900,36);const p=C.promo(Date.now(),Date.parse(s.startedAt)||0,s.promotion.enabled&&s.phase==='playing');
    this.text(p.visible?s.promotion.links.map(l=>l.label).join('   •   ')||'ROCK ESPORTS OFFICIAL BROADCAST':'ROCK ESPORTS · ALIVE / KNOCK / OUT · OWNER VERIFIED DATA',30,1060,20,p.visible?'#fff':'#8edfff',1850);
    // Keep a bounded image cache after roster/branding changes.
    if(this.images.size>160){const used=new Set([s.branding.headerLogo,s.branding.monitorLogo,...s.teams.flatMap(t=>[t.logo,...t.players.map(p=>p.photo)])]);for(const url of this.images.keys())if(!used.has(url))this.images.delete(url);}
  }
  video(video,rect,style={}){if(video?.readyState>=2&&video.videoWidth){const [x,y,w,h]=rect,scale=Math.min(w/video.videoWidth,h/video.videoHeight)*Math.min(1.5,Math.max(1,Number(style.zoom)||1)),dw=video.videoWidth*scale,dh=video.videoHeight*scale;this.ctx.save();this.ctx.beginPath();this.ctx.rect(x,y,w,h);this.ctx.clip();this.ctx.fillStyle='#000';this.ctx.fillRect(x,y,w,h);this.ctx.filter=`brightness(${Math.min(1.5,Math.max(.7,Number(style.brightness)||1))}) contrast(${Math.min(1.4,Math.max(.8,Number(style.contrast)||1))})`;this.ctx.drawImage(video,x+(w-dw)/2,y+(h-dh)/2,dw,dh);this.ctx.restore();}}
  frame(time){if(!this.running)return;if(time-this.last>=1000/this.fps-1){this.last=time;const s=this.getState(),promo=RockBroadcastCore.promo(Date.now(),Date.parse(s.startedAt)||0,s.promotion.enabled&&s.phase==='playing').visible;if(s!==this.lastState||this.key===''||promo!==this.lastPromo){this.key='ready';this.lastState=s;this.lastPromo=promo;this.rebuild(s);}this.ctx.drawImage(this.hud,0,0);const videos=this.getVideos();this.video(videos.game,this.gameRect);this.hostRects.forEach((r,i)=>this.video(videos.hosts[i],[r[0]+8,r[1]+5,r[2]-16,r[3]-45],s.hostStyles?.[i]||{}));if(!this.reducedMotion){this.ctx.lineWidth=5;this.ctx.strokeStyle='#ff2356';this.ctx.beginPath();this.ctx.ellipse(960,this.ringY,s.phase==='ended'?110:215,65,0,time/1400,time/1400+Math.PI*.6);this.ctx.stroke();}this.frames++;}this.timer=requestAnimationFrame(t=>this.frame(t));}
  start(fps=30){if(this.running)return this.stream;this.fps=fps===60?60:30;this.reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;this.running=true;this.frame(0);this.stream=this.canvas.captureStream(this.fps);return this.stream;}
  stop(){this.running=false;cancelAnimationFrame(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
}
window.RockBroadcastCompositor=BroadcastCompositor;
})();
