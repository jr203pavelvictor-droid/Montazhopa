/* Standalone Meme Sounds screen. Keeps the existing ALTO sounds library untouched. */
(function () {
  'use strict';
  var client=window.AltoMyinstantsClient, state={query:'',results:[],loading:false,downloading:'',folder:'',message:'',error:'',lastFiles:[]};
  var activeAudio=null, activeObjectUrl=null;
  try {state.folder=(window.MZLocal.read('myinstants-settings.json',{})||{}).folder||'';}catch(e){}
  function stop() {
    if(activeAudio){activeAudio.pause();activeAudio.src='';activeAudio=null;}
    if(activeObjectUrl){URL.revokeObjectURL(activeObjectUrl);activeObjectUrl=null;}
  }
  function openSite(url) {
    try {
      var address=client.safeUrl(url,'page');
      if(window.cep&&window.cep.util&&window.cep.util.openURLInDefaultBrowser) window.cep.util.openURLInDefaultBrowser(address);
      else window.open(address,'_blank','noopener');
    } catch(e) {state.error=e.message;}
  }
  function pickFolder() {
    var folder='';
    try {
      if(window.cep&&window.cep.fs&&typeof window.cep.fs.showOpenDialogEx==='function'){
        var result=window.cep.fs.showOpenDialogEx(false,true,'Выбери папку для MP3',state.folder||'');
        if(result&&result.data&&result.data.length)folder=result.data[0];
      } else {
        folder=window.prompt('Абсолютный путь к папке проекта / Destination directory',state.folder||'')||'';
      }
      if(!folder)return false;
      var fs=(window.require||require)('fs');
      if(!fs.statSync(folder).isDirectory())throw Error('Папка не существует');
      state.folder=folder;
      window.MZLocal.write('myinstants-settings.json',{folder:folder});
      state.error='';state.message='Папка выбрана: '+folder;
      return true;
    }catch(e){state.error='Не удалось выбрать папку: '+e.message;return false;}
  }
  async function runSearch(U) {
    if(state.loading||state.downloading)return;
    var query=state.query.trim();
    if(!query){state.error='Введи название звука';U.render();return;}
    state.loading=true;state.error='';state.message='';state.results=[];U.render();
    try {state.results=await client.search(query);state.message='Найдено: '+state.results.length;}
    catch(e){state.error=e.message+' — можешь открыть результаты на Myinstants в браузере.';}
    finally {state.loading=false;U.render();}
  }
  async function preview(U,item) {
    if(activeAudio && activeAudio.dataset && activeAudio.dataset.target===item.mp3){stop();U.render();return;}
    stop();state.error='';state.message='Загружаю предпрослушивание…';U.render();
    try{
      var bytes=await client.mp3(item.mp3);
      activeObjectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
      activeAudio=new Audio(activeObjectUrl);
      activeAudio.dataset.target=item.mp3;
      activeAudio.volume=.55;
      activeAudio.onended=function(){stop();U.render();};
      await activeAudio.play();
      state.message='Слушаешь: '+item.title;
    }catch(e){stop();state.error='Не удалось прослушать: '+e.message;state.message='';}
    U.render();
  }
  async function download(U,item) {
    if(state.downloading||state.loading)return;
    if(!state.folder&&!pickFolder()){U.render();return;}
    state.downloading=item.mp3;state.message='Скачиваю '+item.title+'…';state.error='';U.render();
    try{
      var bytes=await client.mp3(item.mp3);
      var filename=client.save(bytes,state.folder,item.title);
      state.lastFiles.unshift(filename);
      state.lastFiles=state.lastFiles.slice(0,5);
      state.message='Сохранено: '+filename;
    }catch(e){state.error='Ошибка загрузки: '+e.message;state.message='';}
    finally{state.downloading='';U.render();}
  }
  function render(U, back) {
    var m=U.$('main');
    if(!window.MZLocal.available){
      m.append(U.el('p','help-text',U.t('Myinstants требует локальную панель ALTO в Premiere.','Myinstants requires the local ALTO panel in Premiere.')));
      return;
    }
    var h=U.el('div','section-heading'),head=U.el('div');
    head.append(U.el('p','eyebrow','ALTO / MEME SOUNDS'),U.el('h2','','Myinstants'));
    h.append(head);m.append(U.button('← '+U.t('Звуки','Sounds'),function(){stop();back();},'back'),h);
    var intro=U.el('p','help-text',U.t('Ищи мемные звуки, слушай и скачивай MP3 в выбранную папку проекта. Поиск выполняется только по кнопке.','Search meme sounds, listen, and download MP3s to a folder you choose. Search runs only when requested.'));
    m.append(intro);
    var box=U.el('section','panel mi-panel'),form=U.el('div','mi-search'),input=U.el('input');
    input.type='search';input.placeholder='vine boom, bruh, metal pipe…';input.value=state.query;input.maxLength=100;
    input.addEventListener('input',function(){state.query=input.value;});
    input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();runSearch(U);}});
    var go=U.button(state.loading?U.t('Ищу…','Searching…'):U.t('Искать','Search'),function(){runSearch(U);},'apply');
    go.disabled=!!(state.loading||state.downloading);
    form.append(input,go);box.append(form);
    var folder=U.el('div','mi-folder'),label=U.el('div','mi-path');
    label.append(U.el('strong','',U.t('Папка загрузки','Download folder')),U.el('span','',state.folder||U.t('Пока не выбрана','Not selected yet')));
    var choose=U.button(U.t('Выбрать…','Choose…'),function(){pickFolder();U.render();});
    choose.disabled=!!state.downloading;folder.append(label,choose);box.append(folder);
    m.append(box);
    if(state.error)m.append(U.el('p','mi-error',state.error));
    if(state.message)m.append(U.el('p','mi-message',state.message));
    var site=U.button(U.t('Открыть поиск на Myinstants ↗','Open search on Myinstants ↗'),function(){openSite('https://www.myinstants.com/en/search/?name='+encodeURIComponent(state.query||'vine boom'));},'mi-external');
    m.append(site);
    var results=U.el('div','mi-results');
    state.results.forEach(function(item){
      var row=U.el('article','mi-result'),info=U.el('div','mi-info');
      info.append(U.el('strong','',item.title));
      var link=U.button(U.t('Страница звука ↗','Sound page ↗'),function(){openSite(item.page);},'mi-link');
      info.append(link);
      var controls=U.el('div','mi-actions');
      var play=U.button(U.t('▶ Слушать','▶ Play'),function(){preview(U,item);});
      var save=U.button(state.downloading===item.mp3?U.t('Скачиваю…','Downloading…'):U.t('↓ Скачать MP3','↓ Download MP3'),function(){download(U,item);},'apply');
      save.disabled=!!(state.loading||state.downloading);
      controls.append(play,save);row.append(info,controls);results.append(row);
    });
    m.append(results);
    if(state.lastFiles.length){
      m.append(U.el('h3','mi-saved-heading',U.t('Последние загрузки','Recent downloads')));
      state.lastFiles.forEach(function(p){m.append(U.el('p','mi-last',p));});
    }
    m.append(U.el('p','help-text',U.t('Неофициальная интеграция. Доступность поиска зависит от Myinstants; права на использование звуков проверяй отдельно. Автоматические обходы защиты не выполняются.','Unofficial integration. Search availability depends on Myinstants; verify rights to use each sound. No bypass of access restrictions.')));
  }
  window.addEventListener('blur',stop);
  window.AltoMyinstants={render:render,stop:stop};
}());
