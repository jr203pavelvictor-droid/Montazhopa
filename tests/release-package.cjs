/* Stage the actual distributable and prepare rollback in a private workspace.
   No installed extension or native installer is executed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),panel=path.join(repo,'com.victor.motionviewer'),version=require('../version.json').version;
const archive=path.resolve(process.argv[2]||path.join(repo,'dist','Montazhopa_'+version+'.zip')),bytes=fs.readFileSync(archive);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fs.readFileSync(archive+'.sha256','utf8').trim().split(/\s+/)[0]);
fs.mkdirSync(path.join(repo,'test-results'),{recursive:true});const home=fs.mkdtempSync(path.join(repo,'test-results','package-'));
const context={window:{MZ_VERSION:'4.0.0-beta.1'},require:name=>name==='os'?Object.assign({},os,{homedir:()=>home}):require(name),process,Buffer,console};
vm.runInNewContext(fs.readFileSync(path.join(panel,'local.js'),'utf8'),context);const L=context.window.MZLocal;
const target=path.join(home,'extensions','com.victor.motionviewer');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'previous.txt'),'original panel');
L.write('assets.json',[{id:'preserved',path:'/original/audio.wav'}]);L.write('variants.json',[{name:'Keep me'}]);L.write('watches.json',[{folder:'/original/watch',history:{keep:true}}]);
const saved=Object.fromEntries(['assets.json','variants.json','watches.json'].map(n=>[n,JSON.stringify(L.read(n))]));
const result=L.stageUpdate(bytes,target);assert.equal(result.version,version);assert.equal(fs.readFileSync(path.join(target,'previous.txt'),'utf8'),'original panel');
for(const file of ['timeline-model.js','ui/motion-zoom.js','ui/audio-range.js','ui/silence-review.js','jsx/host.bundle.jsx','styles/approved.css'])assert(fs.existsSync(path.join(result.stage,file)),file);
const backup=target+'.previous';fs.mkdirSync(path.join(backup,'CSXS'),{recursive:true});fs.writeFileSync(path.join(backup,'CSXS','manifest.xml'),'<ExtensionManifest ExtensionBundleId="com.victor.motionviewer"/>');fs.writeFileSync(path.join(backup,'previous.txt'),'original panel');
let launches=0;L.launchUpdate=()=>{launches++;const pending=L.hasPendingUpdate();assert.equal(pending.version,'previous');assert.equal(fs.readFileSync(path.join(pending.stage,'previous.txt'),'utf8'),'original panel');return pending.version;};
assert.equal(L.rollback(target),'previous');assert.equal(launches,1);
for(const [name,value]of Object.entries(saved))assert.equal(JSON.stringify(L.read(name)),value,name);
assert.equal(fs.readFileSync(path.join(target,'previous.txt'),'utf8'),'original panel');
console.log('PASS actual ZIP SHA/CRC/manifest/runtime staging, unchanged panel and user data, prepared previous-version rollback (native helper mocked).');
