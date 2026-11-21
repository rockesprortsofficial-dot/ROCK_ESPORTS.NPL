/* Dedicated renderer: the existing Tournament compositor is never modified. */
(()=>{'use strict';
class SocialCompositor extends RockBroadcastCompositor{
 rebuild(s){const h=this.h;h.clearRect(0,0,1920,1080);h.fillStyle='#010611';h.fillRect(0,0,1920,1080);this.text(s.branding.headerName+' · '+(s.mode==='gameplay'?'GAMEPLAY':'MEMBERS WATCH PARTY'),470,34,27,s.mode==='gameplay'?'#20e9ff':'#ff38b3',1400);h.strokeStyle='#ff1ab5';h.lineWidth=3;h.strokeRect(2,2,1916,1076);this.geometry=RockBroadcastSocialLayout.layout(s.people.length,s.mode);this.panel(...this.geometry.game);this.text('Waiting for shared gameplay / video',600,460,28,'#83bddd');for(let i=0;i<this.geometry.tiles.length;i++){const r=this.geometry.tiles[i];this.panel(...r,i%2?'#fc1cb6':'#12d7ff');this.text(s.people[i]?.label||'Camera off',r[0]+4,r[1]+r[3]-3,Math.min(19,Math.max(7,r[3]*.18)),'#fff',r[2]-8);}this.monitorLogo(s.branding.monitorLogo,...this.geometry.logo);this.text(s.branding.monitorName,this.geometry.logo[0]-100,1074,13,'#b5edff',200);}
 gameplayVideo(video,rect,{fill=false,zoom=1,mirror=false,filter='natural'}={}){
  if(!(video?.readyState>=2&&video.videoWidth&&video.videoHeight))return;
  const ctx=this.ctx,[x,y,w,h]=rect;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.fillStyle='#000';ctx.fillRect(x,y,w,h);
  ctx.filter=RockBroadcastSocialLayout.filters[filter];
  if(mirror){ctx.translate(2*x+w,0);ctx.scale(-1,1);}
  ctx.drawImage(video,...RockBroadcastSocialLayout.videoRect(rect,video.videoWidth,video.videoHeight,fill,zoom));
  ctx.restore();
 }
 frame(time){
  if(!this.running)return;
  if(time-this.last>=1000/this.fps-1){
   this.last=time;
   const s=this.getState(),gameplay=s.mode==='gameplay';
   if(s!==this.lastState||!this.key){this.lastState=s;this.key='ready';this.rebuild(s);}
   this.ctx.drawImage(this.hud,0,0);
   const v=this.getVideos();
   if(gameplay){
    this.ctx.fillStyle='#010611';this.ctx.fillRect(8,6,1904,45);
    const offset=this.reducedMotion?0:Math.sin(time/1500)*130;
    const title=s.branding.headerName+' · GAMEPLAY';
    this.ctx.save();this.ctx.font='bold 27px Arial';
    this.ctx.fillStyle='#20e9ff';this.ctx.textAlign='center';
    this.ctx.fillText(title,960+offset,34,1400);
    this.ctx.restore();
    this.gameplayVideo(v.game,this.geometry.game,{fill:s.gameFit==='fill',zoom:s.gameZoom});
   }else this.video(v.game,this.geometry.game);
   this.geometry.tiles.forEach((r,i)=>{
    const rect=[r[0]+2,r[1]+2,r[2]-4,Math.max(1,r[3]*.8-3)];
    if(gameplay){
     this.gameplayVideo(v.people[i],rect,{...s.cameraStyles?.[i],fill:true});
     const ctx=this.ctx,led=i?'#ff56ca':'#28eaff';
     ctx.save();ctx.strokeStyle=led;ctx.lineWidth=4;ctx.shadowColor=led;ctx.shadowBlur=14;
     ctx.strokeRect(r[0]+2,r[1]+2,r[2]-4,r[3]-4);ctx.restore();
    }
    else this.video(v.people[i],rect);
   });
   this.frames++;
  }
  this.timer=requestAnimationFrame(t=>this.frame(t));
 }
}
class SocialStudio extends RockBroadcastStudio{
 async connect(role,id,password){
  await this.disconnect();const generation=++this.generation,sdk=await this.sdk(),response=await this.api(role==='viewer'?'viewer-token':role==='cohost'?'cohost-token':'owner-token',{id,password});if(generation!==this.generation)throw Error('Call cancelled');
  // The owner canvas still needs remote cameras while the owner scrolls to controls.
  // Ordinary participants/viewers retain adaptive subscriptions for their visible tiles.
  const room=new sdk.Room({adaptiveStream:role!=='owner',dynacast:true,audioCaptureDefaults:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},disconnectOnPageLeave:true});this.room=room;this.id=response.id;this.role=role;
  room.on(sdk.RoomEvent.TrackSubscribed,(track,pub,p)=>this.receive(track,pub,p));room.on(sdk.RoomEvent.TrackUnsubscribed,track=>this.remove(track.sid));room.on(sdk.RoomEvent.Disconnected,()=>{if(this.room===room){this.clearReceived();this.onState('disconnected');}});room.on(sdk.RoomEvent.Reconnecting,()=>this.onState('reconnecting'));room.on(sdk.RoomEvent.Reconnected,()=>this.onState('connected'));
  try{await room.connect(response.server_url,response.token);if(generation!==this.generation){await room.disconnect();throw Error('Call cancelled');}await room.startAudio().catch(()=>this.onState('audio-blocked'));this.onState('connected');return response;}catch(e){if(this.room===room)await this.disconnect();else await room.disconnect();throw e;}
 }
 receive(track,pub,p){if(this.role!=='viewer'){super.receive(track,pub,p);return;}if(p.identity===this.room?.localParticipant.identity||this.received.has(track.sid))return;this.received.set(track.sid,{track,pub,participant:p});this.onTrack(track,pub,p,true);}
 remove(sid){const r=this.received.get(sid);if(!r)return;for(const el of r.track.detach()){if(el.closest?.('#rbs-screen,#rbs-view-stage'))el.srcObject=null;else el.remove();}if(this.role==='owner')this.audio.setRemote(sid,null);this.onTrack(r.track,r.pub,r.participant,false);this.received.delete(sid);}

 async startOutput(compositor,fps=30){
  if(this.role!=='owner'||!this.room)throw Error('Connect the owner call first');if(this.output||this.starting)throw Error('Website output is already starting/running');
  if(!this.audio.mic)throw Error('Enable your microphone first');this.starting=true;const generation=this.generation;let room;try{await this.audio.init();const response=await this.api('output-token',{id:this.id}),sdk=await this.sdk();if(generation!==this.generation)throw Error('Output cancelled');room=new sdk.Room({dynacast:true});this.output=room;this.compositor=compositor;await room.connect(response.server_url,response.token,{autoSubscribe:false});if(generation!==this.generation)throw Error('Output cancelled');const stream=compositor.start(fps),S=sdk.Track.Source;
   await room.localParticipant.publishTrack(stream.getVideoTracks()[0].clone(),{source:S.ScreenShare,name:'social-composite',simulcast:true,screenShareEncoding:{maxBitrate:8000000,maxFramerate:fps===60?60:30},stream:'social-output'});
   await room.localParticipant.publishTrack(this.audio.getMixedTrack().clone(),{source:S.ScreenShareAudio,name:'social-audio',forceStereo:true,audioPreset:{maxBitrate:192000},dtx:false,stream:'social-output'});
   if(generation!==this.generation)throw Error('Output cancelled');await this.api('live',{id:this.id});this.onState('live');
  }catch(e){if(this.output===room)await this.stopOutput(false);else await room?.disconnect();throw e;}finally{this.starting=false;}
 }
}
window.RockBroadcastSocialCompositor=SocialCompositor;window.RockBroadcastSocialStudio=SocialStudio;
})();
