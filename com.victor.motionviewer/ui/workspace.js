/* ALTO navigation/search state. Legacy preferences, favorites and library schemas are unchanged. */
(function () {
  'use strict';
  let U, A, activeKey = '', previousContext = '', timer, writing = false;
  const sections = ['home','motion','assets','sounds','tools','automation'];
  const empty = () => ({schema:1, pins:[], recent:[], scroll:{}, drafts:{}, context:{}});
  let data = empty();
  function persist() {
    clearTimeout(timer);
    if (writing) return;
    try {
      if (window.MZLocal.available) window.MZLocal.write('alto-workspace.json',data);
      else localStorage.setItem('alto4.workspace',JSON.stringify(data));
    } catch (e) { U.status('Не удалось сохранить контекст интерфейса.','Could not save workspace context.',true,e.message); }
  }
  function schedule() { clearTimeout(timer); timer=setTimeout(persist,180); }
  function load() {
    try {
      const raw=window.MZLocal.available?window.MZLocal.read('alto-workspace.json',null):JSON.parse(localStorage.getItem('alto4.workspace')||'null');
      if(raw && raw.schema===1) {
        data=Object.assign(empty(),raw);
        data.pins=Array.isArray(raw.pins)?raw.pins.filter(x=>typeof x==='string').slice(0,8):[];
        data.recent=Array.isArray(raw.recent)?raw.recent.filter(x=>typeof x==='string').slice(0,12):[];
        for(const key of ['scroll','drafts','context'])if(!raw[key]||typeof raw[key]!=='object'||Array.isArray(raw[key]))data[key]={};
      } else if(raw) writing=true; // Unknown future schema must never be overwritten by this version.
    } catch(e) { writing=true; }
  }
  function key() { const s=U.state;return !U.$('search-wrap').hidden?'search':s.screen+':'+s.section+':'+(s.screen==='catalog'?s.category:s.screen==='detail'?s.selected:''); }
  function beforeRender() { if(activeKey)data.scroll[activeKey]=U.$('main').scrollTop;const context=U.state.section+':'+U.state.screen;if(previousContext&&previousContext!==context){const p=window.MZVibeAudio&&window.MZVibeAudio.AudioPreview;if(p&&p.el)p.hide();}previousContext=context; }
  function capture() {
    const s=U.state;
    data.context={section:s.section,screen:s.screen,category:s.category,assetsFilter:s.assetsFilter,selected:s.selected,searchFilter:s.searchFilter};
    if(s.screen==='detail'&&s.selected)data.drafts[s.selected]=Object.assign({},s.opts);
    const c=A.camera();
    data.camera={stops:c.stops,options:c.options,index:s.cameraIndex};
    schedule();
  }
  function afterRender() {
    activeKey=key();U.$('main').scrollTop=Number(data.scroll[activeKey])||0;
    const s=U.state;
    const names={home:U.t('Главная','Home'),motion:U.t('Движение','Motion'),assets:U.t('Библиотека','Library'),sounds:U.t('Звук','Sounds'),tools:U.t('Инструменты','Tools'),automation:U.t('Сценарии','Workflows')};
    const label=s.query.trim()?U.t('Поиск','Search'):s.screen==='settings'?U.t('Настройки','Settings'):s.screen==='camera'?'Motion Zoom':s.screen==='detail'?(window.MZCatalog.find(x=>x.id===s.selected)||{}).title:s.screen==='favorites'?U.t('Избранное','Favorites'):names[s.section];
    U.$('context-label').textContent=label||names[s.section]||'ALTO';
    document.title='ALTO 4.0 · '+U.$('context-label').textContent;
    U.$('main').setAttribute('aria-label',U.$('context-label').textContent);
    for(const b of U.$('navigation').querySelectorAll('button'))b.setAttribute('aria-current',b.classList.contains('active')?'page':'false');
    capture();
  }
  function remember(id) { data.recent=[id].concat(data.recent.filter(x=>x!==id)).slice(0,12);schedule(); }
  function isPinned(item) { return item.type==='tool'||item.type==='macro'?data.pins.includes(item.id):U.preferences.favorites.includes(item.sourceID); }
  function togglePin(item) {
    if(item.type==='tool'||item.type==='macro') {
      const i=data.pins.indexOf(item.id);
      if(i>=0)data.pins.splice(i,1);
      else if(data.pins.length<8)data.pins.push(item.id);
      else {U.status('Можно закрепить до восьми команд.','You can pin up to eight commands.');return;}
      schedule();
    } else A.favorite(item.sourceID);
    U.render();
  }
  function items() {
    const L=window.MZLocal,C=window.MZCatalog,lang=U.preferences.lang==='ru'?0:1;
    const list=C.map(c=>({id:'preset:'+c.id,sourceID:c.id,type:'preset',name:c.title,subtitle:U.t(c.ru,c.en),group:U.t('Движение','Motion'),tags:c.title+' '+c.ru+' '+c.en+' '+c.tags,icon:c.id==='camera'?'camera':'motion',open:()=>A.openTool(c.id)}));
    for(const v of L.read('variants.json',[])) {
      const c=C.find(x=>x.id===v.kind);if(!c)continue;
      list.push({id:'variant:'+v.id,sourceID:v.id,type:'preset',name:v.name,subtitle:U.t('Свой вариант','Custom preset')+' · '+c.title,group:U.t('Движение','Motion'),tags:v.name+' '+c.tags,icon:'save',open:()=>A.openTool(c.id,v)});
    }
    const keywords={cut:'silence remove cut тишина паузы',captions:'transcription subtitles субтитры речь',sync:'sync synchronize alignment синхронизация',watch:'watch folder auto import папки автоимпорт',macro:'automation batch макрос сценарий',photo:'image picture фото',duplicate:'backup copy копия',localtools:'python ffmpeg whisper local doctor диагностика'};
    for(const d of A.tools)list.push({id:'tool:'+d[0],type:'tool',name:d[1+lang],subtitle:d[3+lang],group:U.t('Инструменты','Tools'),tags:d.slice(1,5).join(' ')+' '+(keywords[d[0]]||''),icon:d[5],open:()=>{A.navigate('tools');A.openWorkflow(d[0]);}});
    for(const x of L.read('assets.json',[]))list.push({id:'asset:'+x.id,sourceID:x.id,type:'asset',name:x.name,subtitle:x.type==='audio'?U.t('Прослушать звук','Listen to sound'):U.t('Показать в библиотеке','Show in library'),group:U.t('Библиотека','Library'),tags:x.name+' '+(x.tags||'')+' '+x.type,icon:x.type==='audio'?'sound':'assets',open:()=>{U.state.assetsFilter='all';A.navigate(x.type==='audio'?'sounds':'assets');if(x.type==='audio')A.playAudio(x);else{const card=U.$('main').querySelector('[data-asset-id="'+String(x.id).replace(/[^a-zA-Z0-9_-]/g,'')+'"]');if(card){card.scrollIntoView({block:'center'});const b=card.querySelector('button');if(b)b.focus();}}}});
    for(const m of L.read('macros.json',[]))list.push({id:'macro:'+m.id,type:'macro',name:m.name,subtitle:U.t('Открыть сценарий','Review workflow'),group:U.t('Сценарии','Workflows'),tags:m.name+' workflow macro сценарий',icon:'motion',open:()=>A.reviewMacro(m)});
    return list;
  }
  function row(item) {
    const r=U.el('div','command-row search-result');r.dataset.resultId=item.id;
    const open=U.button('',()=>{remember(item.id);U.state.query='';U.$('search').value='';U.$('search-wrap').hidden=true;item.open();},'command-open');
    const symbol=U.el('span','command-symbol');symbol.innerHTML=A.svg(item.icon);
    const copy=U.el('span','command-copy');copy.append(U.el('strong','',item.name),U.el('small','',item.subtitle));
    open.append(symbol,copy);r.append(open,A.icon('star',isPinned(item)?U.t('Убрать из избранного','Remove favorite'):U.t('В избранное','Favorite'),()=>togglePin(item),isPinned(item)?'saved':''));return r;
  }
  function heading(ru,en) {const h=U.el('div','row');h.append(U.el('h3','',U.t(ru,en)));return h;}
  function home() {
    const m=U.$('main'),hero=U.el('section','home-hero');
    hero.append(U.el('p','eyebrow','ALTO / WORKSPACE'),U.el('h2','',U.t('Меньше действий. Больше монтажа.','Less friction. More editing.')),U.el('p','',U.t('Движение, материалы и инструменты — под рукой.','Motion, media and your everyday tools, within reach.')));
    const quick=U.el('div','quick-actions');
    for(const [ru,en,fn]of [['Движение','Motion',()=>A.navigate('motion')],['Motion Zoom','Motion Zoom',()=>A.openTool('camera')],['Добавить файлы','Add files',()=>U.$('asset-files').click()]])quick.append(U.button(U.t(ru,en),fn));hero.append(quick);m.append(hero);
    const all=items(),columns=U.el('div','home-columns'),pinned=U.el('section','home-section'),recent=U.el('section','home-section');
    const ph=heading('Быстрый доступ','Quick access');ph.append(U.button(U.t('Все инструменты','All tools'),()=>A.navigate('tools'),'reference-link'));pinned.append(ph);
    const picks=data.pins.map(id=>all.find(x=>x.id===id)).filter(Boolean).concat(all.filter(x=>x.type!=='tool'&&x.type!=='macro'&&isPinned(x)));for(const x of picks.slice(0,8))pinned.append(row(x));
    if(!picks.length){for(const id of ['tool:cut','tool:captions','tool:sync']){const x=all.find(x=>x.id===id);if(x)pinned.append(row(x));}pinned.append(U.el('p','help-text',U.t('Нажми звезду, чтобы закрепить свою команду.','Star a command to pin it here.')));}
    recent.append(heading('Недавно открытые','Recently opened'));for(const id of data.recent.slice(0,6)){const x=all.find(x=>x.id===id);if(x)recent.append(row(x));}
    if(recent.children.length===1)recent.append(U.el('div','empty',U.t('Здесь появятся открытые пресеты и команды.','Presets and commands you open will appear here.')));
    columns.append(pinned,recent);m.append(columns);
  }
  function search(favorites) {
    const m=U.$('main'),q=U.state.query.trim().toLowerCase(),head=U.el('div','search-heading');head.append(U.el('h2','',favorites?U.t('Избранное','Favorites'):U.t('Поиск','Search')),U.el('p','help-text',U.t('Пресеты, материалы и команды. Установленные эффекты — в поиске Premiere.','Presets, media and commands. Find installed effects in Premiere effect search.')));m.append(head);
    const filters=U.el('div','chips search-filters');
    for(const [k,ru,en] of [['all','Все разделы','All sections'],['preset','Движение','Motion'],['asset','Материалы','Media'],['tool','Инструменты','Tools'],['macro','Сценарии','Workflows']]){
      const b=U.button(U.t(ru,en),()=>{U.state.searchFilter=k;U.render();});b.classList.toggle('active',(U.state.searchFilter||'all')===k);filters.append(b);
    }
    m.append(filters);let found=items().filter(x=>(!favorites||isPinned(x))&&(!q||x.tags.toLowerCase().includes(q)||x.name.toLowerCase().includes(q))&&(!U.state.searchFilter||U.state.searchFilter==='all'||x.type===U.state.searchFilter));
    m.append(U.el('p','section-note',found.length+U.t(' результатов',' results')));
    for(const x of found.slice(0,100))m.append(row(x));
    if(found.length>100)m.append(U.el('p','help-text',U.t('Показаны первые 100. Уточни запрос.','Showing the first 100. Refine your search.')));
    if(!found.length)m.append(U.el('div','empty',U.t('Ничего не найдено. Попробуй другое название или тег.','No matches. Try another name or tag.')));
  }
  function automation() {
    const m=U.$('main');m.append(U.topHeading('Сценарии','Workflows'),U.el('p','help-text',U.t('Сохранённые последовательности действий. Перед запуском можно проверить шаги.','Saved action sequences. Review the steps before running.')));
    const add=U.button(U.t('Создать сценарий','Create workflow'),A.createMacro,'primary');add.style.margin='14px 0';m.append(add);
    const list=items().filter(x=>x.type==='macro');for(const x of list)m.append(row(x));if(!list.length)m.append(U.el('div','empty',U.t('Создай сценарий из доступных действий Premiere.','Create a workflow from the available Premiere actions.')));
  }
  function restore() {
    const s=U.state,c=data.context;
    if(sections.includes(c.section)){s.section=c.section;s.screen=c.section==='motion'?'catalog':c.section;}
    if(['motion','transitions','effects','camera'].includes(c.category))s.category=c.category;
    if(['all','preset','asset','tool','macro'].includes(c.searchFilter))s.searchFilter=c.searchFilter;
    if(['all','image','audio','video','mogrt','fragment'].includes(c.assetsFilter))s.assetsFilter=c.assetsFilter;
    if(c.screen==='camera')s.screen='camera';
    if(c.screen==='detail'&&window.MZCatalog.some(x=>x.id===c.selected&&x.id!=='camera')){s.screen='detail';s.selected=c.selected;s.opts=Object.assign(A.toolDefaults(c.selected),window.MZEngine.options(data.drafts[c.selected]));}
    // Host binding and media snapshots are intentionally reconnected explicitly.
    if(data.camera)A.restoreCamera(data.camera);
  }
  function init(ui,api) {
    U=ui;A=api;load();restore();
    U.$('main').addEventListener('scroll',()=>{if(activeKey){data.scroll[activeKey]=U.$('main').scrollTop;schedule();}},{passive:true});
    U.$('main').addEventListener('input',capture);
    U.$('main').addEventListener('change',capture);
    window.addEventListener('beforeunload',()=>{capture();persist();});
  }
  window.AltoWorkspace={init,beforeRender,afterRender,home,search,automation,remember,draft:id=>data.drafts[id],capture};
}());
