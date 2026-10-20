/* Real CEP HTML, mock Premiere; assert both themes and unchanged user data at actual panel sizes. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const {chromium}=require(process.env.MZ_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MZ_BROWSER||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']});
 try{
  const root=path.resolve(__dirname,'../com.victor.motionviewer'),out=process.env.MZ_QA_DIR||path.join(__dirname,'../test-results/ui');fs.mkdirSync(out,{recursive:true});
  const host=fixture(),page=await browser.newPage({viewport:{width:420,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('__altoHost',s=>vm.runInContext(s,host.ctx));
  await page.addInitScript(r=>{
    window.__adobe_cep__={getSystemPath:()=>r,getHostEnvironment:()=>JSON.stringify({appName:'PPRO',appVersion:'26.5'}),evalScript:(s,cb)=>window.__altoHost(s).then(cb)};
    localStorage.setItem('mz3.preferences',JSON.stringify({lang:'ru',hover:true,motion:true,transparency:true,network:false,favorites:['pop'],customField:{mustSurvive:27}}));
  },root);
  await page.goto('file://'+root+'/index.html');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert(await page.locator('#alto-theme-toggle').isVisible(),'Theme switch exists in production header');
  const original=await page.evaluate(()=>localStorage.getItem('mz3.preferences'));
  await page.locator('#alto-theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  assert.equal(await page.locator('#alto-theme-toggle').getAttribute('aria-checked'),'true');
  await page.waitForTimeout(750); // CSS transition is intentional; avoid Playwright waitForFunction under CEP's no-eval CSP.
  const bg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
  if(bg!=='rgb(234, 240, 241)'){const d=await page.evaluate(()=>({root:document.documentElement.getAttribute('data-theme'),rootVar:getComputedStyle(document.documentElement).getPropertyValue('--bg'),bodyVar:getComputedStyle(document.body).getPropertyValue('--bg'),bodyStyle:getComputedStyle(document.body).background,transition:getComputedStyle(document.body).transitionDuration,inline:document.body.getAttribute('style'),loaded:[...document.styleSheets].map(x=>x.href).filter(Boolean).slice(-5),rules:[...document.styleSheets].filter(x=>x.href&&x.href.includes('themes-runtime.css')).flatMap(x=>[...x.cssRules].filter(r=>r.selectorText&&(/body/.test(r.selectorText))).map(r=>({selector:r.selectorText,css:r.style.cssText}))).slice(0,8)}));console.error('THEME STYLE DIAGNOSTIC',JSON.stringify(d));}
  assert.equal(bg,'rgb(234, 240, 241)','Light background matches user reference after theme transition');
  assert.equal(await page.evaluate(()=>localStorage.getItem('mz3.preferences')),original,'Theme switch never overwrites Premiere preferences');
  await page.locator('#settings-toggle').click();
  assert(await page.locator('[data-alto-theme-choice=dark]').isVisible());
  assert.equal(await page.locator('[data-alto-theme-choice=light]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-alto-theme-choice=dark]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Selected theme survives panel reload');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mz3.preferences')).customField.mustSurvive),27);
  // Main catalog has no test-only code and is still backed by the current catalog.
  for(const [width,height] of [[320,700],[420,800],[600,850]]){
   await page.setViewportSize({width,height});
   await page.locator('[data-dock=motion]').click();
   assert(await page.locator('.card').count()>=1,'Real catalog cards are available');
   for(const theme of ['dark','light']){
    await page.evaluate(t=>window.AltoThemes.setTheme(t),theme);
    await page.screenshot({path:path.join(out,'alto-trial-'+theme+'-'+width+'x'+height+'.png'),fullPage:false,animations:'disabled'});
    const parts=await page.locator('#alto-theme-toggle').boundingBox();
    assert(parts&&parts.x>=0&&parts.x+parts.width<=width+1,'Theme button inside '+width+'px viewport');
    const field=await page.locator('html').getAttribute('data-theme');assert.equal(field,theme);
   }
  }
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS: ALTO graphite/light theme switch, settings, persistence, user data and real panel widths');
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
