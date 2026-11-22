/* Separate private two-host studio and public composed-output room. Never uses meeting rooms. */
(()=>{'use strict';
class BroadcastStudio {
  constructor({api,audio,onTrack=()=>{},onState=()=>{}}){this.api=api;this.audio=audio;this.onTrack=onTrack;this.onState=onState;this.room=null;this.output=null;this.role=null;this.id=null;this.sent=new Map();this.received=new Map();this.generation=0;}
  async sdk(){if(window.LivekitClient?.Room)return window.LivekitClient;if(!this.loading)this.loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/livekit-client@2.24.1/dist/livekit-client.umd.min.js';s.onload=()=>window.LivekitClient?.Room?resolve(window.LivekitClient):reject(Error('Studio library unavailable'));s.onerror=()=>{this.loading=null;reject(Error('Studio library unavailable'));};document.head.append(s);});return this.loading;}
  async connect(role,id,password){
    await this.disconnect();const generation=++this.generation,sdk=await this.sdk(),response=await this.api(role==='viewer'?'viewer-token':role==='cohost'?'cohost-token':'owner-token',{id,password});
    if(generation!==this.generation)throw Error('Studio connection cancelled');
    const room=new sdk.Room({adaptiveStream:true,dynacast:true,audioCaptureDefaults:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},disconnectOnPageLeave:true});
    this.room=room;this.id=response.id;this.role=role;
    room.on(sdk.RoomEvent.TrackSubscribed,(track,publication,participant)=>this.receive(track,publication,participant));
    room.on(sdk.RoomEvent.TrackUnsubscribed,(track)=>this.remove(track.sid));
    room.on(sdk.RoomEvent.Disconnected,()=>{if(this.room===room){this.clearReceived();this.onState('disconnected');}});
    room.on(sdk.RoomEvent.Reconnecting,()=>this.onState('reconnecting'));
    room.on(sdk.RoomEvent.Reconnected,()=>this.onState('connected'));
    try{await room.connect(response.server_url,response.token);if(generation!==this.generation){await room.disconnect();throw Error('Studio connection cancelled');}await room.startAudio().catch(()=>this.onState('audio-blocked'));this.onState('connected');return response;}catch(e){if(this.room===room)await this.disconnect();else await room.disconnect();throw e;}
  }
  receive(track,pub,participant){
    // SDK remote-only subscriptions provide mix-minus: own mic is never played back.
    if(participant.identity===this.room?.localParticipant.identity||this.received.has(track.sid))return;
    const sdk=window.LivekitClient;this.received.set(track.sid,{track,pub,participant});
    if(track.kind==='audio'){
      const element=track.attach();element.dataset.broadcastAudio=track.sid;element.autoplay=true;document.getElementById('live-broadcast').append(element);
      element.play()?.catch(()=>this.onState('audio-blocked'));
      if(this.role==='owner'&&participant.identity==='cohost')this.audio.setRemote(track.sid,track.mediaStreamTrack).catch(()=>this.onState('audio-blocked'));
    }
    this.onTrack(track,pub,participant,true);
  }
  remove(sid){const received=this.received.get(sid);if(!received)return;received.track.detach().forEach(e=>e.remove());if(this.role==='owner')this.audio.setRemote(sid,null);this.onTrack(received.track,received.pub,received.participant,false);this.received.delete(sid);}
  clearReceived(){for(const sid of [...this.received.keys()])this.remove(sid);}
  async sync({screen,camera,mic}){
    if(!this.room||!['owner','cohost'].includes(this.role))throw Error('Join the studio before sending media');
    const S=window.LivekitClient.Track.Source;
    const wanted=new Map([['mic',{track:mic?.getAudioTracks()[0],source:S.Microphone}],['camera',{track:camera?.getVideoTracks()[0],source:S.Camera}]]);
    if(this.role==='owner'){wanted.set('game',{track:screen?.getVideoTracks()[0],source:S.ScreenShare});wanted.set('game-audio',{track:screen?.getAudioTracks()[0],source:S.ScreenShareAudio});}
    for(const [name,sent] of this.sent){if(wanted.get(name)?.track?.id!==sent.original){await this.room.localParticipant.unpublishTrack(sent.track);sent.track.stop();this.sent.delete(name);}}
    for(const [name,value] of wanted){if(!value.track||this.sent.has(name))continue;const clone=value.track.clone();try{await this.room.localParticipant.publishTrack(clone,{name,source:value.source,simulcast:clone.kind==='video'&&(name!=='camera'||this.cameraSimulcast!==false),videoEncoding:{maxBitrate:name==='game'?6000000:1200000,maxFramerate:30},screenShareEncoding:{maxBitrate:6000000,maxFramerate:30},stream:name.startsWith('game')?'gameplay':'host',...(name==='game-audio'?{audioPreset:{maxBitrate:192000},forceStereo:true,dtx:false,red:true}:{})});this.sent.set(name,{original:value.track.id,track:clone});}catch(e){clone.stop();throw e;}}
  }
  async startOutput(compositor,fps=30){
    if(this.role!=='owner'||!this.room)throw Error('Owner studio connection required');if(this.output||this.starting)throw Error('Output already connected or starting');
    if(!this.audio.screen?.getAudioTracks().length)throw Error('Game audio is missing. Enable shared tab/system audio first.');
    if(!this.audio.mic?.getAudioTracks().length)throw Error('Enable the owner microphone first.');
    fps=fps===60?60:30;this.starting=true;const generation=this.generation;let room;
    try{const response=await this.api('output-token',{id:this.id}),sdk=await this.sdk();if(generation!==this.generation)throw Error('Output cancelled');room=new sdk.Room({dynacast:true});this.output=room;this.compositor=compositor;await room.connect(response.server_url,response.token,{autoSubscribe:false});if(generation!==this.generation)throw Error('Output cancelled');const stream=compositor.start(fps),video=stream.getVideoTracks()[0],mixed=this.audio.getMixedTrack();
      await room.localParticipant.publishTrack(video.clone(),{source:sdk.Track.Source.ScreenShare,name:'broadcast-composite',simulcast:true,videoEncoding:{maxBitrate:fps===60?12000000:8000000,maxFramerate:fps},screenShareEncoding:{maxBitrate:fps===60?12000000:8000000,maxFramerate:fps},degradationPreference:'balanced',stream:'broadcast-composite'});
      await room.localParticipant.publishTrack(mixed.clone(),{source:sdk.Track.Source.ScreenShareAudio,name:'broadcast-mix',stream:'broadcast-composite',audioPreset:{maxBitrate:192000},forceStereo:true,dtx:false,red:true});
      if(generation!==this.generation)throw Error('Output cancelled');await this.api('live',{id:this.id});this.onState('live');
    }catch(e){if(this.output===room)await this.stopOutput(false);else await room?.disconnect();throw e;}finally{this.starting=false;}
  }
  async stopOutput(notify=true){let failure;try{if(notify&&this.id)await this.api('pause',{id:this.id});}catch(e){failure=e;}finally{if(this.output)await this.output.disconnect();this.output=null;this.compositor?.stop();this.compositor=null;this.onState(this.room?'connected':'disconnected');}if(failure)throw failure;}
  async resumeAudio(){await this.room?.startAudio();for(const {track} of this.received.values())if(track.kind==='audio')for(const element of track.attachedElements||[])await element.play();}
  mute(kind,muted){for(const [name,item] of this.sent)if(name===kind)item.track.enabled=!muted;}
  async disconnect(){this.generation++;await this.stopOutput(false);this.clearReceived();if(this.room)await this.room.disconnect();this.room=null;for(const {track} of this.sent.values())track.stop();this.sent.clear();this.role=null;}
}
window.RockBroadcastStudio=BroadcastStudio;
})();
