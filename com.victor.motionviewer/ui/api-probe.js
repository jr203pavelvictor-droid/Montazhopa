/* Developer report: what this Premiere build exposes to ALTO.
 * Buttons 1 and 3 change nothing in the project. Button 2 animates the
 * selected clip for a moment and restores it (see jsx/api-probe.jsx). */
(function(){
 'use strict';
 const FRAME_DEADLINE_MS=5500;
 async function frameTest(host){
  const started=performance.now();let frame=await host('MZ.captureTimelineFrame');const ticket=frame.ticket;
  try{
   while(frame.pending){if(performance.now()-started>FRAME_DEADLINE_MS)throw Error('MZ_FRAME_EXPORT_FAILED (panel timeout)');await new Promise(r=>setTimeout(r,150));frame=await host('MZ.pollTimelineFrame',[ticket]);}
   return {ok:true,ms:Math.round(performance.now()-started),width:frame.width,height:frame.height,timecode:frame.timecode};
  }finally{if(ticket)await host('MZ.discardTimelineFrame',[ticket]).catch(()=>{});}
 }
 window.AltoApiProbe={open(U){
  const {el,button,modal,closeModal,host,t}=U;
  const report={kind:'alto-api-report',alto:window.MZ_VERSION,created:new Date().toISOString(),panel:{userAgent:navigator.userAgent},api:null,keys:null,frame:null};
  const box=el('div','api-probe');
  box.append(el('p','help-text',t('Отчёт для разработки ALTO: что умеет твой Premiere. Кнопки 1 и 3 ничего не меняют в проекте. Кнопка 2 на секунду анимирует выделенный клип и сразу возвращает всё как было — выдели один тестовый клип без анимации.','Report for ALTO development. Buttons 1 and 3 change nothing. Button 2 briefly animates the selected clip and restores it — select one test clip without animation.')));
  const out=el('textarea','api-probe-output');out.readOnly=true;out.rows=10;out.style.width='100%';out.style.fontFamily='monospace';out.style.fontSize='11px';
  const state=el('p','help-text','');
  const render=()=>{out.value=JSON.stringify(report,null,1);try{if(window.MZLocal&&window.MZLocal.available)window.MZLocal.write('alto-api-report.json',report);}catch(e){}};
  async function run(key,label,fn){state.textContent=label+'…';try{report[key]=await fn();state.textContent=label+': '+t('готово','done');}catch(e){report[key]={ok:false,error:String(e&&e.message||e),result:e&&e.result||null};state.textContent=label+': '+t('ошибка, она записана в отчёт','failed, recorded in the report');}render();}
  const row=el('div','button-row');row.style.flexWrap='wrap';
  row.append(
   button(t('1. Проверить API','1. Check API'),()=>run('api','API',()=>host('MZ.apiProbe')),'primary'),
   button(t('2. Тест ключей на клипе','2. Key test on clip'),()=>run('keys',t('Ключи','Keys'),()=>host('MZ.easingProbe'))),
   button(t('3. Тест захвата кадра','3. Frame capture test'),()=>run('frame',t('Кадр','Frame'),()=>frameTest(host))));
  box.append(row,state,out);render();
  const copy=()=>{out.focus();out.select();let ok=false;try{ok=document.execCommand('copy');}catch(e){}state.textContent=ok?t('Отчёт скопирован — вставь его в чат.','Report copied — paste it into the chat.'):t('Выдели текст отчёта и скопируй вручную (Ctrl+C).','Select the report text and copy it (Ctrl+C).');};
  modal(t('Проверка API','API check'),box,[{label:t('Скопировать отчёт','Copy report'),primary:true,run:copy},{label:t('Закрыть','Close'),run:closeModal}]);
 }};
})();
