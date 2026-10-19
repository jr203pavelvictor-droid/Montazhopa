'use strict';
// CEP --mixed-context exposes both window and CommonJS globals to script tags.
// A plain Chromium preview cannot catch a Node-only export that hides the UI API.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const file=path.resolve(__dirname,'../com.victor.motionviewer/ui/audio-range.js');
const source=fs.readFileSync(file,'utf8');
for(const mixed of [false,true]){
 const context={window:{}};
 if(mixed){context.module={exports:{}};context.exports=context.module.exports;context.require=createRequire(file);context.window.require=context.require;context.process=process;context.Buffer=Buffer;}
 vm.runInNewContext(source,context,{filename:file});
 assert.equal(typeof context.window.AltoAudio,'object',mixed?'CEP mixed context must register the renderer API':'Browser preview must register the renderer API');
 assert.equal(typeof context.window.AltoAudio.init,'function');
 if(mixed)assert.equal(typeof context.module.exports.encode,'function','CommonJS export must coexist with the renderer API');
}
const audio=require(file);
assert.equal(typeof audio.encode,'function','Node audio encoder tests must remain supported without a DOM');
console.log('PASS audio startup: browser, CEP mixed-context and Node-only exports');

// Catch syntax newer than CEP 10's Chromium 74 before release packaging.
const parser={exports:{}};
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{module:parser,exports:parser.exports});
const root=path.resolve(__dirname,'../com.victor.motionviewer');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=Array.from(html.matchAll(/<script src="([^"]+)"/g),m=>m[1]);
assert.equal(scripts[0],'startup.js','Startup error capture must precede application scripts');
for(const script of scripts)parser.exports.parse(fs.readFileSync(path.join(root,script),'utf8'),{ecmaVersion:2019});
console.log('PASS renderer script syntax: ES2019 baseline ('+scripts.length+' scripts)');

function startup(){
 const events={},nodes={};
 function element(){return {style:{},setAttribute(){},appendChild(child){child.parentNode=this;if(child.id)nodes[child.id]=child;},removeChild(child){delete nodes[child.id];}};}
 const document={body:element(),createElement:element,getElementById:id=>nodes[id]||null,addEventListener:(name,fn)=>events[name]=fn};
 const window={addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(root,'startup.js'),'utf8'),{window,document});
 return {events,nodes,window};
}
let boot=startup();
boot.events.error({message:'Audio registration failed',error:{stack:'TypeError: Audio registration failed\nui/audio-range.js:19'}});
assert(boot.nodes['alto-startup-error'],'Startup exception must produce visible diagnostics');
assert.match(boot.window.AltoStartup.error(),/audio-range.js:19/);
boot.events.error({message:'Secondary failure'});
assert.match(boot.window.AltoStartup.error(),/Audio registration failed/,'Preserve the first error');
boot.window.AltoStartup.ready();assert(!boot.nodes['alto-startup-error']);
boot.events.error({message:'Later operation error'});assert(!boot.nodes['alto-startup-error'],'Do not replace a working UI on later action errors');
boot=startup();boot.events.error({target:{tagName:'SCRIPT',src:'file:///panel/app.js'}});assert.match(boot.window.AltoStartup.error(),/app.js/);
boot=startup();boot.events.load();assert(boot.nodes['alto-startup-error'],'Incomplete initialization must not silently leave a blank panel');
boot=startup();boot.window.AltoStartup.ready();boot.events.load();assert(!boot.nodes['alto-startup-error']);
console.log('PASS startup diagnostics: first exception, missing script, incomplete load and successful startup');
