/* Real Motion Zoom UI. Callbacks retain the existing bridge and capture path. */
(function(){
 'use strict';
 window.AltoCamera={render(U,A){
  const {el,button,field,selectField,panel,t}=U,s=U.state,stops=A.stops,options=A.options;
  AltoTimeline.freezeTransitions(stops,options);
  s.cameraIndex=Math.max(0,Math.min(stops.length-1,s.cameraIndex||0));
  const selected=stops[s.cameraIndex],main=U.$('main');
  const heading=el('div','camera-heading');
  const title=el('div');title.append(el('p','eyebrow',t('ИЗ ОБЩЕГО — В ДЕТАЛИ','FROM OVERVIEW TO DETAIL')),el('h2','','Motion Zoom'));
  const binding=el('div','camera-binding');binding.append(el('small','',s.cameraInfo?s.cameraInfo.name:t('Слой не подключён','Layer disconnected')),button(t('Подключить выделенный слой','Connect selected layer'),()=>A.bind(true),'camera-connect'));
  heading.append(title,binding);main.append(heading);
  const layout=el('div','camera-layout'),left=el('div','camera-visual'),right=el('div','camera-inspector');
  const map=el('div','camera-map');map.id='camera-map';map.tabIndex=0;map.setAttribute('aria-label',t('Карта кадра. Точки можно перетаскивать.','Frame map. Drag points to move them.'));
  const info=s.cameraInfo||s.cameraFrame;map.style.aspectRatio=info?info.width+'/'+info.height:'16/9';
  const art=el('div','preview-art');art.id='camera-art';
  const image=el('img');image.src=s.cameraImage||'assets/previews/landscape.svg';image.alt=s.cameraImage?t('Кадр для маршрута','Route reference frame'):t('Демонстрационный кадр','Demo frame');art.append(image);
  const badge=el('span','camera-frame-label',s.cameraImage?t('ОБЩИЙ КАДР','OVERVIEW'):t('ДЕМО-КАДР','DEMO FRAME'));
  const markers=el('div');markers.id='camera-markers';const frame=el('div','camera-window');frame.id='camera-window';map.append(art,badge,markers,frame);left.append(map);
  let dragging=false;
  function move(e){const r=map.getBoundingClientRect(),point=stops[s.cameraIndex];point.fx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));point.fy=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));s.cameraPlaying=false;A.update();}
  map.addEventListener('pointerdown',e=>{if(e.button!==0)return;const marker=e.target.closest('.marker');if(marker)s.cameraIndex=Number(marker.textContent)-1;dragging=true;map.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();move(e);});
  map.addEventListener('pointermove',e=>{if(dragging)move(e);});
  map.addEventListener('pointerup',()=>{if(dragging){dragging=false;U.render();}});
  map.addEventListener('pointercancel',()=>{dragging=false;U.render();});
  map.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},true);
  map.onkeydown=e=>{const delta=e.shiftKey?.01:.002,point=stops[s.cameraIndex];if(e.key==='ArrowLeft')point.fx=Math.max(0,point.fx-delta);else if(e.key==='ArrowRight')point.fx=Math.min(1,point.fx+delta);else if(e.key==='ArrowUp')point.fy=Math.max(0,point.fy-delta);else if(e.key==='ArrowDown')point.fy=Math.min(1,point.fy+delta);else return;e.preventDefault();A.update();window.AltoWorkspace.capture();};
  const play=el('div','playbar');play.append(button(s.cameraPlaying?'Ⅱ':'▶',()=>{s.cameraPlaying=!s.cameraPlaying;if(s.cameraPlaying)s.cameraTime=0;U.render();},'icon'));
  const scrub=el('input');scrub.type='range';scrub.id='camera-scrub';scrub.min=0;scrub.max=1;scrub.step=.001;scrub.value=0;scrub.setAttribute('aria-label',t('Время маршрута','Route time'));scrub.oninput=()=>{s.cameraPlaying=false;s.cameraScrubbing=true;s.cameraTime=Number(scrub.value)*(s.cameraRoute?s.cameraRoute.seconds:1);A.draw();};play.append(scrub,el('small','',info?info.width+' × '+info.height:'1920 × 1080'));left.append(play);
  const captureActions=el('div','camera-capture-actions'),capture=button(t('Взять кадр с таймлайна','Capture timeline frame'),A.capture,'primary');capture.id='capture-timeline-frame';capture.disabled=s.busy;captureActions.append(capture,button(t('Загрузить кадр…','Load frame…'),A.load,'reference-link'));left.append(captureActions);
  const route=panel(t('Маршрут','Route'));route.classList.add('route-list');const routeStops=el('div','route-stops');route.append(routeStops);
  stops.forEach((point,index)=>{
   const row=el('div','stop-row'+(s.cameraIndex===index?' active':''));row.dataset.stopIndex=index;
   const handle=el('span','stop-number',String(index+1).padStart(2,'0'));handle.draggable=true;handle.title=t('Перетащи, чтобы изменить порядок','Drag to reorder');handle.addEventListener('dragstart',e=>e.dataTransfer.setData('application/x-alto-point',String(index)));
   row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('drag-over');});row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
   row.addEventListener('drop',e=>{e.preventDefault();const raw=e.dataTransfer.getData('application/x-alto-point');if(!/^\d+$/.test(raw))return;s.cameraIndex=AltoTimeline.reorder(stops,Number(raw),index);s.cameraPlaying=false;U.render();});
   row.append(handle,button((index===0?t('Общий план','Overview'):t('Ракурс ','View ')+(index+1))+' · '+point.scale+'%',()=>{s.cameraIndex=index;s.cameraPlaying=false;s.cameraScrubbing=false;U.render();},'stop-name'),el('small','stop-meta',point.hold.toFixed(1)+t(' с',' s')));
   for(const [symbol,delta,label]of [['↑',-1,t('Поднять ракурс ','Move view up ')],['↓',1,t('Опустить ракурс ','Move view down ')]]){const b=button(symbol,()=>{s.cameraIndex=AltoTimeline.reorder(stops,index,index+delta);U.render();},'icon');b.disabled=index+delta<0||index+delta>=stops.length;b.setAttribute('aria-label',label+(index+1));row.append(b);}routeStops.append(row);
  });
  const add=button(t('+ Добавить ракурс','+ Add view'),()=>{stops.push({name:String(stops.length+1),fx:.5,fy:.5,scale:170,hold:.6,transition:AltoTimeline.copy(options)});s.cameraIndex=stops.length-1;U.render();});add.disabled=stops.length>=10;add.className='reference-link route-add';route.append(add);left.append(route);
  const edit=panel(t('Ракурс ','View ')+(s.cameraIndex+1));
  edit.append(field(t('Масштаб','Scale'),'cam-scale',selected.scale,100,500,1,v=>{selected.scale=v;A.update();},null,'%'));
  if(s.cameraIndex>0){const cfg=selected.transition;const flight=el('div','flight-inspector');flight.append(el('p','flight-label',t('Перелёт ','Flight ')+s.cameraIndex+' → '+(s.cameraIndex+1)));
   const pair=el('div','two');pair.append(selectField(t('Характер','Character'),'cam-mode',[['smooth','Smooth'],['spring','Elastic'],['snap','Snap'],['linear','Linear'],['easeIn','Ease In'],['easeOut','Ease Out']],cfg.mode,v=>{cfg.mode=v;A.update();U.render();}),field(t('Время перелёта','Travel time'),'cam-move',cfg.move,.08,5,.01,v=>{cfg.move=v;A.update();},null,t(' с',' s')));flight.append(pair);
   if(cfg.mode==='spring'){const elastic=el('details');elastic.append(el('summary','',t('Параметры Elastic','Elastic settings')),field(t('Сила Elastic','Elastic amount'),'cam-spring',cfg.overshoot,0,.6,.01,v=>{cfg.overshoot=v;A.update();}),field(t('Затухание','Settling time'),'cam-settle',cfg.settle,.08,3,.01,v=>{cfg.settle=v;A.update();},null,t(' с',' s')));flight.append(elastic);}edit.append(flight);
  }
  const pointDetails=el('details','point-details');pointDetails.append(el('summary','',t('Положение, пауза и порядок','Position, hold and order')),field(t('Центр X','Center X'),'cam-x',Math.round(selected.fx*1000)/10,0,100,.1,v=>{selected.fx=v/100;A.update();},null,'%'),field(t('Центр Y','Center Y'),'cam-y',Math.round(selected.fy*1000)/10,0,100,.1,v=>{selected.fy=v/100;A.update();},null,'%'),field(t('Пауза на точке','Hold at view'),'cam-hold',selected.hold,0,10,.1,v=>{selected.hold=v;A.update();},null,t(' с',' s')));
  const pointActions=el('div','button-row');for(const [text,en,delta]of [['Поднять точку','Move view up',-1],['Опустить точку','Move view down',1]]){const reorder=button(t(text,en),()=>{s.cameraIndex=AltoTimeline.reorder(stops,s.cameraIndex,s.cameraIndex+delta);U.render();});reorder.disabled=s.cameraIndex+delta<0||s.cameraIndex+delta>=stops.length;pointActions.append(reorder);}
  const duplicate=button(t('Дублировать точку','Duplicate view'),()=>{s.cameraIndex=AltoTimeline.duplicate(stops,s.cameraIndex);U.render();});duplicate.disabled=stops.length>=10;const remove=button(t('Удалить точку','Delete view'),()=>{stops.splice(s.cameraIndex,1);s.cameraIndex=Math.min(stops.length-1,s.cameraIndex);U.render();});remove.disabled=stops.length<=2;pointActions.append(duplicate,remove);pointDetails.append(pointActions);edit.append(pointDetails);right.append(edit);
  const summary=el('p','help-text camera-summary');summary.id='camera-summary';right.append(summary,button(t('Построить анимацию','Build animation'),A.apply,'apply camera-apply'));
  const focus=el('details','panel focus-inspector'),targets=el('p','help-text');focus.append(el('summary','',t('Расфокус выбранных слоёв','Selected-layer defocus')));targets.textContent=s.focusBinding?s.focusBinding.targets.map(x=>x.name+' · V'+(x.trackIndex+1)).join('\n'):t('Цели не привязаны. Выдели отделённые клипы на таймлайне.','No targets bound. Select isolated clips on the timeline.');focus.append(targets);
  const allow=el('label','check'),allowInput=el('input');allowInput.type='checkbox';allowInput.checked=!!s.focusAllowNest;allowInput.onchange=()=>s.focusAllowNest=allowInput.checked;allow.append(allowInput,document.createTextNode(t('Выбранный нест содержит только цель расфокуса','Selected nest contains only the defocus subject')));focus.append(allow,button(t('Привязать выбранные цели','Bind selected targets'),()=>U.operation(async()=>{s.focusBinding=await U.host('MZ.bindFocusTargets',[!!s.focusAllowNest]);U.render();})),button(t('Отвязать цели','Clear targets'),()=>{s.focusBinding=null;U.render();},'reference-link'));
  selected.focus=Object.assign({strength:0,riseStart:0,riseDuration:.2,fallStart:.4,fallDuration:.2},selected.focus);
  const timing=el('details');timing.append(el('summary','',t('Расфокус в ракурсе ','Defocus at view ')+(s.cameraIndex+1)),el('p','help-text',t('Времена отсчитываются от прибытия в эту точку. Перекрытия объединяются по максимальной силе.','Times are relative to arrival at this point. Overlaps use the strongest envelope.')));
  for(const [key,ru,en,min,max,step]of [['strength','Сила размытия','Blur strength',0,200,1],['riseStart','Начало нарастания','Rise start',-30,30,.05],['riseDuration','Длительность нарастания','Rise duration',.01,30,.05],['fallStart','Начало возврата резкости','Return start',-30,60,.05],['fallDuration','Длительность возврата','Return duration',.01,30,.05]])timing.append(field(t(ru,en),'focus-'+key,selected.focus[key],min,max,step,v=>{selected.focus[key]=v;A.update();},null,key==='strength'?'':t(' с',' s')));focus.append(timing);right.append(focus);
  const general=el('details','panel camera-general');general.append(el('summary','',t('Параметры применения','Apply settings')));
  const protect=el('label','check'),protectInput=el('input');protectInput.type='checkbox';protectInput.checked=options.protect;protectInput.onchange=()=>{options.protect=protectInput.checked;A.update();};protect.append(protectInput,document.createTextNode(t('Защитить края','Protect frame edges')));
  general.append(protect,field('Motion Blur','cam-shutter',options.shutter,0,360,15,v=>options.shutter=v,null,'°'),selectField(t('Начало','Start at'),'cam-start',[['clip',t('С начала слоя','Layer start')],['playhead',t('От курсора','Playhead')]],s.cameraStart||'clip',v=>{s.cameraStart=v;A.update();}));
  right.append(general);layout.append(left,right);main.append(layout);A.update();
 }};
})();
