/* Optional, local camera background processing for Gameplay. */
(()=>{
 'use strict';
 const bundle='https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
 let loading;
 const imageCache=new Map();
 const rooms={cyan:[0,0],violet:[1,0],red:[0,1],warm:[1,1]};
 function getStudio(name){
  const path=name==='rock'?'assets/rock-studio.jpg':'assets/rock-studio-options.jpg';
  if(!imageCache.has(path)){
   const image=new Image();
   const ready=new Promise((resolve,reject)=>{
    image.onload=()=>resolve(image);
    image.onerror=()=>{imageCache.delete(path);reject(Error('Studio image unavailable'));};
   });
   image.src=new URL(path,document.baseURI).href;
   imageCache.set(path,ready);
  }
  return imageCache.get(path);
 }
 function paintStudio(ctx,studio,name,w,h){
  let x=0,y=0,sw=studio.naturalWidth,sh=studio.naturalHeight;
  if(rooms[name]){
   const [col,row]=rooms[name],halfW=sw/2,halfH=sh/2;
   x=col*halfW+4;y=row*halfH+4;sw=halfW-8;sh=halfH-60;
  }
  // Draw the full studio without stretching it or cutting off the logo.
  const fit=Math.min(w/sw,h/sh),dw=sw*fit,dh=sh*fit;
  ctx.drawImage(studio,x,y,sw,sh,(w-dw)/2,(h-dh)/2,dw,dh);
  const fill=Math.max(w/sw,h/sh),fw=sw*fill,fh=sh*fill;
  ctx.drawImage(studio,x,y,sw,sh,(w-fw)/2,(h-fh)/2,fw,fh);
 }

 async function createSegmenter(){
  if(!window.SelfieSegmentation){
   loading??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=bundle+'selfie_segmentation.js';
    script.onload=resolve;script.onerror=()=>reject(Error('Background module unavailable'));
    document.head.append(script);
   }).catch(error=>{loading=null;throw error;});
   await loading;
  }
  const segmenter=new window.SelfieSegmentation({locateFile:file=>bundle+file});
  segmenter.setOptions({modelSelection:0});
  return segmenter;
 }
 function draw(canvas,{image,segmentationMask},target){
  const w=480,h=Math.round(w/target.aspect);
  const width=image.width||image.videoWidth,height=image.height||image.videoHeight;
  if(!width||!height)return false;
  const fit=Math.min(w/width,h/height),dw=width*fit,dh=height*fit;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,w,h);
  const {style,studio,background}=target;
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(style.mirror?-style.zoom:style.zoom,style.zoom);
  ctx.drawImage(segmentationMask,-dw/2,-dh/2,dw,dh);
  ctx.globalCompositeOperation='source-in';
  ctx.filter=style.filter;
  ctx.drawImage(image,-dw/2,-dh/2,dw,dh);
  ctx.restore();
  ctx.globalCompositeOperation='destination-over';
  paintStudio(ctx,studio,background,w,h);
  ctx.restore();
  return true;
 }
 window.RockGameplayBackground=class{
  constructor(cameras,failed){
   this.cameras=cameras;
   this.failed=failed;
   this.timer=null;
   this.running=false;
   this.cursor=0;
   this.current=null;
   this.segmenter=null;
  }
  update(){
   if(this.running||this.timer!==null||!this.cameras().length)return;
   this.timer=setTimeout(()=>{this.timer=null;this.frame();},65);
  }
  async frame(){
   const cameras=this.cameras();
   if(!cameras.length)return;
   const camera=cameras[this.cursor++%cameras.length];
   this.running=true;
   this.current=camera;
   try{
    if(!this.segmenter){
     this.segmenter=await createSegmenter();
     this.segmenter.onResults(result=>{
      const target=this.current;
      if(!target||!target.active())return;
      if(draw(target.canvas,result,target))target.canvas.hidden=false;
     });
    }
    if(camera.active()&&camera.video.readyState>=2&&!document.hidden){
     camera.studio=await getStudio(camera.background);
     if(camera.active())await this.segmenter.send({image:camera.video});
    }
   }catch(error){this.failed(error);}
   finally{this.current=null;this.running=false;this.update();}
  }
 };
})();
