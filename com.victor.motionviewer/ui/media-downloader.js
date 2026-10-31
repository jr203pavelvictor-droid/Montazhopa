/* Media Downloader: the native yt-dlp extractor surfaced inside ALTO (no site list). */
(function(){
 'use strict';
 var L=window.MZLocal,coreFactory=window.AltoDownloaderCore;
 var state={url:'',data:null,busy:false,installing:false,percent:'',message:'',error:'',lastFiles:[],format:'best',playlist:false,autoImport:true,
   folder:'',engine:'',ffmpeg:'',engineVersion:'',inspectFormats:false};
 var api=null;
 try{
   var cfg=L.read('downloader-settings.json',{});state.folder=cfg.folder||'';state.engine=cfg.engine||'';state.ffmpeg=cfg.ffmpeg||'';state.autoImport=cfg.autoImport!==false;
 }catch(_){}
 function get(){
   if(api)return api;
   if(!L.available)throw Error('Downloader requires ALTO running inside Premiere');
   var req=window.require||require;
   api=coreFactory({fs:req('fs'),path:req('path'),os:req('os'),cp:req('child_process'),https:req('https'),crypto:req('crypto'),root:req('path').join(L.assetDir(),'downloader-engine')});
   return api;
 }
 function config(){return {engine:state.engine,ffmpeg:state.ffmpeg};}
 function save(){L.write('downloader-settings.json',{folder:state.folder,engine:state.engine,ffmpeg:state.ffmpeg,autoImport:state.autoImport});}
 function refresh(U){if(U&&U.state&&U.state.screen==='media-downloader')U.render();}
 function pickFolder(U){
   try{
     var r=window.cep&&window.cep.fs&&window.cep.fs.showOpenDialogEx&&window.cep.fs.showOpenDialogEx(false,true,'Выбери папку для загрузки видео',state.folder);
     if(r&&r.data&&r.data.length){state.folder=r.data[0];state.error='';save();refresh(U);}
   }catch(e){state.error='Папка: '+e.message;refresh(U);}
 }
 function pickBinary(U,kind){
   try{
     var r=window.cep&&window.cep.fs&&window.cep.fs.showOpenDialogEx&&window.cep.fs.showOpenDialogEx(false,false,kind==='ffmpeg'?'Выбрать FFmpeg':'Выбрать yt-dlp','');
     if(r&&r.data&&r.data.length){state[kind==='ffmpeg'?'ffmpeg':'engine']=r.data[0];state.error='';save();refresh(U);}
   }catch(e){state.error=e.message;refresh(U);}
 }
 async function install(U){
   if(state.busy||state.installing)return;
   state.installing=true;state.message='Подключение к GitHub…';state.error='';refresh(U);
   try{
     var res=await get().install(function(message){state.message=message;refresh(U);});
     state.engine=res.path;state.engineVersion=res.version;save();state.message='Установлен yt-dlp '+res.version+' · проверка SHA-256 пройдена.';
   }catch(e){state.error='Установка yt-dlp: '+e.message;}
   finally{state.installing=false;refresh(U);}
 }
 async function inspect(U){
   if(state.busy||state.installing)return;
   state.busy=true;state.message='Анализирую ссылку…';state.error='';state.data=null;refresh(U);
   try{state.data=await get().inspect(state.url,config());state.message='Найдено: '+state.data.title;}
   catch(e){state.error='Анализ: '+e.message;state.message='';}
   finally{state.busy=false;refresh(U);}
 }
 async function download(U){
   if(state.busy||state.installing)return;
   if(!state.folder){state.error='Сначала выбери папку для загрузки';refresh(U);return;}
   state.busy=true;state.percent='';state.error='';state.lastFiles=[];state.message='Начинаю загрузку…';refresh(U);
   try{
     var paths=await get().download(state.url,state.folder,{engine:state.engine,ffmpeg:state.ffmpeg,mode:state.format,playlist:state.playlist,mediaId:state.data&&state.data.id||'',mediaTitle:state.data&&state.data.title||''},function(progress){
       if(progress.percent)state.percent=progress.percent;
       state.message=progress.message||('Загрузка: '+(progress.percent||'')+' · '+(progress.speed||'')+' · ETA '+(progress.eta||'')).slice(0,250);
       var label=U.$('alto-download-progress');if(label)label.textContent=state.message;
     });
     if(!paths.length)throw Error('yt-dlp завершился, но готовый файл не обнаружен. Проверь папку загрузок.');
     state.lastFiles=paths;state.message='Завершено: '+paths.length+' файл(ов)';
     if(state.autoImport){
       var allowed=paths.filter(function(x){return /\.(mp4|mov|mxf|avi|mkv|wav|mp3|aif|aiff|aac|m4a)$/i.test(x);});
       if(allowed.length&&window.__adobe_cep__){
         try{var response=await U.host('MZ.importFiles',[allowed.slice(0,200),'ALTO / Downloads']);
           state.message+=' · Импортировано в Premiere: '+(response.accepted?response.accepted.length:response.count||0);
         }catch(e){state.error='Файлы сохранены, но импорт не удался: '+e.message;}
       }else if(!allowed.length){state.error='Формат файла не подходит для импорта; он сохранён на диске.';}
     }
   }catch(e){state.error=e.message;state.message='';}
   finally{state.busy=false;refresh(U);}
 }
 function render(U,back){
   var main=U.$('main'),T=U.t,el=U.el,btn=U.button;
   main.append(btn('← '+T('Инструменты','Tools'),function(){back();},'back'),U.topHeading('Media Downloader','Media Downloader'));
   main.append(el('p','help-text',T('Полный движок yt-dlp: сайты, качество и форматы определяются им. Ссылка обрабатывается локально, файл сохраняется на компьютере.','Real yt-dlp engine. Sites and formats are determined by yt-dlp. Files are saved locally.')));
   if(!L.available){main.append(el('p','mi-error',T('Загрузчик работает только внутри Premiere.','Run inside Premiere.')));return;}
   var p=U.panel('yt-dlp · Engine'),first=el('div','dl-engine');
   first.append(el('strong','',state.engineVersion?'yt-dlp '+state.engineVersion:state.engine?T('Используется выбранный yt-dlp','Custom yt-dlp selected'):T('yt-dlp: автоматически или из PATH','yt-dlp: installed binary or PATH')));
   var installBtn=btn(state.installing?T('Установка…','Installing…'):T('Установить / обновить yt-dlp','Install / update yt-dlp'),function(){install(U);},'apply');
   installBtn.disabled=state.busy||state.installing;
   first.append(installBtn);p.append(first);
   var bin=el('div','dl-row');bin.append(btn(T('Выбрать существующий yt-dlp','Choose yt-dlp binary'),function(){pickBinary(U,'engine');}),btn(T('Проверить yt-dlp','Check yt-dlp'),function(){get().version(config()).then(function(v){state.engineVersion=v;state.message='yt-dlp '+v;refresh(U);},function(e){state.error=e.message;refresh(U);});}));p.append(bin);
   if(state.engine)p.append(el('p','dl-path',state.engine));
   main.append(p);
   var form=U.panel(T('Загрузка по ссылке','Download from URL'));
   var lbl=el('label','dl-field'),input=el('input');input.type='url';input.id='alto-download-url';input.placeholder='https://…';input.value=state.url;input.spellcheck=false;input.autocomplete='off';
   input.addEventListener('input',function(){state.url=input.value;});input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();inspect(U);}});
   lbl.append(el('span','',T('URL видео или плейлиста','Video or playlist URL')),input);form.append(lbl);
   var inspectBtn=btn(state.busy?T('Обрабатываю…','Working…'):T('Проверить ссылку','Analyze URL'),function(){inspect(U);},'dl-analyze');inspectBtn.disabled=state.busy||state.installing;form.append(inspectBtn);
   if(state.data){
     var info=el('div','dl-video-info');info.append(el('strong','',state.data.title),el('small','',state.data.extractor+(state.data.duration?' · '+Math.floor(state.data.duration/60)+':'+('0'+Math.floor(state.data.duration%60)).slice(-2):'')+' · '+state.data.formats.length+' formats'));form.append(info);
   }
   var fld=el('div','dl-folder'),pathInfo=el('div','dl-folder-path');pathInfo.append(el('strong','',T('Куда сохранять','Download folder')),el('span','',state.folder||T('Папка не выбрана','Choose a folder')));
   fld.append(pathInfo,btn(T('Выбрать','Choose'),function(){pickFolder(U);}));form.append(fld);
   var modeLabel=el('label','dl-field'),mode=el('select');mode.id='alto-download-quality';
   var modes=[['best',T('Максимальное качество','Best available quality')],['mp4',T('MP4 / H.264 (если доступно)','MP4 / H.264 (if available)')],['1080',T('До 1080p','Up to 1080p')],['720',T('До 720p','Up to 720p')],['audio',T('Только аудио → MP3','Audio only → MP3')]];
   if(state.data){for(var f of state.data.formats){if(f.id&&f.vcodec!=='none'&&f.height)modes.push(['format:'+f.id+(f.acodec==='none'?'+ba':''),(f.height+'p · '+f.ext+' · '+f.id+(f.note?' · '+f.note:''))]);}}
   var unique=new Set();modes.forEach(function(entry){if(unique.has(entry[0]))return;unique.add(entry[0]);var o=el('option','',entry[1]);o.value=entry[0];mode.append(o);});mode.value=state.format;if(mode.selectedIndex<0)mode.value='best';mode.onchange=function(){state.format=mode.value;};
   modeLabel.append(el('span','',T('Формат и качество','Format and quality')),mode);form.append(modeLabel);
   var playlist=el('label','dl-check'),pc=el('input');pc.type='checkbox';pc.checked=state.playlist;pc.onchange=function(){state.playlist=pc.checked;};playlist.append(pc,el('span','',T('Скачать весь плейлист','Download entire playlist')));form.append(playlist);
   var auto=el('label','dl-check'),ac=el('input');ac.type='checkbox';ac.checked=state.autoImport;ac.onchange=function(){state.autoImport=ac.checked;save();};auto.append(ac,el('span','',T('Автоимпорт готовых файлов в Premiere','Auto-import files into Premiere')));form.append(auto);
   var fRow=el('div','dl-row');fRow.append(btn(state.ffmpeg?T('Изменить FFmpeg','Change FFmpeg'):T('Указать FFmpeg (необязательно)','Select FFmpeg (optional)'),function(){pickBinary(U,'ffmpeg');}));form.append(fRow);
   if(state.ffmpeg)form.append(el('p','dl-path',state.ffmpeg));else{var found='';try{found=get().findFfmpeg(config());}catch(_){}form.append(el('p','dl-path',found?T('FFmpeg найден: ','FFmpeg found: ')+found:T('FFmpeg не найден: видео скачается одним готовым файлом, обычно до 720p. Укажи FFmpeg для лучшего качества и MP3.','FFmpeg not found: video downloads as one ready file, usually up to 720p. Select FFmpeg for best quality and MP3.')));}
   var controls=el('div','dl-row'),start=btn(state.busy?T('Загружаю…','Downloading…'):T('↓ Скачать','↓ Download'),function(){download(U);},'apply'),cancel=btn(T('Остановить','Cancel'),function(){if(get().cancel()){state.message='Отменяю…';var status=U.$('alto-download-progress');if(status)status.textContent=state.message;}},'dl-cancel');
   start.disabled=state.busy||state.installing;cancel.disabled=!state.busy;controls.append(start,cancel);form.append(controls);
   var progress=el('p','dl-progress',state.message);progress.id='alto-download-progress';form.append(progress);main.append(form);
   if(state.error)main.append(el('p','mi-error',state.error));
   if(state.lastFiles.length){var result=U.panel(T('Скачанные файлы','Downloaded files'));state.lastFiles.forEach(function(f){result.append(el('p','dl-path',f));});main.append(result);}
   main.append(el('p','help-text',T('yt-dlp может требовать FFmpeg для объединения видео/аудио и извлечения MP3. Защищённые DRM-потоки он не расшифровывает.','FFmpeg may be needed for merging streams and MP3 extraction; yt-dlp cannot decrypt DRM.')));
 }
 window.AltoMediaDownloader={render:render,stop:function(){if(api)api.cancel();}};
})();
