'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {fixture,clip}=require('./fixture.cjs');
let pw;try{pw=require(process.env.MZ_PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('C:/Users/08/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.MZ_BROWSER||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)}),context=await browser.newContext({viewport:{width:420,height:800}}),page=await context.newPage();
 const root=path.resolve(__dirname,'../com.victor.motionviewer'),output=process.env.MZ_QA_DIR||path.resolve(__dirname,'../test-results/production');fs.mkdirSync(output,{recursive:true});const errors=[];
 let f=fixture([clip('Adjustment Layer',0,12,{adjustment:true,inPoint:0})]);page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__host',script=>vm.runInContext(script,f.ctx));
 await page.addInitScript(root=>{window.__adobe_cep__={getSystemPath:()=>root,getHostEnvironment:()=>JSON.stringify({appName:'PPRO',appVersion:'26.5'}),evalScript:(s,cb)=>window.__host(s).then(cb)};localStorage.setItem('mz3.preferences',JSON.stringify({lang:'ru',favorites:['photo','pop','move'],hover:true,motion:true,network:false}));},root);
 // Real CEP mixed-context also exposes CommonJS globals to renderer scripts.
 await page.addInitScript(()=>{window.module={exports:{}};window.exports=window.module.exports;});
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
 async function nav(section){await page.locator('#more-toggle').click();await page.locator(`[data-section="${section}"]`).click();}
 const audit=[];
 for(const width of [300,420,600,960]){await page.setViewportSize({width,height:width===300?700:850});for(const screen of ['home','motion','camera','settings']){
  if(screen==='camera')await page.locator('[data-dock="camera"]').click();else if(screen==='settings')await page.locator('[data-dock="settings"]').click();else await page.locator(`[data-dock="${screen}"]`).click();
  await page.waitForTimeout(150);await page.mouse.move(0,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${screen}`);
  assert.equal(await page.locator('#main').evaluate(e=>e.scrollWidth>e.clientWidth),false,`${width} ${screen} main`);
  for(const button of await page.locator('#alto-dock button').all()){const r=await button.boundingBox();assert(r.x>=0&&r.x+r.width<=width+1);}
  if(screen==='camera'){const r=await page.locator('#camera-action-footer .camera-apply').boundingBox(),dock=await page.locator('#alto-dock').boundingBox();assert(r&&r.x>=0&&r.x+r.width<=width+1&&r.y+r.height<=dock.y,'Apply must stay visible above navigation');}
  await page.screenshot({path:path.join(output,`alto-${screen}-${width}.png`),animations:'disabled'});audit.push({width,screen});
 }}
 await page.setViewportSize({width:420,height:800});await page.locator('[data-dock="camera"]').click();
 assert(await page.getByRole('button',{name:'Подключить выделенный слой',exact:true}).isVisible());assert(await page.locator('#capture-timeline-frame').isVisible());
 await page.locator('#cam-mode').selectOption('easeOut');await page.locator('#cam-move-value').fill('1.2');await page.locator('#cam-move-value').press('Tab');
 const values=await page.evaluate(()=>MZDebug.getCamera().stops.map(p=>p.transition&&p.transition.move));assert.equal(values[1],1.2);assert.equal(values[2],.45);
 await page.locator('.point-details summary').click();await page.getByRole('button',{name:'Дублировать точку',exact:true}).click();await page.locator('.point-details summary').click();assert.equal(await page.locator('.stop-row').count(),5);await page.getByRole('button',{name:'Удалить точку',exact:true}).click();assert.equal(await page.locator('.stop-row').count(),4);
 await page.locator('.stop-row').nth(1).locator('.stop-number').dragTo(page.locator('.stop-row').nth(2));assert.equal(await page.evaluate(()=>MZDebug.state.cameraIndex),2);
 const frame=await page.locator('#camera-map').boundingBox();await page.locator('#camera-map').click({position:{x:frame.width*.7,y:frame.height*.4}});assert(Math.abs(await page.evaluate(()=>MZDebug.getCamera().stops[MZDebug.state.cameraIndex].fx)-.7)<.02);
 for(const section of ['assets','sounds','tools','automation']){await nav(section);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.locator('[data-dock="settings"]').click();await page.locator('#settings-lang').selectOption('en');assert.equal(await page.locator('[data-dock="home"]').innerText(),'Home');await page.locator('#settings-lang').selectOption('ru');
 const before=f.mutations();
 await page.evaluate(()=>{const p=MZVibeAudio.AudioPreview,c=new AudioContext(),b=c.createBuffer(2,16000,8000);b.getChannelData(1).fill(.5);p.loadToken=(p.loadToken||0)+1;p.audioCtx=c;p.audioBuffer=b;p.asset={id:'qa-audio',name:'QA stereo'};p.waveformData={bars:[.1,.5,1,.5],duration:2};p.el.classList.remove('hidden');p.el.classList.add('visible');p.el.style.display='flex';document.body.classList.add('audio-preview-open');p.resizeCanvas();p.selectRange(.2,1.8);});
 await page.locator('.audio-range-controls input[aria-label="Fade In"]').fill('.2');await page.locator('.audio-range-controls input[aria-label="Fade In"]').press('Tab');
 const canvas=await page.locator('#audioTimelineCanvas').boundingBox();await page.keyboard.down('Shift');await page.mouse.move(canvas.x+canvas.width*.25,canvas.y+canvas.height/2);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.75,canvas.y+canvas.height/2,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
 const range=await page.evaluate(()=>MZVibeAudio.AudioPreview.range);assert(Math.abs(range.in-.5)<.04&&Math.abs(range.out-1.5)<.04);
 await page.locator('#audioReplayBtn').click();assert(await page.evaluate(()=>MZVibeAudio.AudioPreview.isPlaying));
 // Playwright 1.51 waitForFunction uses eval in Chromium 134; keep panel CSP intact.
 for(let attempt=0;attempt<100&&await page.evaluate(()=>MZVibeAudio.AudioPreview.isPlaying);attempt++)await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>MZVibeAudio.AudioPreview.isPlaying),false);const stopped=await page.evaluate(()=>MZVibeAudio.AudioPreview.lastPausePosition);assert(Math.abs(stopped-1.5)<.04);
 await page.screenshot({path:path.join(output,'alto-audio-excerpt-420.png')});
 await page.locator('#audioPreviewClose').click();assert.equal(f.mutations(),before,'Preview and range editing must never write to Premiere');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'ui-verification.json'),JSON.stringify({audit,errors,scope:'Actual Chromium DOM + mocked Premiere host; no live Premiere render'},null,2));await browser.close();console.log('PASS approved shell: 16 real screenshots, visible Apply, all legacy sections, flight independence, point drag/order, duplicate/delete, RU/EN, real Web Audio range audition.');
})().catch(e=>{console.error(e);process.exit(1);});
