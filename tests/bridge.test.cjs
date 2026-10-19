'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const createBridge=require('../com.victor.motionviewer/host-bridge.js');
const panel=path.resolve(__dirname,'../com.victor.motionviewer'),bundle=fs.readFileSync(path.join(panel,'jsx/host.bundle.jsx'),'utf8');
const version=require('../version.json').version;
function hostFixture(options={}){
 const root="C:/Users/Виктор/O'Brien/Adobe/CEP/extensions/com.victor.motionviewer",expected=root+'/jsx/host.bundle.jsx';
 let loads=0,evals=0,missing=!!options.missing;
 const native={console,JSON,app:{},counter:0};vm.createContext(native);
 function File(name){if(!(this instanceof File))return new File(name);this.fsName=String(name);this.exists=!missing&&this.fsName===expected;this.parent={fsName:path.posix.dirname(this.fsName)};}
 native.File=File;native.$={fileName:'/unrelated/engine.js',evalFile:file=>{assert.equal(file.fsName,expected);loads++;vm.runInContext(bundle,native,{filename:expected});}};
 const win={MZ_VERSION:version,require:name=>name==='path'?path.win32:name==='os'?{platform:()=> 'win32'}:require(name),__adobe_cep__:{getSystemPath:()=>'/'+root,evalScript:(source,cb)=>{evals++;try{cb(vm.runInContext(source,native));}catch(e){cb('evalScript error.');}}}};
 return {api:createBridge(win),win,native,loads:()=>loads,evals:()=>evals,setMissing:value=>missing=value};
}
async function run(){
 assert.ok(!bundle.includes('#include '));assert.ok(!bundle.includes('$.evalFile('));
 const f=hostFixture();assert.equal(f.api.bundlePath(),"C:/Users/Виктор/O'Brien/Adobe/CEP/extensions/com.victor.motionviewer/jsx/host.bundle.jsx");
 const health=await f.api.ensure();assert.equal(health.version,version);assert.ok(health.methods.includes('MZ.projectContext'));assert.equal(f.loads(),1);
 await f.api.ensure();assert.equal(f.loads(),1);assert.equal((await f.api.call('MZ.health')).version,version);
 vm.runInContext('MZ.testFailure=function(){var e=new Error("Readable host failure");e.line=123;e.fileName="clip-test.jsx";throw e;};',f.native);
 await assert.rejects(()=>f.api.call('MZ.testFailure'),/Readable host failure[\s\S]*clip-test.jsx:123/);
 vm.runInContext('MZ.testMutate=function(){counter++;return "evalScript error.";};',f.native);
 await assert.rejects(()=>f.api.call('MZ.testMutate'),/Premiere не вернул JSON[\s\S]*evalScript error/);assert.equal(f.native.counter,1,'Never retry a mutating command');
 const before=f.evals();await assert.rejects(()=>f.api.call('MZ.health;evil'),/Invalid Premiere method/);assert.equal(f.evals(),before);
 for(const raw of ['evalScript error.','undefined','', 'not json'])assert.throws(()=>f.api.parse(raw,'test'),/Premiere не вернул JSON/);
 const missing=hostFixture({missing:true});await assert.rejects(()=>missing.api.ensure(),/JSX bundle is missing/);missing.setMissing(false);assert.equal((await missing.api.ensure()).version,version);
 // Manifest-loaded bundle: the bootstrap only checks health, without reloading it.
 const preloaded=hostFixture();vm.runInContext(bundle,preloaded.native);await preloaded.api.ensure();assert.equal(preloaded.loads(),0);
 console.log('PASS: one-file JSX bootstrap, wrong $.fileName, Windows drive/Unicode/quote paths, health, raw replies, host exception details, no mutation retry, recovery after missing file.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
