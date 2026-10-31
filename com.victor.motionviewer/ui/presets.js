/* The 84 ready-made presets from ALTO 3: grouped list, live preview, strength
   and speed, applied to the selected clips by VMV.applyById (host). */
(function(){
 'use strict';
 const groups=[['IN','Появления','Intros'],['OUT','Уходы','Outros'],['ACC','Акценты','Accents'],['HOLD','На всю длину клипа','Whole clip'],['PHOTO','Фото','Photos'],['SHD','Тени','Shadows']];
 let frame=0;
 function v(a,t,d){return a?MZPresets.value(a,t):d;}
 function shadowCss(s){const a=s[1]*Math.PI/180;return `drop-shadow(${(Math.sin(a)*s[2]).toFixed(1)}px ${(-Math.cos(a)*s[2]).toFixed(1)}px ${(s[3]/2).toFixed(1)}px rgba(0,0,0,${s[0]}))`;}
 function play(stage,subject,preset,opts){
  cancelAnimationFrame(frame);if(!preset)return;
  const q=MZPresets.customize(preset,opts),start=performance.now();
  if(preset.shadow){subject.style.transform='none';subject.style.opacity=1;subject.style.filter=q.shadow.map(shadowCss).join(' ');return;}
  subject.style.filter='none';
  const loop=()=>{if(!subject.isConnected)return;const cycle=Math.max(.3,q.duration)+.8,t=Math.min(((performance.now()-start)/1000)%cycle,q.duration),W=stage.clientWidth,H=stage.clientHeight,s=v(q.scale,t,100)/100;
   subject.style.transform=`translate(${(v(q.x,t,0)*W).toFixed(2)}px,${(v(q.y,t,0)*H).toFixed(2)}px) rotate(${v(q.rotation,t,0).toFixed(2)}deg) scale(${(s*v(q.sx,t,100)/100).toFixed(4)},${(s*v(q.sy,t,100)/100).toFixed(4)})`;
   subject.style.opacity=String(Math.max(0,Math.min(1,v(q.opacity,t,100)/100)));frame=requestAnimationFrame(loop);};
  loop();
 }
 window.AltoPresets={render(U,A){
  const {el,button,field,panel,t,state:s}=U,main=U.$('main');
  if(!s.presetList){
   if(!window.__adobe_cep__){main.append(el('div','empty',t('Пресеты читаются из Premiere: открой панель в Premiere.','Presets are read from Premiere: open the panel in Premiere.')));return;}
   if(!s.presetLoading){s.presetLoading=true;U.host('MZ.presetList').then(r=>{s.presetList=r.presets;s.presetLoading=false;U.render();}).catch(e=>{s.presetLoading=false;U.error(e);});}
   main.append(el('div','empty',t('Загружаю пресеты…','Loading presets…')));return;
  }
  const list=s.presetList,opts=s.presetOpts=Object.assign({strength:1,speed:1,fit:true},s.presetOpts);
  let selected=list.find(p=>p.id===s.presetId)||list[0];s.presetId=selected.id;
  const preview=panel(),stage=el('div','preset-stage'),subject=el('div','preset-subject');
  const kind=/^(HOLD|PHOTO)$/.test(selected.group)?'scene':'word';stage.classList.add(kind);subject.classList.add(kind);
  if(kind==='scene'){const img=el('img');img.src='assets/previews/landscape.svg';img.alt='';subject.append(img);}else subject.textContent='ALTO';
  stage.append(subject);
  const info=el('div','preset-info');info.append(el('strong','',selected.title),el('small','',(selected.duration?selected.duration.toFixed(2)+t(' с',' s')+' · ':'')+selected.description));
  const tune=el('details','preset-tune'),knobs=el('div','two');tune.open=!!s.presetTune;tune.ontoggle=()=>s.presetTune=tune.open;tune.append(el('summary','',t('Сила, скорость, длина','Strength, speed, length')),knobs);
  if(!selected.shadow)knobs.append(field(t('Сила','Strength'),'preset-strength',opts.strength,.1,4,.05,x=>{opts.strength=x;play(stage,subject,selected,opts);}),field(t('Скорость','Speed'),'preset-speed',opts.speed,.25,4,.05,x=>{opts.speed=x;play(stage,subject,selected,opts);}));
  const fit=el('label','check'),fitInput=el('input');fitInput.type='checkbox';fitInput.checked=opts.fit;fitInput.onchange=()=>opts.fit=fitInput.checked;fit.append(fitInput,document.createTextNode(t('Ужать под короткий клип','Squeeze into a short clip')));
  const apply=button(t('Применить к выделенным клипам','Apply to selected clips'),()=>U.operation(async()=>{const r=await U.host('VMV.applyById',[selected.id,{strength:opts.strength,speed:opts.speed,fit:opts.fit}]);U.status(selected.title+' · '+t('клипов: ','clips: ')+r.count,selected.title+' · clips: '+r.count);}),'apply');apply.id='preset-apply';apply.disabled=!!s.busy;
  preview.classList.add('preset-preview');if(!selected.shadow&&!/^(HOLD|PHOTO)$/.test(selected.group))tune.append(fit);const actions=el('div','preset-actions');if(!selected.shadow)actions.append(tune);actions.append(apply);preview.append(stage,info,actions);main.append(preview);
  for(const [group,ru,en]of groups){
   const rows=list.filter(p=>p.group===group&&A.matches(p.title+' '+p.description+' '+ru+' '+en));if(!rows.length)continue;
   const box=el('section','preset-group');box.append(el('h3','',t(ru,en)+' · '+rows.length));
   for(const p of rows){const row=button('',()=>{s.presetId=p.id;U.render();},'preset-row'+(p.id===selected.id?' active':''));row.dataset.preset=p.id;row.append(el('strong','',p.title),el('small','',p.description));box.append(row);}
   main.append(box);
  }
  play(stage,subject,selected,opts);
 }};
})();
