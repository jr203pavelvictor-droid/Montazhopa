(() => {
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let size='420x800',page='home';
  const names={home:'Главная',catalog:'Каталог анимаций',zoom:'Motion Zoom',settings:'Настройки'};
  function shots(){$('#screenshot-grid').innerHTML=Object.entries(names).map(([key,label])=>`<figure><figcaption>${label}<span>${size.replace('x',' × ')}</span></figcaption><a href="screenshots/${key}-${size}.png" target="_blank" rel="noopener" title="Открыть оригинал"><img src="screenshots/${key}-${size}.png" alt="ALTO · ${label} · ${size}" loading="lazy"></a></figure>`).join('');}
  $$('[data-size]').forEach(button=>button.onclick=()=>{size=button.dataset.size;const [width,height]=size.split('x');$('#panel-frame').style.width=width+'px';$('#panel-frame').style.height=height+'px';$$('[data-size]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));shots();});
  $$('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page;$('#prototype').src='index.html#'+page;$('#direct-link').href='index.html#'+page;$$('[data-page]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));});
  $$('[data-mode]').forEach(button=>button.onclick=()=>{$('#live-view').hidden=button.dataset.mode!=='live';$('#screenshots-view').hidden=button.dataset.mode!=='screenshots';$('.screen-links').hidden=button.dataset.mode!=='live';$$('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));});
  shots();
})();
