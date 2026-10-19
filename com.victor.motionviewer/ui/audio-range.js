/* Extends the existing AudioPreview; original source files and ProjectItem I/O stay untouched. */
(function(){
 'use strict';
 async function encode(buffer,range,onProgress,cancelled){
  const M=typeof AltoTimeline!=='undefined'?AltoTimeline:require('../timeline-model.js');
  const o=M.audio(range,buffer.duration),channels=buffer.numberOfChannels,rate=buffer.sampleRate;
  const start=Math.round(o.in*rate),frames=Math.min(buffer.length-start,Math.round(o.duration*rate)),bytes=frames*channels*2;
  if(frames<1||bytes>64*1024*1024)throw Error('Audio excerpt must contain samples and fit 64 MB WAV');
  const out=new ArrayBuffer(44+bytes),view=new DataView(out);
  const word=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,36+bytes,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,bytes,true);
  const data=Array.from({length:channels},(_,ch)=>buffer.getChannelData(ch));
  for(let base=0;base<frames;base+=32768){if(cancelled&&cancelled())throw Error('Cancelled');const end=Math.min(frames,base+32768);for(let i=base;i<end;i++){
   const gain=Math.min(1,o.fadeIn?i/rate/o.fadeIn:1,o.fadeOut?(frames-1-i)/rate/o.fadeOut:1);
   for(let ch=0;ch<channels;ch++){const sample=Math.max(-1,Math.min(1,data[ch][start+(range.reverse?frames-1-i:i)]*Math.max(0,gain)));view.setInt16(44+(i*channels+ch)*2,Math.round(sample*(sample<0?32768:32767)),true);}
  }if(onProgress)onProgress(end/frames);await new Promise(resolve=>setTimeout(resolve,0));}
  return out;
 }
 // CEP --mixed-context exposes CommonJS AND window to the same script tag.
 // Keep the Node encoder export without skipping the renderer registration.
 if(typeof module!=='undefined'&&module.exports)module.exports={encode};
 if(typeof window==='undefined')return;
 window.AltoAudio={init(U,player){
  const {el,button,t}=U,container=el('div','audio-range-controls'),fields={},range={in:0,out:0,fadeIn:0,fadeOut:0};let cancelled=false,working=false;
  for(const [key,label]of [['in','In'],['out','Out'],['fadeIn','Fade In'],['fadeOut','Fade Out']]){const wrap=el('label','audio-range-field'),input=el('input');input.type='number';input.min=0;input.step=.01;input.value=0;input.setAttribute('aria-label',label);wrap.append(el('span','',label),input);fields[key]=input;input.onchange=()=>{if(!player.audioBuffer)return;try{const next=Object.assign({},range,{[key]:Number(input.value)});AltoTimeline.audio(next,player.audioBuffer.duration);Object.assign(range,next);player.pause();player.draw();}catch(e){input.value=range[key];U.error(e);}};container.append(wrap);}
  const insert=button(t('Вставить участок','Insert excerpt'),()=>U.operation(async()=>{
   if(working)return;if(!window.MZLocal.available)throw Error('MZ_DESKTOP_REQUIRED');if(!player.audioBuffer||!player.asset)throw Error('Load audio first');
   if(player.pitch!==1)throw Error(t('Для вставки участка сбрось тон в 1x. Изменённый тон можно сначала экспортировать кнопкой WAV и открыть полученный файл.','Reset pitch to 1x for excerpt insertion, or export the pitched WAV first and open that file.'));
   const captured=Object.assign({},range,{reverse:player.reverseCheck.checked}),buffer=player.audioBuffer,track=U.preferences.audioTrack-1,asset=player.asset;
   const spec=AltoTimeline.audio(captured,buffer.duration),destination=await U.host('MZ.audioDestination',[track,spec.duration]);
   working=true;cancelled=false;cancel.hidden=false;progress.hidden=false;progress.value=0;insert.disabled=true;let output=null;
   try{const bytes=await encode(buffer,captured,p=>progress.value=p,()=>cancelled);if(cancelled)throw Error('Cancelled');
    const req=window.require||require,fs=req('fs'),path=req('path');output=path.join(window.MZLocal.assetDir(),'excerpt-'+window.MZLocal.id()+'.wav');
    await new Promise((resolve,reject)=>fs.writeFile(output,req('buffer').Buffer.from(bytes),e=>e?reject(e):resolve()));
    if(cancelled){fs.unlinkSync(output);output=null;throw Error('Cancelled');}
    // No cancellation once Premiere starts its short verified transaction.
    cancel.hidden=true;const retainedPath=output;window.MZLocal.addAsset({id:window.MZLocal.id(),path:retainedPath,name:asset.name+' · '+spec.in.toFixed(2)+'–'+spec.out.toFixed(2)+' s',tags:'excerpt',type:'audio',created:Date.now()});output=null;
    await U.host('MZ.insertAudioRange',[retainedPath,track,destination.token,spec.duration]);
    U.status('Участок вставлен с заданными плавными краями.','Excerpt inserted with its fades.');
   }finally{if(output){try{(window.require||require)('fs').unlinkSync(output);}catch{}}working=false;cancel.hidden=true;progress.hidden=true;insert.disabled=false;}
  }),'primary');
  const cancel=button(t('Отмена','Cancel'),()=>{cancelled=true;});cancel.hidden=true;const progress=el('progress');progress.max=1;progress.hidden=true;
  container.append(insert,cancel,progress);player.el.append(container);
  const originalShow=player.show,originalDraw=player.draw,originalPlay=player.play;
  player.show=async function(asset){const loading=originalShow.call(this,asset),token=this.loadToken;await loading;if(token!==this.loadToken||!this.audioBuffer)return;range.in=0;range.out=this.audioBuffer.duration;range.fadeIn=0;range.fadeOut=0;Object.keys(fields).forEach(k=>{fields[k].value=range[k].toFixed(2);fields[k].max=this.audioBuffer.duration;});this.draw();};
  player.draw=function(){originalDraw.call(this);if(!this.audioBuffer||range.out<=range.in)return;const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height,d=this.audioBuffer.duration,a=range.in/d*w,b=range.out/d*w;ctx.fillStyle='#07172b77';ctx.fillRect(0,0,a,h);ctx.fillRect(b,0,w-b,h);ctx.strokeStyle='#b9dcff';ctx.lineWidth=2;ctx.strokeRect(a,1,Math.max(1,b-a),h-2);for(const x of [a,b]){ctx.fillStyle='#e1efff';ctx.fillRect(Math.max(0,x-2),0,4,h);}};
  player.play=function(){if(!this.audioBuffer)return;const o=AltoTimeline.audio(range,this.audioBuffer.duration),reverse=this.reverseCheck.checked;
   if(this.lastPausePosition<o.in||this.lastPausePosition>=o.out)this.lastPausePosition=reverse?o.out:o.in;
   const position=this.lastPausePosition;originalPlay.call(this);if(!this.source)return;const seconds=reverse?Math.max(.001,position-o.in):Math.max(.001,o.out-position),now=this.audioCtx.currentTime;
   this.source.stop(now+seconds);const gain=this.gainNode.gain;gain.cancelScheduledValues(now);const elapsed=reverse?o.out-position:position-o.in;
   const initial=Math.min(1,o.fadeIn?elapsed/o.fadeIn:1,o.fadeOut?seconds/o.fadeOut:1);gain.setValueAtTime(this.volume*Math.max(0,initial),now);
   if(o.fadeIn>elapsed)gain.linearRampToValueAtTime(this.volume,now+o.fadeIn-elapsed);
   if(o.fadeOut){gain.setValueAtTime(this.volume,now+Math.max(0,seconds-o.fadeOut));gain.linearRampToValueAtTime(0,now+seconds);}
   this.source.onended=()=>{this.isPlaying=false;this.lastPausePosition=reverse?o.in:o.out;this.updatePlayBtn();this.stopAnimationLoop();this.draw();this.updateTimeDisplay();};
  };
  player.replayBtn.onclick=()=>{player.pause();player.lastPausePosition=player.reverseCheck.checked?range.out:range.in;player.play();};
  // Drag near either boundary; Shift-drag anywhere starts a new selection.
  let edge=null;player.canvas.addEventListener('mousedown',e=>{if(!player.audioBuffer)return;const r=player.canvas.getBoundingClientRect(),x=e.clientX-r.left,a=range.in/player.audioBuffer.duration*r.width,b=range.out/player.audioBuffer.duration*r.width;
   if(e.shiftKey||Math.min(Math.abs(x-a),Math.abs(x-b))<12){e.preventDefault();e.stopImmediatePropagation();player.pause();edge=e.shiftKey?'out':Math.abs(x-a)<Math.abs(x-b)?'in':'out';if(e.shiftKey)range.in=Math.max(0,Math.min(player.audioBuffer.duration-.001,x/r.width*player.audioBuffer.duration));}
  },true);
  window.addEventListener('mousemove',e=>{if(!edge||!player.audioBuffer)return;const r=player.canvas.getBoundingClientRect(),time=Math.max(0,Math.min(player.audioBuffer.duration,(e.clientX-r.left)/r.width*player.audioBuffer.duration));range[edge]=edge==='in'?Math.min(time,range.out-.001):Math.max(time,range.in+.001);range.fadeIn=Math.min(range.fadeIn,(range.out-range.in)/2);range.fadeOut=Math.min(range.fadeOut,(range.out-range.in)/2);Object.keys(fields).forEach(k=>fields[k].value=range[k].toFixed(2));player.draw();},true);
  window.addEventListener('mouseup',()=>edge=null);
  player.range=range;
  player.selectRange=(start,end)=>{const next=AltoTimeline.audio({in:start,out:end,fadeIn:0,fadeOut:0},player.audioBuffer.duration);player.pause();Object.assign(range,next);Object.keys(fields).forEach(k=>fields[k].value=range[k].toFixed(2));player.lastPausePosition=start;player.draw();};
 }};
})();
