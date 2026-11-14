/* Local audio check only. A remote transport must explicitly publish the mixed track. */
(()=>{'use strict';class BroadcastAudio{
 constructor(){this.context=null;this.sources=[];this.mic=null;this.screen=null;this.monitoring=false;}
 async init(){if(!this.context){this.context=new AudioContext();this.destination=this.context.createMediaStreamDestination();this.master=this.context.createGain();this.master.gain.value=.8;this.master.connect(this.destination);this.analyser=this.context.createAnalyser();this.master.connect(this.analyser);this.monitor=this.context.createGain();this.monitor.gain.value=0;this.master.connect(this.monitor);this.monitor.connect(this.context.destination);}await this.context.resume();}
 async setScreen(stream){await this.init();this.screen=stream;this.rebuild();return stream?.getAudioTracks().length>0;}
 async enableMic(){await this.init();const mic=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});this.mic?.getTracks().forEach(t=>t.stop());this.mic=mic;this.rebuild();}
 rebuild(){this.sources.forEach(n=>n.disconnect());this.sources=[];for(const [key,stream] of [['game',this.screen],['voice',this.mic]]){if(!stream?.getAudioTracks().length)continue;const source=this.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())),gain=this.context.createGain();gain.gain.value=this[key+'Volume']??.8;source.connect(gain);gain.connect(this.master);this[key+'Gain']=gain;this.sources.push(source,gain);}}
 volume(key,value){this[key+'Volume']=value;if(this[key+'Gain'])this[key+'Gain'].gain.value=value;}
 monitorOn(on){this.monitoring=on;if(this.monitor)this.monitor.gain.value=on?1:0;}
 level(){if(!this.analyser)return 0;const a=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(a);return Math.max(...a.map(n=>Math.abs(n-128)))/128;}
 getMixedTrack(){return this.destination?.stream.getAudioTracks()[0]||null;}
 async stop(){this.sources.forEach(n=>n.disconnect());this.sources=[];this.mic?.getTracks().forEach(t=>t.stop());this.mic=null;this.screen=null;if(this.context)await this.context.close();this.context=null;this.analyser=null;this.gameGain=this.voiceGain=null;this.destination=null;this.monitor=null;}
}window.RockBroadcastAudio=BroadcastAudio;})();
