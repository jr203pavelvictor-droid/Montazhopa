/* Real Premiere transitions on the cut: the frames blend, unlike ALTO's key-based
   transitions below. Names come from this Premiere's own transition list. */
(function(){
 'use strict';
 const popular=['Cross Dissolve','Film Dissolve','Dip to Black','Dip to White','Additive Dissolve','Push','Slide','Whip','Iris Round','Split','Barn Doors','Zoom'];
 window.AltoTransitions={render(U){
  const {el,button,panel,t,state:s}=U,box=panel(t('Переходы Premiere на стыке','Premiere transitions on the cut'));box.classList.add('native-transitions');
  box.append(el('p','help-text',t('Настоящее перетекание кадров. Выдели два соседних клипа на одной дорожке и выбери переход. Длина — из настроек Premiere.','Real blending between shots. Select two adjacent clips on one track and pick a transition. Length follows Premiere preferences.')));
  if(!window.__adobe_cep__){box.append(el('p','help-text',t('Работает внутри Premiere.','Works inside Premiere.')));return box;}
  if(!s.transitionNames){if(!s.transitionLoading){s.transitionLoading=true;U.host('MZ.transitionNames').then(r=>{s.transitionNames=r.names;s.transitionLoading=false;U.render();}).catch(e=>{s.transitionLoading=false;s.transitionNames=[];U.error(e);});}box.append(el('p','help-text',t('Загружаю список переходов…','Loading transitions…')));return box;}
  const names=s.transitionNames,lower=names.map(n=>n.toLowerCase()),add=name=>U.operation(async()=>{const r=await U.host('MZ.addTransition',[name]);U.status(t('Переход добавлен: ','Transition added: ')+r.name+(r.verified?'':t(' · проверь на таймлайне',' · check the timeline')),t('Переход добавлен: ','Transition added: ')+r.name);});
  const quick=el('div','chips transition-quick');for(const p of popular){const i=lower.indexOf(p.toLowerCase());if(i>=0){const b=button(names[i],()=>add(names[i]));b.dataset.transition=names[i];quick.append(b);}}if(quick.children.length)box.append(quick);
  const search=el('input');search.type='search';search.id='transition-search';search.placeholder=t('Найти переход','Find a transition');search.value=s.transitionQuery||'';const results=el('div','transition-results');
  const draw=()=>{results.replaceChildren();const q=search.value.trim().toLowerCase();if(!q)return;for(const n of names.filter(n=>n.toLowerCase().includes(q)).slice(0,24)){const b=button(n,()=>add(n),'reference-link');b.dataset.transition=n;results.append(b);}if(!results.children.length)results.append(el('small','',t('Ничего не нашлось','Nothing found')));};
  search.oninput=()=>{s.transitionQuery=search.value;draw();};box.append(search,results);draw();
  box.append(el('p','help-text',t('Ниже — анимационные переходы ALTO: ключи на концах клипов, без смешивания кадров.','Below: ALTO motion transitions, keys on the clip ends, no frame blending.')));
  return box;
 }};
})();
