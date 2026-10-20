/* Reproduce ALTO panel's global CSS and prove Myinstants field can be typed into. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','com.victor.motionviewer');
const styles=['styles.css','styles/tokens.css','styles/components.css','glass.css','styles/layout.css','styles/liquid-controls.css','styles/approved.css','styles/myinstants.css'];
const css=styles.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const w of [300,420,880]){
   const page=await browser.newPage({viewport:{width:w,height:650}});
   await page.setContent('<!doctype html><html><head><style>'+css+'</style></head><body><main id="main" style="display:block;position:relative;overflow:visible;height:100%"><section class="panel mi-panel"><div class="mi-search"><input id="mi-test-input" type="search" placeholder="vine boom, bruh, metal pipe…"><button class="apply" id="mi-test-button">Искать</button></div></section></main></body></html>');
   const input=page.locator('#mi-test-input'),button=page.locator('#mi-test-button');
   await input.fill('vine boom');
   assert.equal(await input.inputValue(),'vine boom','Search input accepts typed text at '+w+'px');
   const ib=await input.boundingBox(),bb=await button.boundingBox();
   assert(ib&&bb,'Elements remain visible at '+w+'px');
   assert(ib.width>95,'Input is not squeezed by global .apply CSS at '+w+'px; width='+ib.width);
   assert(bb.width<=115,'Search button is compact at '+w+'px; width='+bb.width);
   assert(bb.x>=ib.x+ib.width,'Search button does not overlap field at '+w+'px');
   assert(bb.x+bb.width<=w+1,'Button stays inside viewport at '+w+'px');
   await page.close();
  }
  console.log('PASS: Myinstants search input and button layout at 300, 420 and 880px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
