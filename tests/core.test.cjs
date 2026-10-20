'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),panel=path.join(root,'com.victor.motionviewer');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mz-integration-'));
let now=Date.now();class TestDate extends Date{static now(){return now;}}
const context={console,Buffer,URL,process,Date:TestDate,setTimeout,clearTimeout};
context.window=context;context.require=name=>name==='os'?Object.assign({},os,{homedir:()=>temp}):require(name);
context.MZ_VERSION='3.0.0-beta.1';vm.createContext(context);
function load(file){vm.runInContext(fs.readFileSync(path.join(panel,file),'utf8'),context,{filename:file});}
load('local.js');load('update-installer.js');load('github-releases.js');load('watch-folders.js');
const L=context.MZLocal;
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(files){let at=0;const locals=[],centrals=[];for(const [name,value]of files){const n=Buffer.from(name),b=Buffer.from(value),l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(crc(b),14);l.writeUInt32LE(b.length,18);l.writeUInt32LE(b.length,22);l.writeUInt16LE(n.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc(b),16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(at,42);locals.push(l,n,b);centrals.push(c,n);at+=30+n.length+b.length;}const dir=Buffer.concat(centrals),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(files.length,8);e.writeUInt16LE(files.length,10);e.writeUInt32LE(dir.length,12);e.writeUInt32LE(at,16);return Buffer.concat([...locals,dir,e]);}
function makePackage(overrides){const files={'CSXS/manifest.xml':'<ExtensionManifest ExtensionBundleId="com.victor.motionviewer" ExtensionBundleVersion="3.1.0"/>','app.js':'test'};const m={format:'montazhopa-update',schemaVersion:1,bundleId:'com.victor.motionviewer',version:'3.1.0-beta.1',files:{}};for(const [n,b]of Object.entries(files))m.files[n]=crypto.createHash('sha256').update(b).digest('hex');if(overrides)overrides(m,files);return zip([['package/update-manifest.json',JSON.stringify(m)],...Object.entries(files).map(([n,b])=>['package/com.victor.motionviewer/'+n,b])]);}
async function main(){
 assert.equal(L.compareVersion('3.1.0-beta.10','3.1.0-beta.2'),1);
 assert.equal(L.compareVersion('3.1.0','3.1.0-beta.10'),1);
 for(const name of ['../evil','/root','C:/evil','a\\b','aux.txt','a/../b','foo./bar'])assert.throws(()=>L.readZip(zip([[name,'bad']])));
 assert.throws(()=>L.readZip(zip([['App.js','a'],['app.js','b']])));
 const corrupt=zip([['test','ABC']]);corrupt[35]^=1;assert.throws(()=>L.readZip(corrupt));
 const target=path.join(temp,'extensions','com.victor.motionviewer');fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'CSXS'));fs.writeFileSync(path.join(target,'CSXS','manifest.xml'),'<ExtensionManifest ExtensionBundleId="com.victor.motionviewer"/>');fs.writeFileSync(path.join(target,'old'),'preserve');
 assert.throws(()=>L.stageUpdate(makePackage((m,f)=>f['app.js']='modified'),target));
 assert.equal(fs.readFileSync(path.join(target,'old'),'utf8'),'preserve');
 assert.throws(()=>L.stageUpdate(makePackage(m=>m.files['missing']='0'.repeat(64)),target));
 const staged=L.stageUpdate(makePackage(),target);assert.ok(fs.existsSync(path.join(staged.stage,'app.js')));assert.equal(fs.readFileSync(path.join(target,'old'),'utf8'),'preserve');
 assert.equal(L.hasPendingUpdate().version,'3.1.0-beta.1');fs.writeFileSync(path.join(staged.stage,'app.js'),'tampered after download');assert.throws(()=>L.launchUpdate(),/Staged files changed/);fs.rmSync(staged.stage,{recursive:true});assert.equal(L.hasPendingUpdate(),null);
 // Generate (but do not execute) the detached updater and validate its shell syntax.
 const next=L.stageUpdate(makePackage(),target);let spawned;
 const realRequire=context.require;context.require=name=>name==='child_process'?{spawn:(file,args)=>{spawned={file,args};return {pid:987654321,on(){return this;},unref(){}};}}:realRequire(name);
 load('update-installer.js');assert.equal(L.launchUpdate(),'3.1.0-beta.1');assert.equal(spawned.file,process.platform==='win32'?'powershell.exe':'/bin/sh');
 if(process.platform==='win32'){
  const script=spawned.args[spawned.args.length-1];
  const parser='$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile($env:ALTO_TEST_UPDATER, [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }';
  // Inline command parses the generated text; no script runs or policy changes.
  require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-Command',parser],{windowsHide:true,env:Object.assign({},process.env,{ALTO_TEST_UPDATER:script})});
 }else require('node:child_process').execFileSync('/bin/sh',['-n',spawned.args[0]]);
 assert.throws(()=>L.launchUpdate());
 L.updateStarted=false;fs.rmSync(next.stage,{recursive:true});L.hasPendingUpdate();context.require=realRequire;
 // Release channels and package-name selection; no real network call.
 let fetched=0;context.fetch=async()=>{fetched++;return {ok:true,json:async()=>[
  {tag_name:'v3.1.0-beta.1',prerelease:true,draft:false,assets:[{name:'Montazhopa_3.1.0-beta.1.zip',browser_download_url:'https://github.com/a/b/releases/download/v3.1.0-beta.1/Montazhopa_3.1.0-beta.1.zip',size:100}]},
  {tag_name:'v3.0.1',prerelease:false,draft:false,assets:[{name:'Montazhopa_3.0.1.zip',size:100}]},
  {tag_name:'v9.0.0',prerelease:false,draft:true,assets:[{name:'Montazhopa_9.0.0.zip',size:100}]},
  {tag_name:'v8.0.0',prerelease:false,draft:false,assets:[{name:'Montazhopa_GitHub_Kit.zip',size:100}]}
 ]};};
 await assert.rejects(()=>L.checkRepository('a/b',false,true));assert.equal(fetched,0);
 assert.equal((await L.checkRepository('a/b',true,true)).version,'3.1.0-beta.1');
 assert.equal((await L.checkRepository('a/b',true,false)).version,'3.0.1');
 // A failed import must remain pending; a different project has a separate ACK history.
 const folder=path.join(temp,'media');fs.mkdirSync(path.join(folder,'sub'),{recursive:true});fs.writeFileSync(path.join(folder,'one.wav'),'audio');fs.writeFileSync(path.join(folder,'sub','two.wav'),'audio');
 L.addWatch(folder,'Montazhopa / Imports',true,true);
 let calls=[];const importer=async(paths,bin)=>{calls.push({paths,bin});return paths.filter(p=>!p.endsWith('two.wav'));};
 await L.scanWatches(importer,'project-A');now+=3000;await L.scanWatches(importer,'project-A');
 const w=L.read('watches.json',[])[0];assert.ok(w.projects['project-A']['one.wav']);assert.equal(w.projects['project-A'][path.join('sub','two.wav')],undefined);assert.ok(calls.some(c=>c.bin==='Montazhopa / Imports / sub'));
 now+=10000;await L.scanWatches(async paths=>paths,'project-A');assert.ok(L.read('watches.json',[])[0].projects['project-A'][path.join('sub','two.wav')]);
 calls=[];await L.scanWatches(importer,'project-B');now+=3000;await L.scanWatches(importer,'project-B');assert.ok(calls.some(c=>c.paths.some(p=>p.endsWith('one.wav'))));
 // Regression for the IronFX audit finding: gaps must not select a neighbor.
 const base=fs.readFileSync(path.join(panel,'jsx/base.jsx'),'utf8'),start=base.indexOf('VMV.qeClip = '),stop=base.indexOf('\nVMV.effect =',start);
 const host={VMV:{seconds:t=>t.seconds}};vm.createContext(host);vm.runInContext(base.slice(start,stop),host);
 const clip=(name,start,end)=>({type:'Clip',name,start:{seconds:start},end:{seconds:end},addVideoEffect(){}});
 const selected=clip('Selected',10,12),neighbor=clip('Unselected',0,8),items=[neighbor,{type:'Empty'},selected];
 const sequence={getVideoTrackAt:()=>({numItems:items.length,getItemAt:i=>items[i]})};
 assert.equal(host.VMV.qeClip(sequence,{trackIndex:0,name:'Selected',start:10,end:12},.04),selected);
 items.push(selected);assert.throws(()=>host.VMV.qeClip(sequence,{trackIndex:0,name:'Selected',start:10,end:12},.04));
 console.log('PASS: version/channel checks, ZIP traversal/corruption/incompleteness, staging/preservation, watcher ACK/retry/project isolation.');
}
main().then(()=>fs.rmSync(temp,{recursive:true,force:true}),e=>{console.error(e);fs.rmSync(temp,{recursive:true,force:true});process.exitCode=1;});
