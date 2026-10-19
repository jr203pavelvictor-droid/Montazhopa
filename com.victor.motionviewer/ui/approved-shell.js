/* Approved design-preview shell, wired exclusively to existing actions. */
(function(){
 'use strict';
 window.AltoShell={refresh(U,A){
  document.body.dataset.screen=U.state.screen;
  if(!U.$('alto-atmosphere')){const bg=U.el('div','alto-atmosphere');bg.id='alto-atmosphere';bg.setAttribute('aria-hidden','true');bg.innerHTML='<span class="ambient-ribbon one"></span><span class="ambient-ribbon two"></span>';document.body.prepend(bg);}
  let more=U.$('more-toggle');if(!more){more=U.button('⋯',()=>{U.state.moreOpen=!U.state.moreOpen;U.$('navigation').hidden=!U.state.moreOpen;more.setAttribute('aria-expanded',String(U.state.moreOpen));},'icon');more.id='more-toggle';more.setAttribute('aria-label',U.t('Все разделы','All sections'));more.setAttribute('aria-controls','navigation');document.querySelector('.header-actions').append(more);U.$('navigation').addEventListener('click',()=>{U.state.moreOpen=false;U.$('navigation').hidden=true;},true);}
  more.setAttribute('aria-expanded',String(!!U.state.moreOpen));U.$('navigation').hidden=!U.state.moreOpen;
  const favorites=U.button(U.t('Избранное','Favorites'),()=>U.$('favorites-toggle').click());favorites.innerHTML=A.svg('star');favorites.append(U.el('span','',U.t('Избранное','Favorites')));U.$('navigation').append(favorites);
  const oldFooter=U.$('camera-action-footer');if(oldFooter)oldFooter.remove();
  if(U.state.screen==='camera'){const apply=document.querySelector('.camera-apply');if(apply){const footer=U.el('div','camera-action-footer');footer.id='camera-action-footer';apply.disabled=!!U.state.busy;footer.append(apply);document.body.append(footer);}}
  let dock=U.$('alto-dock');if(!dock){dock=U.el('nav','alto-dock');dock.id='alto-dock';dock.setAttribute('aria-label',U.t('Основная навигация','Main navigation'));document.body.append(dock);}
  dock.replaceChildren();const entries=[['home','Главная','Home','grid',()=>A.navigate('home')],['motion','Движение','Motion','motion',()=>A.navigate('motion')],['camera','Motion Zoom','Motion Zoom','camera',()=>A.openTool('camera')],['settings','Настройки','Settings','settings',()=>U.$('settings-toggle').click()]];
  for(const [key,ru,en,glyph,run]of entries){const b=U.button('',run);b.innerHTML=A.svg(glyph);b.append(U.el('span','',U.t(ru,en)));b.dataset.dock=key;const active=key==='settings'?U.state.screen==='settings':key==='camera'?U.state.screen==='camera':key==='home'?U.state.screen==='home':U.state.section==='motion'&&U.state.screen!=='camera'&&U.state.screen!=='settings';b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');dock.append(b);}
 }};
})();
