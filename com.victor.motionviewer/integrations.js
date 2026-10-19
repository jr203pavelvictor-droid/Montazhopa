/* Montazhopa screens connected to real VibeTools / OpenCutz / Syncitol modules. */
(function(){
 'use strict';
 const D=window.MZDesktop,L=window.MZLocal;
 const work={file:null,cut:null,transcript:null,sync:[null,null],syncResult:null,doctor:null,presets:null};
 let U;
 function show(screen){U.state.screen=screen;U.render();document.getElementById('main').scrollTop=0;}
 function pick(folder){
  if(!window.cep||!window.cep.fs)throw Error('MZ_DESKTOP_REQUIRED');
  const r=window.cep.fs.showOpenDialogEx(false,!!folder,U.t('Выбрать '+(folder?'папку':'файл'),'Choose '+(folder?'folder':'file')),'');
  return !r.err&&r.data&&r.data[0]||null;
 }
 function heading(ru,en){const m=U.$('main');m.append(U.backButton(()=>show('tools')),U.topHeading(ru,en));return m;}
 function note(parent,ru,en){parent.append(U.el('p','help-text',U.t(ru,en)));}
 function localRequired(parent){if(D.available)return false;note(parent,'Открой панель в Premiere, чтобы выбрать локальные материалы.','Open the panel in Premiere to select local media.');return true;}
 function chooseMedia(parent,onPick){parent.append(U.button(work.file?U.t('Сменить файл','Change file'):U.t('Выбрать видео или аудио','Choose video or audio'),()=>{try{const p=pick(false);if(p){work.file=p;work.cut=null;work.transcript=null;if(onPick)onPick();U.render();}}catch(e){U.error(e);}}));if(work.file)parent.append(U.el('p','file-caption',work.file));}
 function worker(request){return D.runWorker(Object.assign({path:work.file},request));}
 function dependencies(parent){note(parent,'Нужны Python 3.11+ и FFmpeg. Проверка и пути — в «Локальной обработке».','Requires Python 3.11+ and FFmpeg. Check availability in Local tools.');parent.append(U.button(U.t('Локальная обработка','Local tools'),()=>show('localtools'),'reference-link'));}
 function importResult(result){return U.operation(async()=>{await U.host('MZ.importInterchange',[result.path]);U.status('Файл импортирован в Project / Montazhopa / Generated.','Imported into Project / Montazhopa / Generated.');});}
 function resultActions(parent,result,caption){parent.append(U.el('p','file-caption',result.path),U.button(caption,()=>importResult(result),'primary'),U.button(U.t('Показать файл','Show file'),()=>{try{D.revealFile(result.path);}catch(e){U.error(e);}}));}
 function cut(){
  const m=heading('Убрать тишину','Remove pauses'),p=U.panel();m.append(p);if(localRequired(p))return;
  chooseMedia(p);note(p,'Анализ одного исходного файла. После проверки создадим новую секвенцию; существующий монтаж остаётся на месте.','Analyzes one source file. Review the intervals to create a new sequence. Your current edit stays in place.');
  work.threshold=work.threshold===undefined?-35:work.threshold;work.minPause=work.minPause||.4;work.padding=work.padding===undefined?.1:work.padding;
  const invalid=()=>{work.cut=null;work.xml=null;const results=m.querySelector('.analysis-results');if(results)results.remove();};
  p.append(U.field(U.t('Порог тишины','Silence threshold'),'cut-threshold',work.threshold,-65,-15,1,v=>{work.threshold=v;invalid();},null,' dB'),U.field(U.t('Минимальная пауза','Minimum pause'),'cut-pause',work.minPause,.1,3,.05,v=>{work.minPause=v;invalid();},null,' s'),U.field(U.t('Воздух вокруг речи','Speech padding'),'cut-padding',work.padding,0,.5,.01,v=>{work.padding=v;invalid();},null,' s'));
  const run=U.button(U.t('Найти участки речи','Find speech intervals'),()=>U.operation(async()=>{if(!work.file)throw Error('Choose a file');const file=work.file;const r=await worker({op:'silence',threshold:work.threshold,minPause:work.minPause,padding:work.padding});if(file!==work.file)return;work.cut=r;work.cut.segments.forEach(s=>s.keep=true);work.xml=null;U.render();}),'apply');run.disabled=U.state.busy;p.append(run);
  if(work.cut){const r=work.cut,box=U.panel();box.classList.add('analysis-results');m.append(box);const selected=r.segments.filter(s=>s.keep),duration=selected.reduce((a,s)=>a+s.end-s.start,0);box.append(U.el('h3','',U.t('Оставить в новой секвенции','Keep in the new sequence')),U.el('p','help-text',r.duration.toFixed(1)+' s → '+duration.toFixed(1)+' s · '+selected.length+'/'+r.segments.length));
   const list=U.el('div','interval-list');r.segments.forEach((s,i)=>{const label=U.el('label','check'),input=U.el('input');input.type='checkbox';input.checked=s.keep;input.onchange=()=>{s.keep=input.checked;work.xml=null;U.render();};label.append(input,document.createTextNode(String(i+1).padStart(2,'0')+' · '+s.start.toFixed(2)+' – '+s.end.toFixed(2)+' s'));list.append(label);});box.append(list);
   if(!r.segments.length)note(box,'Речь не найдена. Ослабь порог и повтори анализ.','No speech intervals found. Adjust the threshold and analyze again.');
   else box.append(U.button(U.t('Создать монтажный XML','Create edit XML'),()=>U.operation(async()=>{work.xml=await worker({op:'xml',segments:selected});U.render();}),'apply'));
   if(work.xml)resultActions(box,work.xml,U.t('Импортировать новую секвенцию','Import new sequence'));
  }dependencies(m);
 }
 function captions(){
  const m=heading('Субтитры и повторы','Captions and retakes'),p=U.panel();m.append(p);if(localRequired(p))return;chooseMedia(p);
  const c=D.config();note(p,'Распознавание работает на компьютере с установленной локальной моделью. Первый запуск требует отдельной настройки.','Recognition runs on your computer using an installed local model. Initial setup is required.');
  p.append(U.selectField(U.t('Язык речи','Speech language'),'caption-language',[['','Auto'],['ru','Русский'],['ro','Română'],['en','English']],work.language||'',v=>{work.language=v;work.transcript=null;work.srt=null;U.render();}));
  const run=U.button(U.t('Распознать речь','Transcribe'),()=>U.operation(async()=>{if(!work.file)throw Error('Choose a file');const file=work.file;const r=await worker({op:'transcribe',model:c.model,language:work.language||''});if(file!==work.file)return;work.transcript=r;work.repeats=null;work.srt=null;U.render();}),'apply');run.disabled=U.state.busy;p.append(run);
  if(work.transcript){const result=U.panel(),segments=work.transcript.segments;m.append(result);result.append(U.el('h3','',U.t('Проверь текст перед экспортом','Review before exporting')));const list=U.el('div','transcript-list');segments.forEach((s,i)=>{const row=U.el('label','transcript-row');row.append(U.el('small','',s.start.toFixed(2)+' – '+s.end.toFixed(2)+' s'));const input=U.el('textarea');input.value=s.text;input.rows=2;input.setAttribute('aria-label',U.t('Субтитр ','Caption ')+(i+1));input.oninput=()=>{s.text=input.value;work.srt=null;work.repeats=null;const old=result.querySelector('.export-result');if(old)old.remove();const repeats=result.querySelector('.repeat-result');if(repeats)repeats.remove();};row.append(input);list.append(row);});result.append(list,U.button(U.t('Экспортировать SRT','Export SRT'),()=>U.operation(async()=>{work.srt=await worker({op:'srt',segments});U.render();}),'apply'),U.button(U.t('Найти похожие дубли','Find repeated takes'),()=>U.operation(async()=>{work.repeats=await worker({op:'repeats',segments});U.render();})));
   if(work.repeats){const repeat=U.el('div','repeat-result');result.append(repeat);note(repeat,'Похожих повторов: '+work.repeats.repeats.length+'. Это подсказки по тексту, качество дубля проверь сам.','Repeated phrases: '+work.repeats.repeats.length+'. These are text matches; review the performance yourself.');work.repeats.repeats.slice(0,100).forEach(r=>repeat.append(U.el('pre','repeat-entry',JSON.stringify(r,null,2))));}
   if(work.srt){const out=U.el('div','export-result');result.append(out);resultActions(out,work.srt,U.t('Импортировать SRT в Project','Import SRT into Project'));note(out,'После импорта перетащи SRT в секвенцию, чтобы создать дорожку субтитров.','After importing, drag the SRT onto a sequence to create a caption track.');}
  }dependencies(m);
 }
 async function decode(file){
  const ctx=new (window.AudioContext||window.webkitAudioContext)();try{const bytes=await file.arrayBuffer();return await ctx.decodeAudioData(bytes);}finally{await ctx.close();}
 }
 function envelope(buffer){
  // Average absolute amplitude of the loudest channel. Keep at most the first 120s.
  const n=Math.min(buffer.length,Math.floor(buffer.sampleRate*120)),rate=8000,mono=new Int16Array(Math.floor(n/buffer.sampleRate*rate));
  let channel=0,best=0;for(let c=0;c<buffer.numberOfChannels;c++){const x=buffer.getChannelData(c);let energy=0;for(let i=0;i<n;i+=32)energy+=x[i]*x[i];if(energy>best){best=energy;channel=c;}}
  const source=buffer.getChannelData(channel);for(let i=0;i<mono.length;i++){const start=Math.floor(i*buffer.sampleRate/rate),end=Math.min(n,Math.max(start+1,Math.floor((i+1)*buffer.sampleRate/rate)));let sum=0;for(let j=start;j<end;j++)sum+=Math.abs(source[j]);mono[i]=Math.min(32767,Math.round(sum/(end-start)*32767));}
  return window.MZSyncDSP.buildEnvelope(mono,80);
 }
 function sync(){
  const m=heading('Синхронизация звука','Audio alignment'),p=U.panel();m.append(p);
  note(p,'Выбери две аудиозаписи одной сцены. Сравниваем первые 120 секунд, ищем сдвиг до ±30 секунд. Лучше всего WAV или MP3.','Choose two audio recordings of the same scene. Compares their first 120 seconds within ±30 seconds. WAV or MP3 is recommended.');
  for(let i=0;i<2;i++){const label=U.el('label','field');label.append(U.el('span','',U.t(i?'Запись для совмещения':'Опорная запись',i?'Target recording':'Reference recording')));const input=U.el('input');input.type='file';input.accept='audio/*';input.onchange=()=>U.operation(async()=>{const file=input.files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('Sync input is limited to 64 MB per file');const b=await decode(file);work.sync[i]={name:file.name,envelope:envelope(b)};work.syncResult=null;U.render();});label.append(input);if(work.sync[i])label.append(U.el('small','',work.sync[i].name));p.append(label);}
  p.append(U.button(U.t('Рассчитать сдвиг','Calculate offset'),()=>U.operation(async()=>{
   if(!work.sync[0]||!work.sync[1])throw Error('Choose both recordings');
   U.status('Сравниваю записи…','Comparing recordings…');await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   const r=window.MZSyncDSP.findBestLag(work.sync[0].envelope,work.sync[1].envelope,{maxShiftSec:30,minOverlapSec:3,envelopeRate:100});work.syncResult=r||{noMatch:true};U.render();
  }),'apply'));
  if(work.syncResult){const r=work.syncResult,b=U.panel();m.append(b);if(r.noMatch)note(b,'Недостаточно общей речи для сравнения.','Not enough shared audio for comparison.');else{
   b.append(U.el('div','offset-value',(-r.lagSec).toFixed(3)+' s'));note(b,'Сдвиг второй записи относительно первой. Совпадение: '+(r.score*100).toFixed(1)+'%.','Target shift relative to reference. Correlation: '+(r.score*100).toFixed(1)+'%.');
   note(b,r.atRail||r.score<.5?'Совпадение ненадёжное. Проверь хлопок или общую речь вручную.':'Положительное значение — передвинь вторую запись вправо, отрицательное — влево. Проверь результат на слух.',r.atRail||r.score<.5?'Weak or boundary match. Check a clap or shared speech manually.':'Positive means move the target right; negative means left. Verify by ear.');
  }}note(m,'Алгоритм Syncitol. Эта версия показывает сдвиг для ручного совмещения и не перемещает клипы автоматически.','Powered by Syncitol. This version reports a manual alignment offset and does not move timeline clips.');
 }
 function presets(){
  const m=heading('Мои пресеты Premiere','Premiere preset files'),p=U.panel();m.append(p);if(localRequired(p))return;
  p.append(U.button(U.t('Найти пресеты','Scan presets'),()=>U.operation(async()=>{work.presets=D.indexPresets();U.render();})),U.button(U.t('Добавить папку','Add folder'),()=>{try{const f=pick(true);if(f){D.addPresetRoot(f);work.presets=D.indexPresets();U.render();}}catch(e){U.error(e);}}));
  note(p,'Индексируем названия из .prfpset. Для импорта открой Effects → Presets → Import Presets в Premiere.','Indexes names inside .prfpset. Import them through Effects → Presets → Import Presets in Premiere.');
  const input=U.el('input');input.placeholder=U.t('Найти пресет…','Find a preset…');input.type='search';const list=U.el('div','native-results');const populate=()=>{list.replaceChildren();const items=(work.presets||[]).filter(x=>x.name.toLowerCase().includes(input.value.toLowerCase()));items.slice(0,200).forEach(x=>{const b=U.button(x.name,()=>{try{D.revealFile(x.file);}catch(e){U.error(e);}},'native-row');b.title=x.file;list.append(b);});if(!items.length)note(list,'Пресеты не найдены. Добавь папку с .prfpset.','No presets found. Add a folder containing .prfpset.');};input.oninput=populate;m.append(input,list);populate();
 }
 function localtools(){
  const m=heading('Локальная обработка','Local tools'),p=U.panel();m.append(p);if(localRequired(p))return;const c=D.config();
  note(p,'Нарезка использует Python и FFmpeg. Для субтитров дополнительно нужны faster-whisper и локальная модель. Звук и видео остаются на компьютере.','Cutting uses Python and FFmpeg. Captions also need faster-whisper and a local model. Media stays on your computer.');
  for(const [key,ru,en]of [['python','Python 3.11+ — путь к программе','Python 3.11+ executable'],['ffmpeg','FFmpeg — путь к программе','FFmpeg executable'],['ffprobe','FFprobe — путь к программе','FFprobe executable'],['model','Папка модели faster-whisper','faster-whisper model folder']]){const row=U.el('label','field');row.append(U.el('span','',U.t(ru,en)));const input=U.el('input');input.value=c[key]||'';input.placeholder=key==='model'?U.t('Папка с model.bin','Folder containing model.bin'):U.t('Автоопределение','Auto-detect');input.onchange=()=>{c[key]=input.value.trim();D.saveConfig(c);};row.append(input);p.append(row);}
  p.append(U.button(U.t('Проверить готовность','Check availability'),()=>U.operation(async()=>{work.doctor=await worker({op:'doctor'});U.render();}),'apply'));
  if(work.doctor)p.append(U.el('pre','doctor-result',JSON.stringify(work.doctor,null,2)));
  note(m,'В скачанном комплекте есть SETUP_LOCAL_TOOLS и подробная инструкция. Настройка AI запускается отдельно и скачивает зависимости и выбранную модель только по твоей команде.','The download includes SETUP_LOCAL_TOOLS and detailed instructions. AI setup is separate and downloads dependencies and your chosen model only when you run it.');
 }
 function modules(){const m=heading('Состав этой версии','Included modules');for(const [name,ru,en]of [
  ['VibeTools + Jungle','Предпрослушивание, waveform, pitch и reverse. Экспорт WAV через свой FFmpeg.','Preview, waveform, pitch and reverse. WAV export uses your FFmpeg.'],
  ['OpenCutz','Поиск речи, XML новой секвенции, локальные субтитры и поиск повторов. Нужны локальные инструменты.','Speech intervals, new-sequence XML, local captions and repeat detection. Local tools required.'],
  ['Syncitol','Расчёт сдвига двух аудиозаписей; совмещение на таймлайне вручную.','Calculates audio offset between two recordings; timeline alignment is manual.'],
  ['PR Extension','Адаптированный клиент релизов GitHub; установка и откат — механизм Монтажопы.','Adapted GitHub releases client; installation and rollback are Montazhopa code.'],
  ['IronFX / SheepDog','По результатам разбора улучшены собственные поиск, сопоставление клипов и очередь папок. Чужой код этих проектов в пакет не включён.','Audit informed improvements to our search, clip matching and folder queue. Their source code is not included.'],
  ['Native / SmartCut','Нативные DLL VibeTools, UXP-панель Syncitol и код SmartCut в этот CEP-релиз не включены.','VibeTools native DLLs, Syncitol UXP panel and SmartCut code are not included in this CEP release.']]){const p=U.panel(name);note(p,ru,en);m.append(p);}note(m,'Лицензии и точные версии исходников находятся в комплекте. Реальный Premiere и нативная сборка на Windows/Mac здесь не запускались.','Licenses and source revisions are included. Live Premiere and native Windows/Mac builds have not been run here.');}
 function init(ui){U=ui;const player=window.MZVibeAudio.AudioPreview;player.init();document.getElementById('audio-export').onclick=()=>U.operation(async()=>{const item=await D.exportPreview();U.status('Обработанный WAV добавлен: '+item.name,'Processed WAV added: '+item.name);U.render();});window.addEventListener('beforeunload',()=>{player.hide();if(player.audioCtx)player.audioCtx.close();});}
 window.MZPlus={init,render:screen=>{const fn={cut,captions,sync,presets,localtools,modules}[screen];if(fn){fn();return true;}return false;},preview:async item=>{if(!U)return;try{const p=window.MZVibeAudio.AudioPreview;if(p.asset&&p.asset.id===item.id&&p.el.classList.contains('visible')){p.togglePlay();return;}await p.show(item);if(p.asset&&p.asset.id===item.id&&!p.isPlaying)p.play();}catch(e){window.MZVibeAudio.AudioPreview.hide();U.error(e);}},work};
}());
