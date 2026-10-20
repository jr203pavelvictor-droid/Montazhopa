/* Production ALTO theme switch; no dependencies on design-preview/preview.js or host commands. */
(function(){
 'use strict';
 var KEY='alto.visual.theme.v1',theme='dark';
 try{var saved=window.localStorage.getItem(KEY);if(saved==='dark'||saved==='light')theme=saved;}catch(e){}
 function setTheme(next){
   if(next!=='dark'&&next!=='light')return;
   theme=next;
   document.documentElement.setAttribute('data-theme',next);
   try{window.localStorage.setItem(KEY,next);}catch(e){}
   refreshControls();
 }
 function refreshControls(){
   var toggle=document.getElementById('alto-theme-toggle');
   if(toggle){
     toggle.setAttribute('aria-checked',String(theme==='light'));
     toggle.setAttribute('aria-label',theme==='light'?'Светлая тема. Переключить на графит':'Графитовая тема. Переключить на светлую');
     toggle.title=theme==='light'?'Переключить на графит':'Переключить на светлую';
   }
   var options=document.querySelectorAll('[data-alto-theme-choice]');
   for(var i=0;i<options.length;i++)options[i].setAttribute('aria-pressed',String(options[i].getAttribute('data-alto-theme-choice')===theme));
   var notice=document.getElementById('alto-theme-notice');
   if(notice)notice.textContent=theme==='dark'?'Графит · плотнее и спокойнее':'Liquid Glass · свет и прозрачность';
 }
 var moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4a8.5 8.5 0 1 0 11.4 11.4Z"/></svg>';
 var sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
 function installHeader(){
   var group=document.querySelector('.topbar .header-actions');
   if(!group||document.getElementById('alto-theme-toggle'))return;
   var toggle=document.createElement('button');
   toggle.type='button';
   toggle.id='alto-theme-toggle';
   toggle.className='alto-theme-toggle';
   toggle.setAttribute('role','switch');
   toggle.innerHTML='<span class="alto-theme-thumb" aria-hidden="true"></span><span data-alto-theme-icon="moon">'+moon+'</span><span data-alto-theme-icon="sun">'+sun+'</span>';
   toggle.addEventListener('click',function(){setTheme(theme==='dark'?'light':'dark');});
   group.insertBefore(toggle,group.firstChild);
   refreshControls();
 }
 function settingsPanel(U){
   var panel=U.panel(U.t('Оформление','Appearance')),body=U.el('div','alto-theme-choice');
   for(var choices=[['dark',U.t('Графит','Graphite'),'☾'],['light',U.t('Светлая','Light'),'☼']],i=0;i<choices.length;i++){
     var entry=choices[i],button=U.el('button'),swatch=U.el('span','alto-theme-swatch '+(entry[0]==='dark'?'graphite':'light'));
     button.type='button';button.setAttribute('data-alto-theme-choice',entry[0]);swatch.setAttribute('aria-hidden','true');swatch.textContent=entry[2];
     button.append(swatch,U.el('strong','',entry[1]));
     button.addEventListener('click',function(choice){return function(){setTheme(choice);};}(entry[0]));
     body.append(button);
   }
   panel.append(body);
   var notice=U.el('p','alto-theme-notice');notice.id='alto-theme-notice';panel.append(notice);
   panel.append(U.el('p','help-text',U.t('Тема сохраняется на этом компьютере. Переключение не меняет настройки эффектов, медиатеку и файлы Premiere.','Theme is saved on this computer. It does not change effects, media or Premiere files.')));
   refreshControls();
   return panel;
 }
 document.documentElement.setAttribute('data-theme',theme);
 installHeader();
 window.AltoThemes={setTheme:setTheme,getTheme:function(){return theme;},settingsPanel:settingsPanel,refresh:refreshControls};
})();
