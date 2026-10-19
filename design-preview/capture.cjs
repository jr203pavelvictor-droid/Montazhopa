/* Render the isolated prototype in Chromium. No production extension is loaded. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const runtime='C:/Users/08/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
let pw;try{pw=require(process.env.ALTO_PLAYWRIGHT_MODULE||'playwright');}catch{pw=require(runtime);}
const {pathToFileURL}=require('node:url');
const base=process.env.ALTO_PREVIEW_URL||pathToFileURL(path.join(__dirname,'index.html')).href;
const allowedBase=base.startsWith('file:')?new URL('.',base).href:base;
const entry=base.startsWith('file:')?base+'#home':base+'/#home';
const output=path.join(__dirname,'screenshots');
const sizes=[{width:420,height:800},{width:320,height:700},{width:600,height:850}];
const screens=['home','catalog','zoom','settings'];
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await pw.chromium.launch({headless:true,executablePath:process.env.ALTO_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking']});
  const context=await browser.newContext({viewport:sizes[0],deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400)errors.push(`${res.status()} ${res.url()}`);});
  page.on('request',r=>{if(!r.url().startsWith(allowedBase)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await page.goto(entry);await page.evaluate(()=>{localStorage.removeItem('alto.design.preview.v1');});await page.reload();await page.evaluate(()=>document.fonts.ready);
  const audit=[];
  for(const size of sizes){
    await page.setViewportSize(size);
    for(const screen of screens){
      await page.locator(`.dock [data-screen="${screen}"]`).click();
      await page.mouse.move(0,0);await page.waitForTimeout(500);
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,mainOverflow:document.querySelector('#main').scrollWidth>document.querySelector('#main').clientWidth,font:getComputedStyle(document.body).fontFamily,blur:getComputedStyle(document.querySelector('.dock')).backdropFilter,bodyScroll:document.documentElement.scrollHeight>innerHeight}));
      assert.equal(layout.overflow,false,`${screen} ${size.width}: document overflow`);
      assert.equal(layout.mainOverflow,false,`${screen} ${size.width}: main overflow`);
      assert.match(layout.font,/Montserrat/);assert.match(layout.blur,/blur/);
      await page.screenshot({path:path.join(output,`${screen}-${size.width}x${size.height}.png`),animations:'disabled'});
      audit.push({screen,...size,...layout});
    }
  }
  // Meaningful interaction checks: source capabilities, state, responsive layouts.
  await page.setViewportSize(sizes[0]);
  await page.locator('.dock [data-screen="catalog"]').click();
  assert.equal(await page.locator('.effect-card').count(),9);
  await page.locator('#catalog-search').fill('растяжение');assert.equal(await page.locator('.effect-card').count(),1);assert.match(await page.locator('.effect-card').innerText(),/Stretch/);
  await page.locator('[data-category="transitions"]').click();assert.equal(await page.locator('.effect-card').count(),3);
  await page.locator('[data-category="motion"]').click();
  await page.locator('[data-favorite="rotate"]').click();
  await page.locator('.dock [data-screen="home"]').click();assert.match(await page.locator('.favorite-list').innerText(),/Rotate/);
  await page.locator('.favorite-list [data-favorite="rotate"]').click();
  await page.locator('.dock [data-screen="zoom"]').click();
  await page.getByRole('button',{name:'Подключить выделенный слой',exact:true}).click();assert.match(await page.locator('#dialog-content').innerText(),/Adjustment Layer/);assert.match(await page.locator('#dialog-content').innerText(),/Построить анимацию/);await page.keyboard.press('Escape');assert.equal(await page.locator('#layer-status').innerText(),'Слой не подключён');
  await page.locator('#zoom-scale-number').fill('225');await page.locator('#zoom-scale-number').press('Tab');assert.equal(await page.locator('#zoom-scale').inputValue(),'225');
  await page.locator('#zoom-easing').selectOption('easeOut');
  const frame=await page.locator('#frame').boundingBox();
  await page.locator('.point[data-point="1"]').hover();await page.mouse.down();await page.mouse.move(frame.x+frame.width*.7,frame.y+frame.height*.4,{steps:5});await page.mouse.up();assert.match(await page.locator('.inspector-heading').innerText(),/X 70%/);
  await page.locator('#route-play').click();await page.waitForTimeout(350);assert(Number(await page.locator('#route-scrub').inputValue())>0);await page.locator('#route-play').click();
  await page.locator('#add-point').click();assert.equal(await page.locator('.point').count(),4);
  await page.locator('.zoom-advanced summary').click();await page.locator('#delete-point').click();assert.equal(await page.locator('.point').count(),3);
  await page.locator('.dock [data-screen="settings"]').click();
  await page.locator('#settings-glass').uncheck();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('no-glass')),true);await page.locator('#settings-glass').check();
  await page.locator('#settings-motion').uncheck();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('no-motion')),true);await page.locator('#settings-motion').check();
  await page.locator('#settings-language').selectOption('en');assert.match(await page.locator('h1').innerText(),/Settings/);await page.locator('#settings-language').selectOption('ru');
  await page.keyboard.press('Control+k');assert.equal(await page.locator('#detail-dialog').evaluate(e=>e.open),true);await page.locator('#global-search-input').fill('Pop');assert.equal(await page.locator('.search-result').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('#detail-dialog').evaluate(e=>e.open),false);
  assert.deepEqual(errors,[],'Browser errors');assert.deepEqual(requests,[],'Unexpected external requests');
  // The review wrapper must work with a local file and preserve exact iframe sizes.
  await page.goto(pathToFileURL(path.join(__dirname,'review.html')).href);
  await page.setViewportSize({width:1440,height:1050});
  for(const size of sizes){await page.locator(`[data-size="${size.width}x${size.height}"]`).click();await page.waitForTimeout(450);const box=await page.locator('#prototype').boundingBox();assert.equal(Math.round(box.width),size.width);assert.equal(Math.round(box.height),size.height);}
  await page.locator('[data-mode="screenshots"]').click();assert.equal(await page.locator('.screenshot-grid img').count(),4);
  for(const size of sizes){
    const file=path.join(output,`overview-${size.width}x${size.height}.html`);
    const labels={home:'01 / Главная',catalog:'02 / Каталог анимаций',zoom:'03 / Motion Zoom',settings:'04 / Настройки'};
    fs.writeFileSync(file,`<!doctype html><html lang="ru"><meta charset="utf-8"><title>ALTO · ${size.width}×${size.height}</title><style>@font-face{font-family:Montserrat;src:url('../assets/fonts/Montserrat-500.woff')}*{box-sizing:border-box}body{margin:0;background:#111925;color:#dce7fa;font-family:Montserrat,sans-serif;padding:22px 20px 20px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:19px;font-size:13px}header span{font-size:10px;color:#99abc3}.grid{display:flex;gap:14px}figure{margin:0;width:${size.width}px}figcaption{margin:0 0 12px;font-size:11px;color:#adbed7}img{display:block;width:${size.width}px;height:${size.height}px;outline:1px solid #d0e2ff26}</style><header><strong>ALTO 4.0 / Liquid Glass</strong><span>${size.width} × ${size.height} · настоящий HTML/CSS · Chromium · 1:1</span></header><div class="grid">${screens.map(screen=>`<figure><figcaption>${labels[screen]}</figcaption><img src="${screen}-${size.width}x${size.height}.png" alt="${labels[screen]}"></figure>`).join('')}</div></html>`);
    await page.setViewportSize({width:size.width*4+82,height:size.height+107});
    await page.goto(pathToFileURL(file).href);await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(output,`overview-${size.width}x${size.height}.png`),fullPage:true});
  }
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({capturedAt:new Date().toISOString(),renderer:await browser.version(),screenshots:12,audit,checks:['No horizontal overflow at all 12 screen/viewport pairs','Local Montserrat and CSS backdrop blur','9 animations / 3 transitions / RU search','Favorites add/remove','Adjustment Layer connection button explains binding and applying without claiming a live connection','Motion Zoom: numeric scale, easing, dragging, playback, add/remove point','Glass and animation preferences','RU/EN language menu','Ctrl K search and Escape dismissal','No browser errors or external requests'],errors,externalRequests:requests},null,2));
  console.log(`Saved 12 screenshots; layout and interaction checks passed. Browser: ${await browser.version()}`);
  await browser.close();
})().catch(err=>{console.error(err);process.exit(1);});
