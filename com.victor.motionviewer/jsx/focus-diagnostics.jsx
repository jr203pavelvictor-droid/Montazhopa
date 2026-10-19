/* Explicit target bindings. Public DOM data; QE insertion only after all preflight. */
MZ.boundCamera=function(binding){
 var seq=app.project.activeSequence;if(!seq||!binding||String(seq.sequenceID)!==String(binding.sequenceID))throw Error('Вернись в секвенцию подключённого Adjustment Layer.');
 var target={nodeId:String(binding.nodeId),trackIndex:Number(binding.trackIndex),start:binding.start,end:binding.end},clip=VMV.publicClip(seq,target);target.clip=clip;target.name=String(clip.name);
 if(!clip.isAdjustmentLayer||!clip.isAdjustmentLayer())throw Error('Подключённый слой больше не является Adjustment Layer.');
 if(seq.videoTracks[target.trackIndex].isLocked())throw Error('Дорожка Adjustment Layer заблокирована.');
 var plan=VMV.makePlan(seq,target,{group:'CAMERA',duration:0,title:'Motion Zoom'});
 return {seq:seq,target:target,plan:plan,width:Number(seq.frameSizeHorizontal),height:Number(seq.frameSizeVertical),playhead:VMV.seconds(seq.getPlayerPosition())};
};
MZ.focusTargetData=function(seq,target,allowNest){
 var clip=target.clip,item=clip.projectItem,plan=VMV.makePlan(seq,target,{group:'CAMERA',duration:0,title:'Расфокус'});
 if(clip.isAdjustmentLayer&&clip.isAdjustmentLayer())throw Error('Для селективного расфокуса выбери отделённый видеоклип или отдельный нест героини, а не Adjustment Layer.');
 if(!item)throw Error('У цели нет исходника.');
 if(item.isSequence&&item.isSequence()&&!allowNest)throw Error('Нест размоется целиком. Подтверди, что это отдельный нест только нужного объекта, или выбери отделённый клип.');
 if(Math.abs(plan.sourceRate-1)>.000001||(clip.getSpeed&&Math.abs(clip.getSpeed()-1)>.000001))throw Error('Расфокус: изменение скорости не поддерживается; привяжи клип со скоростью 100%.');
 for(var i=0;i<clip.components.numItems;i++)if(/time.?remap/i.test(String(clip.components[i].matchName))){var props=clip.components[i].properties;for(var j=0;j<props.numItems;j++)if(props[j].areKeyframesSupported()&&props[j].isTimeVarying())throw Error('Расфокус: обнаружен анимированный Time Remapping; используй отдельный клип без изменения скорости.');}
 return {nodeId:target.nodeId,trackIndex:target.trackIndex,name:target.name,start:target.start,end:target.end,sourceIn:plan.sourceIn,sourceRate:plan.sourceRate,nested:!!(item.isSequence&&item.isSequence()),effects:VMV.encode(VMV.matchNames(clip))};
};
MZ.bindFocusTargets=function(allowNest){try{var seq=app.project.activeSequence,targets=VMV.getTargets(seq),rows=[];for(var i=0;i<targets.length;i++)rows.push(MZ.focusTargetData(seq,targets[i],allowNest===true));return VMV.encode({ok:true,project:MZ.projectKey(),sequenceID:String(seq.sequenceID),targets:rows,allowNest:allowNest===true});}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.blurEffect=function(){
 var names=qe.project.getVideoEffectList();if(!names||!names.length)throw Error('Premiere не предоставляет список установленных эффектов.');
 var matches=[];for(var i=0;i<names.length;i++)if(/^(gaussian blur(?: \(legacy\))?|размытие по гауссу(?: \(устаревшее\))?)$/i.test(String(names[i])))matches.push(String(names[i]));
 if(!matches.length)throw Error('Gaussian Blur не найден. Проверь установленный эффект в панели Effects и язык RU/EN.');
 var effect=qe.project.getVideoEffectByName(matches[0]);if(!effect)throw Error('Gaussian Blur недоступен для добавления.');return {effect:effect,name:matches[0]};
};
MZ.blurParameter=function(component){
 var found=[];for(var i=0;i<component.properties.numItems;i++){var p=component.properties[i],name=String(p.displayName||'');if(/^(blurriness|blur radius|степень размытия|размытие|радиус размытия)$/i.test(name))found.push(p);}
 if(found.length!==1)throw Error('Не удалось однозначно определить параметр силы установленного Gaussian Blur. Изменения отменены.');
 var param=found[0],value=param.getValue();if(typeof value!=='number'||!isFinite(value)||!param.areKeyframesSupported())throw Error('Этот Gaussian Blur не поддерживает подтверждённую анимацию силы размытия.');return param;
};
MZ.prepareFocus=function(request,camera,route,offset,data){
 var model=AltoTimeline.focus(request.stops,route),batch={rows:[],restores:[],model:model};if(!model.events.length&&!request.focusBinding)return batch;
 var binding=request.focusBinding;if(!binding||binding.project!==MZ.projectKey()||String(binding.sequenceID)!==String(camera.seq.sequenceID))throw Error('Явно привяжи цели расфокуса в секвенции зума. Клип внутри общего неста выбери в отдельном нестe только героини; автоматическое раскрытие вложенных секвенций не выполняется.');
 if(!binding.targets||!binding.targets.length||binding.targets.length>50)throw Error('Выбери от 1 до 50 целей расфокуса.');
 app.enableQE();var qseq=qe.project.getActiveSequence(),effect=model.events.length?MZ.blurEffect():null,at=camera.target.start+offset;
 for(var i=0;i<binding.targets.length;i++){
  var b=binding.targets[i],target={nodeId:String(b.nodeId),trackIndex:Number(b.trackIndex),start:b.start,end:b.end,name:b.name};
  if(target.nodeId===camera.target.nodeId)throw Error('Цель расфокуса совпала со слоем зума.');
  if(camera.seq.videoTracks[target.trackIndex].isLocked())throw Error('Дорожка цели расфокуса заблокирована: '+b.name);
  target.clip=VMV.publicClip(camera.seq,target);var current=MZ.focusTargetData(camera.seq,target,binding.allowNest);
  if(current.sourceIn!==b.sourceIn||current.sourceRate!==b.sourceRate)throw Error('Цель расфокуса изменилась: '+b.name+'. Привяжи цели заново.');
  if(at<target.start-.000001||at+model.duration>target.end-Number(camera.seq.timebase)/VMV.TICKS+.000001)throw Error('Цель '+b.name+' не покрывает весь маршрут. Продли клип или сократи маршрут до применения.');
  var key='focus/'+MZ.key(camera.seq,target),owned=data[key],comp=null;
  // Zero strengths clear previously owned envelopes without adding new effects.
  if(!model.events.length&&!owned)continue;
  if(owned){comp=target.clip.components[owned.index];if(!comp||VMV.fingerprint(comp)!==owned.fingerprint||MZ.curves(comp)!==owned.curves)throw Error('Расфокус ALTO изменён вручную: '+b.name);MZ.blurParameter(comp);}
  var qt=VMV.qeClip(qseq,target,camera.plan.frame);if(!qt.getComponentAt)throw Error('Удаление добавленного эффекта недоступно.');
  batch.rows.push({target:target,qtarget:qt,effect:effect,owned:owned,component:comp,key:key,plan:{sourceIn:current.sourceIn+at-target.start,sourceRate:1,interpolation:0,verifiedKeys:0}});
 }return batch;
};
MZ.writeFocus=function(batch,records,next){
 for(var i=0;i<batch.rows.length;i++){
  var row=batch.rows[i],comp=row.component,defaults;
  if(comp){batch.restores.push({comp:comp,snapshot:MZ.snapshot(comp,0)});defaults=row.owned.defaults;MZ.restore(comp,defaults);}
  else{
   var before=VMV.matchNames(row.target.clip),beforeQE=Number(row.qtarget.numComponents),addError=null;
   try{row.qtarget.addVideoEffect(row.effect.effect);}catch(e){addError=e;}
   var after=VMV.matchNames(row.target.clip);
   if(after.length===before.length+1)records.push({target:row.target,qtarget:row.qtarget,before:before,expected:after[after.length-1],qeBefore:beforeQE});
   if(addError)throw addError;if(after.length!==before.length+1||!VMV.sameNames(before,after.slice(0,before.length)))throw Error('Premiere не подтвердил добавление Gaussian Blur.');
   comp=row.target.clip.components[before.length];
   if(!/gaussian|гаусс/i.test(String(comp.matchName)+' '+String(comp.displayName)))throw Error('Добавленный эффект не подтверждён как Gaussian Blur.');
   defaults=MZ.snapshot(comp);
  }
  var p=MZ.blurParameter(comp),keys=MZEngine.simplify(batch.model.keys,.001);VMV.writeKeys(p,keys,row.plan);
  next[row.key]={index:row.owned?row.owned.index:row.target.clip.components.numItems-1,match:String(comp.matchName),fingerprint:VMV.fingerprint(comp),curves:MZ.curves(comp),defaults:defaults,interpolation:0};
 }
};
MZ.restoreFocus=function(batch){var errors=[];if(batch)for(var i=batch.restores.length-1;i>=0;i--)try{MZ.restore(batch.restores[i].comp,batch.restores[i].snapshot);}catch(e){errors.push(String(e.message||e));}return errors;};
MZ.inspectProject=function(){try{
 var rows=[],limitations=[],count=0;
 function issue(item,problem,path,location,action){rows.push({nodeId:item?String(item.nodeId||''):'',name:item?String(item.name||''):'',problem:problem,path:path||'',location:location||'Project',action:action||'Проверь исходник в Project'});}
 function visit(item,location){if(++count>50000)throw Error('Слишком много объектов: проверка ограничена 50000.');if(item.children){for(var i=0;i<item.children.numItems;i++)visit(item.children[i],location+'/'+String(item.name||''));}
  try{if(item.isSequence&&item.isSequence())return;if(item.isOffline&&item.isOffline())issue(item,'Offline media','',location,'Найди исходник и перепривяжи вручную в Premiere');var p=item.getMediaPath?item.getMediaPath():'';if(p&&!new File(p).exists)issue(item,'Путь исходника недоступен',p,location,'Проверь диск и доступность файла');}catch(e){issue(item,'API не смог проверить исходник: '+e.message,'',location);}}
 visit(app.project.rootItem,'Project');var seq=app.project.activeSequence;
 if(seq){var types=['videoTracks','audioTracks'];for(var t=0;t<types.length;t++){var tracks=seq[types[t]];if(!tracks)continue;for(var j=0;j<tracks.numTracks;j++)for(var k=0;k<tracks[j].clips.numItems;k++){var clip=tracks[j].clips[k];if(!clip.projectItem)issue(clip,'Отсутствует доступная связь с ProjectItem','',(t?'A':'V')+(j+1)+' · '+VMV.seconds(clip.start).toFixed(2)+' с','Проверь клип в Premiere');}}}
 limitations.push('Проверяются доступность исходников и связи через DOM; качество изображения/звука и содержимое масок не анализируются.');
 return VMV.encode({ok:true,rows:rows,checked:count,limitations:limitations});
 }catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.revealProjectObject=function(nodeId){try{var found=null;function visit(item){if(String(item.nodeId)===String(nodeId))found=item;if(item.children)for(var i=0;i<item.children.numItems;i++)visit(item.children[i]);}visit(app.project.rootItem);if(!found||!app.project.selectItem)throw Error('Переход к этому объекту API не поддерживает; найди его по имени в Project.');app.project.selectItem(found);return VMV.encode({ok:true});}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.editContext=function(){try{var seq=app.project.activeSequence;if(!seq)throw Error('Open a sequence');return VMV.encode({ok:true,token:VMV.encode({project:MZ.projectKey(),sequence:String(seq.sequenceID)})});}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
