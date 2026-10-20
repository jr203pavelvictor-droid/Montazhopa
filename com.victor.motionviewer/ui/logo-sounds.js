/* ALTO logo soundboard: opt-in local MP3 playlist, no playback until a click. */
(function(){
 'use strict';
 var FILE='logo-sounds.json',MAX=30,DEFAULT=15,active=null,lastId=null;
 function local(){return window.MZLocal;}
 function read(){
  var saved=local().read(FILE,null),base={enabled:true,volume:DEFAULT,sounds:[]};
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return base;
  base.enabled=saved.enabled!==false;
  base.volume=Number.isFinite(+saved.volume)?Math.max(0,Math.min(50,Math.round(+saved.volume))):DEFAULT;
  base.sounds=Array.isArray(saved.sounds)?saved.sounds.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.path==='string').slice(0,MAX):[];
  return base;
 }
 function write(data){local().write(FILE,data);}
 function stop(){
  if(!active)return;
  try{active.pause();active.removeAttribute('src');active.load();}catch(e){}
  active=null;
 }
 function playRandom(){
  if(!local().available)return;
  var state=read();if(!state.enabled||!state.sounds.length||!state.volume)return;
  var req=window.require||require,fs=req('fs'),util=req('url');
  var playable=state.sounds.filter(x=>{try{return fs.statSync(x.path).isFile();}catch(e){return false;}});
  if(!playable.length)return;
  var candidates=playable.length>1?playable.filter(x=>x.id!==lastId):playable;
  if(!candidates.length)candidates=playable;
  var item=candidates[Math.floor(Math.random()*candidates.length)];lastId=item.id;
  stop();
  try{
   var audio=new Audio(util.pathToFileURL(item.path).href);
   audio.volume=state.volume/100;audio.preload='auto';
   audio.addEventListener('ended',function(){if(active===audio)stop();},{once:true});
   audio.addEventListener('error',function(){if(active===audio)stop();},{once:true});
   active=audio;
   var result=audio.play();if(result&&result.catch)result.catch(function(){if(active===audio)stop();});
  }catch(e){stop();}
 }
 async function add(item){
  if(!local().available)throw Error('Open ALTO inside Premiere to save local sounds');
  var api=window.AltoMyinstantsClient;
  if(!item||typeof item.title!=='string')throw Error('Sound information missing');
  var src=api.safeUrl(item.mp3,'mp3'),data=read();
  if(data.sounds.some(x=>x.source===src))return false;
  if(data.sounds.length>=MAX)throw Error('Достигнут лимит в '+MAX+' звуков');
  var bytes=await api.mp3(src);
  // Recheck after awaiting download to avoid duplicate entries on simultaneous clicks.
  data=read();if(data.sounds.some(x=>x.source===src))return false;
  if(data.sounds.length>=MAX)throw Error('Достигнут лимит в '+MAX+' звуков');
  var req=window.require||require,fs=req('fs'),path=req('path');
  var root=path.join(local().assetDir(),'logo-sounds');fs.mkdirSync(root,{recursive:true});
  var id=local().id(),dest=path.join(root,id+'.mp3'),fd;
  try{
   fd=fs.openSync(dest,'wx');fs.writeFileSync(fd,bytes);fs.closeSync(fd);fd=null;
   data.sounds.push({id:id,name:item.title.slice(0,160),source:src,path:dest,added:Date.now()});
   write(data);return true;
  }catch(e){
   if(fd!==null&&fd!==undefined)try{fs.closeSync(fd);}catch(ignore){}
   try{fs.unlinkSync(dest);}catch(ignore){}
   throw e;
  }
 }
 function remove(id){
  var state=read(),item=state.sounds.find(x=>x.id===id);
  if(!item)return;
  stop();state.sounds=state.sounds.filter(x=>x.id!==id);
  write(state);
  // Remove only files whose location matches our own dedicated soundboard folder.
  try{
   var req=window.require||require,fs=req('fs'),path=req('path');
   var dir=path.resolve(local().assetDir(),'logo-sounds'),p=path.resolve(item.path);
   if(p.startsWith(dir+path.sep)&&fs.existsSync(p))fs.unlinkSync(p);
  }catch(e){}
  if(lastId===id)lastId=null;
 }
 function contains(item){try{return read().sounds.some(x=>x.source===window.AltoMyinstantsClient.safeUrl(item.mp3,'mp3'));}catch(e){return false;}}
 function settingsPanel(U){
  var state=read(),p=U.panel(U.t('Звуки при нажатии на ALTO','Logo click sounds'));
  var toggle=U.el('label','field'),head=U.el('span','',U.t('Включить случайные звуки','Enable random sounds'));
  var input=U.el('input');input.type='checkbox';input.checked=state.enabled;input.id='settings-logo-sounds-enabled';
  input.onchange=function(){var now=read();now.enabled=input.checked;write(now);if(!now.enabled)stop();};
  toggle.append(head,input);p.append(toggle);
  var vol=U.el('label','field');
  vol.append(U.el('span','',U.t('Громкость при нажатии','Click volume')));
  var line=U.el('div','mi-logo-volume'),slider=U.el('input'),display=U.el('output');
  slider.id='settings-logo-volume';slider.type='range';slider.min='0';slider.max='50';slider.step='1';slider.value=state.volume;
  display.textContent=state.volume+'%';display.setAttribute('for','settings-logo-volume');
  slider.oninput=function(){display.textContent=slider.value+'%';};
  slider.onchange=function(){var now=read();now.volume=Number(slider.value);write(now);if(active)active.volume=now.volume/100;};
  line.append(slider,display);vol.append(line);p.append(vol);
  var help=U.el('p','help-text',U.t('Добавляй мемы во вкладке «Звук → Myinstants». При нажатии на логотип воспроизводится один случайный звук, без повторения подряд.','Add sounds in Sounds → Myinstants. Clicking the logo plays a random sound without immediate repeats.'));
  p.append(help);
  var list=U.el('div','mi-logo-list');
  for(var item of state.sounds){
   (function(sound){
    var row=U.el('div','mi-logo-item');
    row.append(U.el('span','',sound.name),U.button(U.t('Удалить','Remove'),function(){remove(sound.id);U.render();}));
    list.append(row);
   })(item);
  }
  if(!state.sounds.length)list.append(U.el('p','help-text',U.t('Пока ни одного звука. Добавь их через поиск Myinstants.','No sounds yet. Add them from Myinstants search.')));
  p.append(list);
  var tryButton=U.button(U.t('▶ Проверить звук','▶ Test sound'),playRandom);
  tryButton.disabled=!state.sounds.length||!state.enabled||!state.volume;
  p.append(tryButton);
  return p;
 }
 window.AltoLogoSounds={add:add,remove:remove,read:read,contains:contains,playRandom:playRandom,stop:stop,settingsPanel:settingsPanel};
 window.addEventListener('beforeunload',stop);
})();
