/* Developer probe for planning ALTO features on the user's Premiere build.
 * MZ.apiProbe is read-only. MZ.easingProbe temporarily animates two Motion
 * parameters of ONE selected clip and a temporary Transform effect, then
 * restores the static values and removes the temporary effect. ES3 only. */
MZ.probeNames={
 project:['importFiles','deleteSequence','createNewSequence','createNewSequenceFromClips','importSequences','getInsertionBin','openSequence','save'],
 sequence:['createCaptionTrack','importMGT','importMGTFromLibrary','getSelection','setSelection','autoReframeSequence','createSubsequence','insertClip','overwriteClip','clone','getPlayerPosition','setPlayerPosition','exportAsMediaDirect','performSceneEditDetectionOnSelection','getSettings','setSettings','linkSelection','unlinkSelection'],
 trackItem:['getMGTComponent','getSpeed','setSpeed','isSpeedReversed','setInPoint','setOutPoint','move','remove','isAdjustmentLayer','setScaleToFrameSize','setSelected','isSelected','getColorSpace','setOverrideFrameRate','setOverridePixelAspectRatio'],
 param:['addKey','removeKey','getKeys','setValueAtKey','getValueAtKey','getValueAtTime','setInterpolationTypeAtKey','getInterpolationTypeAtKey','findNearestKey','findNextKey','findPreviousKey','setTimeVarying','isTimeVarying','areKeyframesSupported','getColorValue','setColorValue'],
 qeProject:['getVideoEffectByName','getVideoTransitionByName','getVideoEffectList','getVideoTransitionList','getAudioEffectByName'],
 qeSequence:['exportFramePNG','exportFrameJPEG','addTracks','getVideoTrackAt','getAudioTrackAt','razor','makeCurrent'],
 qeItem:['addVideoEffect','addTransition','addAudioEffect','getComponentAt','setSpeed','setReverse','setTimeInterpolationType','setFrameBlending','setScaleToFrame','razor','remove','rippleDelete','move']
};
MZ.probeObject=function(object,names){
 var out={present:[],missing:[],reflect:[]},i,ok;
 if(!object)return {unavailable:true};
 for(i=0;i<names.length;i++){ok=false;try{ok=typeof object[names[i]]==='function';}catch(e){ok=false;}if(ok)out.present.push(names[i]);else out.missing.push(names[i]);}
 try{var methods=object.reflect.methods;for(i=0;i<methods.length&&i<250;i++)out.reflect.push(String(methods[i].name));out.reflect.sort();}catch(e2){out.reflect=['reflect unavailable'];}
 return out;
};
MZ.probeComponents=function(clip){
 var list=[],i,j;
 for(i=0;i<clip.components.numItems;i++){
  var c=clip.components[i],props=[];
  for(j=0;j<c.properties.numItems&&j<40;j++){
   var p=c.properties[j],row={name:String(p.displayName)};
   try{row.keys=!!p.areKeyframesSupported();}catch(e){row.keys=null;}
   try{row.animated=row.keys?!!p.isTimeVarying():false;}catch(e2){row.animated=null;}
   props.push(row);
  }
  list.push({name:String(c.displayName),match:String(c.matchName),properties:props});
 }
 return list;
};
MZ.probeValue=function(v){
 if(v&&typeof v==='object'&&typeof v.length==='number'){var a=[];for(var i=0;i<v.length;i++)a.push(Math.round(Number(v[i])*10000)/10000);return a;}
 return Math.round(Number(v)*10000)/10000;
};
MZ.apiProbe=function(){try{
 var r={ok:true,kind:'alto-api-probe',probeVersion:1,alto:MZ.version,app:{version:String(app.version||''),build:String(app.build||''),os:String($.os||''),engine:String($.version||''),locale:String($.locale||'')},notes:[]};
 var qeOk=false;try{app.enableQE();qeOk=typeof qe!=='undefined'&&!!qe.project;}catch(e){r.notes.push('QE: '+String(e.message||e));}
 r.app.qe=qeOk;
 r.api={project:MZ.probeObject(app.project,MZ.probeNames.project)};
 if(qeOk)r.api.qeProject=MZ.probeObject(qe.project,MZ.probeNames.qeProject);
 var seq=app.project.activeSequence;
 if(!seq){r.notes.push('No active sequence');return VMV.encode(r);}
 var frame=Number(seq.timebase)/VMV.TICKS;
 r.sequence={name:String(seq.name),width:Number(seq.frameSizeHorizontal),height:Number(seq.frameSizeVertical),fps:Math.round(1/frame*1000)/1000,videoTracks:null,audioTracks:null};
 try{r.sequence.videoTracks=seq.videoTracks.numTracks;}catch(eV){}try{r.sequence.audioTracks=seq.audioTracks.numTracks;}catch(eA){}
 r.api.sequence=MZ.probeObject(seq,MZ.probeNames.sequence);
 var qseq=null;
 if(qeOk){try{qseq=qe.project.getActiveSequence();}catch(e3){}r.api.qeSequence=MZ.probeObject(qseq,MZ.probeNames.qeSequence);}
 var targets=[];try{targets=VMV.getTargets(seq);}catch(e4){r.notes.push('No clip selected: clip checks skipped');}
 if(targets.length){
  var t=targets[0],clip=t.clip;
  r.clip={name:t.name,track:'V'+(t.trackIndex+1),seconds:Math.round((t.end-t.start)*1000)/1000,adjustmentLayer:null,speed:null,components:MZ.probeComponents(clip)};
  try{r.clip.adjustmentLayer=!!clip.isAdjustmentLayer();}catch(e5){}
  try{r.clip.speed=Number(clip.getSpeed());}catch(e6){}
  r.api.trackItem=MZ.probeObject(clip,MZ.probeNames.trackItem);
  try{r.api.param=MZ.probeObject(clip.components[0].properties[0],MZ.probeNames.param);}catch(e7){}
  if(qseq){try{r.api.qeItem=MZ.probeObject(VMV.qeClip(qseq,t,frame),MZ.probeNames.qeItem);}catch(e8){r.notes.push('QE clip: '+String(e8.message||e8));}}
  r.clip.timeRemapVisible=/time\s*remap|изменени[ея] времени|переназнач/i.test(VMV.encode(r.clip.components));
 }
 return VMV.encode(r);
}catch(e){return VMV.encode({ok:false,error:String(e.message||e),line:e.line||0});}};
/* Writes two keys a->b on param, then reads the value at 25% of the span
 * for each interpolation type code. Linear 100->200 gives 125 at 25%. */
