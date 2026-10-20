const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mz3-services-')),root=path.resolve(__dirname,'../com.victor.motionviewer');let requests=0;
const context={window:{MZ_VERSION:'3.0.0-beta.1'},require:n=>n==='os'?{homedir:()=>temp}:require(n),process,Buffer,fetch:()=>{requests++;throw Error('Unexpected network');}};
vm.runInNewContext(fs.readFileSync(path.join(root,'local.js'),'utf8'),context);const L=context.window.MZLocal;let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
(async()=>{
 test('Local data is separate from extension code and persists',()=>{assert(L.available);L.write('variants.json',[{name:'A'}]);assert.equal(L.read('variants.json',[])[0].name,'A');assert(L.root().startsWith(temp));assert.throws(()=>L.write('../bad.json',{}));});
 test('Synthesized WAVs have valid headers and are idempotent',()=>{const a=L.ensureSounds();assert.equal(a.length,4);assert.equal(L.ensureSounds().length,4);for(const item of a){const bytes=fs.readFileSync(item.path);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(40),bytes.length-44);assert.equal(bytes.readUInt16LE(22),1);}});
 test('Version comparison handles beta numeric components and stable versions',()=>{assert(L.compareVersion('3.0.0-beta.10','3.0.0-beta.2')>0);assert(L.compareVersion('3.0.0','3.0.0-beta.99')>0);assert.equal(L.compareVersion('3.0.0-beta.1','3.0.0-beta.1'),0);assert.throws(()=>L.compareVersion('garbage','3.0.0'));});
 test('ALTO alpha can upgrade to the planned beta and stable versions',()=>{assert(L.compareVersion('4.0.0-beta.1','4.0.0-alpha.1')>0);assert(L.compareVersion('4.0.0','4.0.0-beta.1')>0);assert(L.compareVersion('4.0.0-alpha.1','3.2.0-beta.2')>0);});
 await assert.rejects(L.checkRepository('owner/repo',false),/MZ_NETWORK_DISABLED/);assert.equal(requests,0);checks++;console.log('PASS Disabled online checks make zero requests');
 const watched=path.join(temp,'watched');fs.mkdirSync(watched);fs.writeFileSync(path.join(watched,'old.wav'),'old');L.addWatch(watched,'Bin',false);fs.writeFileSync(path.join(watched,'new.wav'),'new');let imported=[];await L.scanWatches(async p=>{imported.push(...p);return true;});assert.equal(imported.length,0);await L.scanWatches(async p=>{imported.push(...p);return true;});assert.equal(imported.length,1);assert(imported[0].endsWith('new.wav'));await L.scanWatches(async p=>{imported.push(...p);return true;});assert.equal(imported.length,1);checks++;console.log('PASS Watch folders skip existing media and wait for stable new files');
 const target=path.join(temp,'extensions','com.victor.motionviewer');fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'CSXS'));fs.writeFileSync(path.join(target,'CSXS','manifest.xml'),'<ExtensionManifest ExtensionBundleId="com.victor.motionviewer"/>');fs.writeFileSync(path.join(target,'keep.txt'),'old panel');
 cp.execFileSync(process.env.MZ_PYTHON||(process.platform==='win32'?'python':'python3'),['-c',`import zipfile,json,hashlib,pathlib
p=pathlib.Path(${JSON.stringify(temp)})
files={'CSXS/manifest.xml':b'<ExtensionManifest ExtensionBundleId="com.victor.motionviewer" ExtensionBundleVersion="3.0.0"/>','index.html':b'<html>new</html>'}
manifest={'format':'montazhopa-update','schemaVersion':1,'bundleId':'com.victor.motionviewer','version':'3.0.0-beta.2','files':{k:hashlib.sha256(v).hexdigest() for k,v in files.items()}}
for kind in ['valid','traversal','missing','corrupt']:
 with zipfile.ZipFile(p/(kind+'.zip'),'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('Montazhopa/update-manifest.json',json.dumps(manifest))
  for k,v in files.items():
   if kind=='missing' and k=='index.html':continue
   if kind=='corrupt' and k=='index.html':v=b'changed'
   z.writestr('Montazhopa/com.victor.motionviewer/'+k,v)
  if kind=='traversal':z.writestr('../outside.txt','escape')
`]);
 test('Update ZIP stages a verified new version without changing installed files',()=>{const r=L.stageUpdate(fs.readFileSync(path.join(temp,'valid.zip')),target);assert.equal(r.version,'3.0.0-beta.2');assert(fs.existsSync(path.join(r.stage,'index.html')));assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'old panel');});
 test('Traversal, missing files, changed content and old versions are rejected',()=>{for(const name of ['traversal','missing','corrupt'])assert.throws(()=>L.stageUpdate(fs.readFileSync(path.join(temp,name+'.zip')),target));context.window.MZ_VERSION='3.0.0-beta.2';assert.throws(()=>L.stageUpdate(fs.readFileSync(path.join(temp,'valid.zip')),target));assert(!fs.existsSync(path.join(temp,'outside.txt')));assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'old panel');});
 console.log(JSON.stringify({checks,status:'PASS',scope:'Local filesystem services, update validation and network-off behavior. OS update helpers are not executed.'}));
})().catch(e=>{console.error(e);process.exit(1);});
