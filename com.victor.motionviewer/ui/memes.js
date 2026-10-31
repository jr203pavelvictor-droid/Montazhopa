/* Memes: reaction inserts (GIPHY without sound, YouTube with sound) and meme sounds
   (Myinstants) in one place. Search by word or emotion, preview, and put the pick
   at the playhead on a free track. Everything downloaded also lands in My media. */
(function(){
 'use strict';
 const L=()=>window.MZLocal,C=()=>window.AltoMemesClient;
 let downloader=null;
 function req(name){return (window.require||require)(name);}
 function settings(){try{return Object.assign({giphyKey:'',fit:true},L().read('memes-settings.json',{}));}catch(_){return {giphyKey:'',fit:true};}}
 function saveSettings(v){L().write('memes-settings.json',v);}
 function folder(){const path=req('path'),dir=path.join(L().assetDir(),'memes');req('fs').mkdirSync(dir,{recursive:true});return dir;}
 function core(){if(!downloader)downloader=window.AltoDownloaderCore({fs:req('fs'),path:req('path'),os:req('os'),cp:req('child_process'),https:req('https'),crypto:req('crypto'),root:req('path').join(L().assetDir(),'downloader-engine')});return downloader;}
 function engine(){const c=L().read('downloader-settings.json',{});return {engine:c.engine||'',ffmpeg:c.ffmpeg||''};}
 function open(url){try{if(window.cep&&window.cep.util&&window.cep.util.openURLInDefaultBrowser)window.cep.util.openURLInDefaultBrowser(url);else window.open(url,'_blank','noopener');}catch(_){}}
 function clock(sec){sec=Math.max(0,Math.round(sec||0));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
 function parseClock(v){const m=String(v||'').trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);return m?(Number(m[1]||0)*60+Number(m[2].replace(',','.'))):NaN;}
 function register(file,title,source,query){try{const path=req('path'),items=L().read('assets.json',[]);if(items.some(x=>x.path===file))return;L().addAsset({id:L().id(),name:title,path:file,type:'video',tags:'meme '+source+' '+(query||''),created:Date.now()});}catch(_){}}

 window.AltoMemes={render(U){
  const {el,button,panel,t,state:s}=U,main=U.$('main');
  s.memeTab=s.memeTab||'inserts';s.memeSource=s.memeSource||'youtube';s.memeResults=s.memeResults||{giphy:[],youtube:[]};s.memeFiles=s.memeFiles||{};
  main.append(U.topHeading('Мемы','Memes'));
  const tabs=el('div','chips meme-tabs');for(const [k,ru,en]of [['inserts','Вставки','Inserts'],['sounds','Звуки','Sounds']]){const b=button(t(ru,en),()=>{if(s.memeTab==='sounds'&&window.AltoMyinstants)window.AltoMyinstants.stop();s.memeTab=k;U.render();});b.classList.toggle('active',s.memeTab===k);b.dataset.memeTab=k;tabs.append(b);}main.append(tabs);
  if(s.memeTab==='sounds'){window.AltoMyinstants.render(U,()=>{s.memeTab='inserts';U.render();});return;}
  if(!L()||!L().available){main.append(el('div','empty',t('Мемы работают в панели внутри Premiere.','Memes work in the panel inside Premiere.')));return;}
  const cfg=settings();
  const sources=el('div','chips meme-sources');for(const [k,ru,en]of [['youtube','YouTube · со звуком','YouTube · with sound'],['giphy','GIPHY · гифки','GIPHY · GIFs']]){const b=button(t(ru,en),()=>{s.memeSource=k;s.memeError='';U.render();});b.classList.toggle('active',s.memeSource===k);b.dataset.memeSource=k;sources.append(b);}main.append(sources);
  const giphy=s.memeSource==='giphy';
  if(giphy&&!cfg.giphyKey){
   const key=panel(t('Ключ GIPHY (один раз, бесплатно)','GIPHY key (once, free)'));key.classList.add('meme-key');
   key.append(el('p','help-text',t('1. Открой сайт GIPHY для разработчиков и войди. 2. Create an App → API → дай имя, например ALTO. 3. Скопируй API Key и вставь сюда. Бесплатно до 100 поисков в час.','1. Open GIPHY Developers and sign in. 2. Create an App → API → name it, e.g. ALTO. 3. Copy the API Key and paste it here. Free up to 100 searches per hour.')));
   const input=el('input');input.type='text';input.id='giphy-key';input.placeholder='API Key';input.autocomplete='off';
   const row=el('div','button-row');row.append(button(t('Открыть GIPHY ↗','Open GIPHY ↗'),()=>open('https://developers.giphy.com/dashboard/')),button(t('Сохранить ключ','Save key'),()=>{try{C().searchUrl('test',input.value);cfg.giphyKey=input.value.trim();saveSettings(cfg);U.render();}catch(e){U.error(e);}},'apply'));
   key.append(input,row);main.append(key);return;
  }
  const box=panel(),form=el('div','mi-search'),input=el('input');box.classList.add('meme-search');
  input.type='search';input.id='meme-query';input.placeholder=t('Слово или эмоция: шок, кринж, «что?»…','A word or emotion: shock, cringe, "what?"…');input.value=s.memeQuery||'';input.maxLength=giphy?50:100;
  input.oninput=()=>{s.memeQuery=input.value;s.memeChip=null;};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run();}};
  const go=button(t('Искать','Search'),()=>run(),'apply');go.disabled=!!s.memeLoading;form.append(input,go);box.append(form);
  const chips=el('div','chips meme-emotions');C().EMOTIONS.forEach((e,i)=>{const b=button(e[0],()=>{s.memeChip=i;s.memeQuery=e[0];run();});b.classList.toggle('active',s.memeChip===i);chips.append(b);});box.append(chips);
  const fit=el('label','check'),fitInput=el('input');fitInput.type='checkbox';fitInput.checked=cfg.fit!==false;fitInput.onchange=()=>{cfg.fit=fitInput.checked;saveSettings(cfg);};fit.append(fitInput,document.createTextNode(t('Вписывать вставку в кадр','Fit the insert to the frame')));box.append(fit);
  main.append(box);
  if(s.memeLoading)main.append(el('p','mi-message',t('Ищу…','Searching…')));
  if(s.memeMessage)main.append(el('p','mi-message',s.memeMessage));
  if(s.memeError)main.append(el('p','mi-error',s.memeError));
  const results=s.memeResults[s.memeSource]||[],grid=el('div','meme-grid');
  for(const item of results){
   const card=el('article','meme-card'),media=el('div','meme-media');card.dataset.meme=item.id;
   if(giphy){const v=el('video');v.src=item.preview;v.muted=true;v.loop=true;v.autoplay=true;v.playsInline=true;v.preload='metadata';media.append(v);}
   else{const img=el('img');img.src=item.thumb;img.alt='';img.loading='lazy';media.append(img,el('span','meme-duration',item.duration?clock(item.duration):''));media.title=t('Открыть на YouTube','Open on YouTube');media.onclick=()=>open(item.url);}
   const actions=el('div','meme-actions'),place=button(t('＋ На таймлайн','＋ To timeline'),()=>insert(item),'apply'),save=button('↓',()=>fetch(item).then(f=>{if(f){s.memeMessage=t('Сохранено в «Мои материалы»: ','Saved to My media: ')+item.title;U.render();}}).catch(e=>{s.memeError=message(e);U.render();}));
   save.title=t('Только скачать в «Мои материалы»','Download to My media only');place.disabled=save.disabled=!!s.busy;actions.append(place,save);
   card.append(media,el('p','meme-title',item.title),actions);grid.append(card);
  }
  if(results.length)main.append(grid);
  if(giphy){const credit=el('p','meme-credit','Powered by GIPHY');main.append(credit);const change=button(t('Сменить ключ GIPHY','Change GIPHY key'),()=>{cfg.giphyKey='';saveSettings(cfg);U.render();},'reference-link');main.append(change);}
  else main.append(el('p','help-text',t('Клипы длиннее минуты ALTO спросит, какой кусок взять. Вырезает FFmpeg — он у тебя есть рядом с yt-dlp.','For clips over a minute ALTO asks which piece to take. FFmpeg does the cut.')));

  function message(e){const code=String(e&&e.message||e);const map={MZ_GIPHY_KEY:t('Ключ GIPHY не подходит. Нажми «Сменить ключ GIPHY» и вставь его заново.','The GIPHY key does not work. Change it and paste it again.'),MZ_GIPHY_LIMIT:t('Лимит GIPHY: 100 поисков в час. Подожди или ищи на YouTube.','GIPHY limit: 100 searches per hour. Wait or use YouTube.')};return map[code]||code;}
  async function run(){
   const chip=s.memeChip!=null?C().EMOTIONS[s.memeChip]:null,q=chip?(giphy?chip[1]:chip[2]):String(s.memeQuery||'').trim();if(!q)return;
   s.memeLoading=true;s.memeError='';s.memeMessage='';U.render();
   try{s.memeResults[s.memeSource]=giphy?await C().search(q,cfg.giphyKey,{limit:24}):await core().search(giphy?q:(chip?q:q+' мем'),12,engine());s.memeMessage=t('Найдено: ','Found: ')+s.memeResults[s.memeSource].length;}
   catch(e){s.memeError=message(e);}finally{s.memeLoading=false;U.render();}
  }
  async function section(item){
   if(giphy||!item.duration||item.duration<=60)return null;
   return new Promise(resolve=>{const body=el('div'),start=el('input'),length=el('input');start.id='meme-start';start.value='0:00';length.id='meme-length';length.type='number';length.min='1';length.max='60';length.value='5';
    const a=el('label','field-row');a.append(document.createTextNode(t('С какого момента (мин:сек)','From (min:sec)')),start);const b=el('label','field-row');b.append(document.createTextNode(t('Длина, сек','Length, s')),length);
    body.append(el('p','help-text',item.title+' · '+clock(item.duration)),a,b);
    U.modal(t('Какой кусок взять?','Which piece?'),body,[{label:t('Отмена','Cancel'),run:()=>{U.closeModal();resolve(false);}},{label:t('Взять','Take'),primary:true,run:()=>{const from=parseClock(start.value),len=Math.min(60,Math.max(.5,Number(length.value)||5));if(!isFinite(from)||from>=item.duration){start.focus();return;}U.closeModal();resolve({start:from,end:Math.min(item.duration,from+len)});}}]);});
  }
  async function fetch(item,cut){
   const key=s.memeSource+':'+item.id+(cut?':'+cut.start+'-'+cut.end:'');if(s.memeFiles[key]&&req('fs').existsSync(s.memeFiles[key]))return s.memeFiles[key];
   s.memeMessage=t('Скачиваю ','Downloading ')+item.title+'…';s.memeError='';U.render();
   let file;
   if(giphy)file=await C().download(item,folder());
   else{const files=await core().download(item.url,folder(),Object.assign(engine(),{mode:'720',mediaId:item.id,mediaTitle:item.title,section:cut||null}));file=files&&files[0];}
   if(!file)throw Error(t('Файл не скачался','The file did not download'));
   register(file,item.title,s.memeSource,s.memeQuery);s.memeFiles[key]=file;return file;
  }
  async function insert(item){
   const cut=await section(item);if(cut===false)return;
   await U.operation(async()=>{try{const file=await fetch(item,cut);const r=await U.host('MZ.insertMeme',[file,(U.preferences.videoTrack||1)-1,(U.preferences.audioTrack||1)-1,!giphy,cfg.fit!==false]);
    s.memeMessage=t('На таймлайне: ','On the timeline: ')+item.title+' · V'+r.video+(r.audio>0?' / A'+r.audio:'');s.memeError='';}catch(e){s.memeError=message(e);s.memeMessage='';}U.render();});
  }
 }};
})();
