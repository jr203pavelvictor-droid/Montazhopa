'use strict';
// Real panel HTML, mock Premiere: Memes is one click away (dock), YouTube and GIPHY flows insert at the playhead.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {fixture,clip}=require('./fixture.cjs');
let pw;try{pw=require(process.env.MZ_PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('C:/Users/08/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.MZ_BROWSER||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 const root=path.resolve(__dirname,'../com.victor.motionviewer'),output=process.env.MZ_QA_DIR||path.resolve(__dirname,'../test-results/memes');fs.mkdirSync(output,{recursive:true});
 try{
  for(const width of [300,420]){
   const page=await (await browser.newContext({viewport:{width,height:640}})).newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
   const f=fixture([clip('Talk',0,30,{inPoint:0})]);f.ctx.MZ.insertMeme=function(){calls.push([...arguments]);return f.ctx.VMV.encode({ok:true,video:2,audio:arguments[3]?2:0,seconds:3});};
   await page.exposeFunction('__host',s=>vm.runInContext(s,f.ctx));
   await page.addInitScript(root=>{window.__adobe_cep__={getSystemPath:()=>root,getHostEnvironment:()=>JSON.stringify({appName:'PPRO',appVersion:'26.5'}),evalScript:(s,cb)=>window.__host(s).then(cb)};localStorage.setItem('mz3.preferences',JSON.stringify({lang:'ru',favorites:[],hover:true,motion:true,network:false}));},root);
   await page.addInitScript(()=>{window.module={exports:{}};window.exports=window.module.exports;});
   await page.goto(pathToFileURL(path.join(root,'index.html')).href);
   // Desktop pieces (Node fs, ALTO storage, yt-dlp, GIPHY HTTP) are replaced by fakes; the panel code is real.
   await page.evaluate(()=>{const store={},added=[];window.__added=added;window.require=n=>({path:{join:(...a)=>a.join('/')},fs:{mkdirSync(){},existsSync:()=>true},url:{URL,URLSearchParams}})[n];
    Object.assign(window.MZLocal,{available:true,read:(k,d)=>k in store?store[k]:d,write:(k,v)=>{store[k]=v;},assetDir:()=>'/alto/assets',id:()=>'id'+added.length,addAsset:x=>added.push(x)});
    window.AltoDownloaderCore=()=>({search:async q=>{window.__ytQuery=q;return [{id:'abcdefghijk',title:'Недоумение мем',duration:7,url:'https://www.youtube.com/watch?v=abcdefghijk',thumb:'assets/previews/landscape.svg'},{id:'bcdefghijkl',title:'Long reaction',duration:185,url:'https://www.youtube.com/watch?v=bcdefghijkl',thumb:'assets/previews/landscape.svg'}];},download:async(u,dir,o)=>{window.__ytDownload=o;return [dir+'/'+o.mediaTitle+'.mp4'];}});
    window.AltoMemesClient.search=async(q,key)=>{window.__giphy=[q,key];return [{id:'abc123',title:'Confused',preview:'',mp4:'https://media.giphy.com/media/abc123/giphy.mp4'}];};window.AltoMemesClient.download=async(item,dir)=>dir+'/'+item.title+'.mp4';});
   await page.locator('[data-dock="memes"]').click();assert.match(await page.locator('#main h2').first().innerText(),/Мемы/);
   assert.equal(await page.evaluate(()=>document.querySelector('#alto-dock').scrollWidth<=document.querySelector('#alto-dock').clientWidth+1),true,'dock fits '+width);
   // YouTube: emotion chip → results → to timeline (video + sound)
   await page.locator('.meme-emotions').getByRole('button',{name:'Недоумение',exact:true}).click();await page.locator('.meme-card').first().waitFor();
   assert.equal(await page.evaluate(()=>window.__ytQuery),'недоумение мем');assert.equal(await page.locator('.meme-card').count(),2);
   await page.locator('.meme-card').first().getByRole('button',{name:'＋ На таймлайн'}).click();for(let i=0;i<30&&!calls.length;i++)await page.waitForTimeout(100);
   assert.equal(calls.length,1);assert.equal(calls[0][3],true,'YouTube insert carries sound');assert.match(await page.locator('.mi-message').innerText(),/На таймлайне: Недоумение мем · V2 \/ A2/);
   assert.equal(await page.evaluate(()=>window.__added.length),1,'added to My media');
   // A long clip asks which piece to take
   await page.locator('.meme-card').nth(1).getByRole('button',{name:'＋ На таймлайн'}).click();await page.locator('#modal:not([hidden])').waitFor();await page.locator('#meme-start').fill('1:01.5');await page.locator('#meme-length').fill('4');
   await page.locator('#modal-actions').getByRole('button',{name:'Взять',exact:true}).click();for(let i=0;i<30&&calls.length<2;i++)await page.waitForTimeout(100);
   assert.deepEqual(await page.evaluate(()=>window.__ytDownload.section),{start:61.5,end:65.5});
   if(width===420)await page.screenshot({path:path.join(output,'memes-youtube-420.png')});
   // GIPHY: key once, then search and insert without sound
   await page.locator('[data-meme-source="giphy"]').click();assert(await page.locator('#giphy-key').isVisible());await page.locator('#giphy-key').fill('abcdefghijklmnopqrstuvwxyz123456');await page.getByRole('button',{name:'Сохранить ключ',exact:true}).click();
   await page.locator('.meme-emotions').getByRole('button',{name:'Шок',exact:true}).click();await page.locator('.meme-card').first().waitFor();assert.deepEqual(await page.evaluate(()=>window.__giphy),['shocked','abcdefghijklmnopqrstuvwxyz123456']);
   await page.locator('.meme-card').first().getByRole('button',{name:'＋ На таймлайн'}).click();for(let i=0;i<30&&calls.length<3;i++)await page.waitForTimeout(100);assert.equal(calls[2][3],false,'GIPHY insert has no sound');
   assert(await page.locator('.meme-credit').isVisible(),'GIPHY attribution');
   // Sounds tab hosts Myinstants; Tools and Home list Memes
   await page.locator('[data-meme-tab="sounds"]').click();assert(await page.locator('#main').getByText('Myinstants').first().isVisible());
   await page.locator('#more-toggle').click();await page.locator('[data-section="tools"]').click();assert(await page.locator('#main').getByText('Мемы: вставки и звуки').isVisible());
   await page.locator('[data-dock="home"]').click();assert(await page.locator('#main').getByText('Мемы',{exact:true}).first().isVisible());
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS Memes: dock entry, YouTube with sound and piece picker, GIPHY key and insert, sounds tab, tools and home at 300 and 420px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