MZ.curveProbe=function(param,t0,t1,a,b){
 var res={name:String(param.displayName),from:a,to:b,types:{}},types=[0,1,2,3,4,5,6],mid=VMV.time(t0+(t1-t0)*0.25),k0=VMV.time(t0),k1=VMV.time(t1);
 VMV.checkResult(param.setTimeVarying(true),'Animate');
 var automatic=param.getKeys();if(automatic)for(var r=automatic.length-1;r>=0;r--)VMV.checkResult(param.removeKey(automatic[r]),'Clear automatic key');
 VMV.checkResult(param.addKey(k0),'Key 1');VMV.checkResult(param.addKey(k1),'Key 2');
 VMV.checkResult(param.setValueAtKey(k0,a,true),'Value 1');VMV.checkResult(param.setValueAtKey(k1,b,true),'Value 2');
 res.keysWritten=(param.getKeys()||[]).length;
 for(var i=0;i<types.length;i++){
  var row={};
  try{row.set0=param.setInterpolationTypeAtKey(k0,types[i],true);row.set1=param.setInterpolationTypeAtKey(k1,types[i],true);row.at25=MZ.probeValue(param.getValueAtTime(mid));}
  catch(e){row.error=String(e.message||e);}
  try{if(typeof param.getInterpolationTypeAtKey==='function')row.readBack=param.getInterpolationTypeAtKey(k0);}catch(e2){}
  res.types[String(types[i])]=row;
 }
 return res;
};
MZ.probeRestore=function(param,value){
 var keys=param.getKeys();if(keys)for(var j=keys.length-1;j>=0;j--)VMV.checkResult(param.removeKey(keys[j]),'Restore key');
 VMV.checkResult(param.setTimeVarying(false),'Restore animation');VMV.setStatic(param,value);
 return !param.isTimeVarying();
};
MZ.easingProbe=function(){
 var seq=app.project.activeSequence,records=[],r={ok:true,kind:'alto-easing-probe',probeVersion:1,notes:[]},touched=[],t;
 try{
  var targets=VMV.getTargets(seq);if(targets.length!==1)throw Error('Select exactly one video clip for the key test');
  t=targets[0];var clip=t.clip,motion=null;
  for(var i=0;i<clip.components.numItems;i++)if(String(clip.components[i].matchName)==='AE.ADBE Motion'){motion=clip.components[i];break;}
  if(!motion)throw Error('Motion component not found');
  var duration=t.end-t.start,frame=Number(seq.timebase)/VMV.TICKS,sourceIn=VMV.seconds(clip.inPoint);
  if(!(duration>=frame*8))throw Error('Clip is too short for the key test');
  var t0=sourceIn,t1=sourceIn+Math.min(1,duration*0.6);
  var position=motion.properties[0],scale=motion.properties[1];
  if(position.isTimeVarying()||scale.isTimeVarying())throw Error('Motion Position/Scale is already animated: use a clean test clip');
  var original={position:position.getValue(),scale:scale.getValue()};
  r.clip={name:t.name,seconds:Math.round(duration*1000)/1000};
  touched.push([scale,original.scale]);r.motionScale=MZ.curveProbe(scale,t0,t1,100,200);
  touched.push([position,original.position]);r.motionPosition=MZ.curveProbe(position,t0,t1,[0.3,0.5],[0.7,0.5]);
  r.motionRestored=MZ.probeRestore(scale,original.scale)&&MZ.probeRestore(position,original.position);touched=[];
  try{
   app.enableQE();var qt=VMV.qeClip(qe.project.getActiveSequence(),t,frame);
   var transform=VMV.addEffect(seq,t,qt,VMV.effect('AE.ADBE Geometry2',['Transform','Преобразование','Трансформация']),'AE.ADBE Geometry2',records);
   r.transformScale=MZ.curveProbe(transform.properties[3],t0,t1,100,200);
   r.transformPosition=MZ.curveProbe(transform.properties[1],t0,t1,[0.3,0.5],[0.7,0.5]);
  }catch(te){r.transformError=String(te.message||te);}
  r.transformLeft=VMV.rollback(seq,records);records=[];
  return VMV.encode(r);
 }catch(e){
  var restored=true;for(var k=0;k<touched.length;k++){try{if(!MZ.probeRestore(touched[k][0],touched[k][1]))restored=false;}catch(re){restored=false;}}
  var left=records.length&&seq?VMV.rollback(seq,records):0;
  return VMV.encode({ok:false,error:String(e.message||e),line:e.line||0,motionRestored:restored,transformLeft:left});
 }
};
