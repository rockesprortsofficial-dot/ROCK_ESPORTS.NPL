/* Optional, local camera background processing for Gameplay. */
(()=>{
 'use strict';
 const bundle='https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
 let loading;
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
 function draw(canvas,{image,segmentationMask},accent){
  const scale=Math.min(1,480/Math.max(image.width,image.height));
  const w=Math.round(image.width*scale),h=Math.round(image.height*scale);
  if(!w||!h)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(segmentationMask,0,0,w,h);
  ctx.globalCompositeOperation='source-in';
  ctx.drawImage(image,0,0,w,h);
  ctx.globalCompositeOperation='destination-over';
  ctx.strokeStyle=accent;ctx.shadowColor=accent;ctx.shadowBlur=15;
  ctx.lineWidth=Math.max(2,w/110);
  ctx.beginPath();
  ctx.moveTo(-5,h*.35);ctx.lineTo(w*.41,h*.07);ctx.lineTo(w*.72,h*.07);ctx.lineTo(w+5,h*.34);
  ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.06,h);ctx.lineTo(w*.06,h*.46);ctx.stroke();
  ctx.shadowBlur=0;
  const wall=ctx.createLinearGradient(0,0,w,h);
  wall.addColorStop(0,'#17284c');wall.addColorStop(.55,'#10192c');wall.addColorStop(1,'#32183c');
  ctx.fillStyle=wall;ctx.fillRect(0,0,w,h);
  ctx.restore();
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
      draw(target.canvas,result,target.accent);
      target.canvas.hidden=false;
     });
    }
    if(camera.active()&&camera.video.readyState>=2&&!document.hidden)await this.segmenter.send({image:camera.video});
   }catch(error){this.failed(error);}
   finally{this.current=null;this.running=false;this.update();}
  }
 };
})();
