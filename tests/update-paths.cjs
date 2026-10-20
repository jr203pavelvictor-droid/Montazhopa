'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const panel=path.resolve(__dirname,'../com.victor.motionviewer'),home=fs.mkdtempSync(path.join(os.tmpdir(),'alto-paths-'));
const target=path.join(home,'Library','Application Support','Adobe','CEP','extensions','Монтажопа 3.2 #1 %20');
function manifest(folder,id='com.victor.motionviewer'){fs.mkdirSync(path.join(folder,'CSXS'),{recursive:true});fs.writeFileSync(path.join(folder,'CSXS','manifest.xml'),"<ExtensionManifest ExtensionBundleId = '"+id+"' ExtensionBundleVersion='3.2.0'/>");}
manifest(target);fs.writeFileSync(path.join(target,'original.txt'),'old panel');
const spawned=[];let denyWrite=false;
const context={process,Buffer,console,URL,window:{MZ_VERSION:'3.2.0-beta.2',location:{href:pathToFileURL(path.join(target,'index.html')).href},__adobe_cep__:{getSystemPath:()=>path.dirname(target)}}};
const fileAPI=Object.assign({},fs,{accessSync(...args){if(denyWrite){const e=Error('Permission denied');e.code='EACCES';throw e;}return fs.accessSync(...args);}});
context.require=name=>name==='os'?Object.assign({},os,{homedir:()=>home}):name==='fs'?fileAPI:name==='child_process'?{spawn(file,args){spawned.push({file,args});return {pid:987654321,on(){return this;},unref(){}};}}:require(name);
context.window.require=context.require;vm.createContext(context);
const load=name=>vm.runInContext(fs.readFileSync(path.join(panel,name),'utf8'),context,{filename:name});
try{
 load('local.js');const L=context.window.MZLocal;
 assert.equal(L.extensionPath(),fs.realpathSync(target),'Actual renderer location must beat incorrect Adobe parent path');
 assert.equal(L.extensionPath(target),fs.realpathSync(target),'Preserve literal %20 in an existing native folder');
 assert.equal(L.extensionPath(pathToFileURL(target).href),fs.realpathSync(target),'Decode a file URL exactly once');
 const encoded=pathToFileURL(target).pathname;assert.equal(L.extensionPath(encoded),fs.realpathSync(target),'Accept an encoded CEP native path');
 const wrong=path.join(home,'other-extension');manifest(wrong,'unrelated.panel');assert.throws(()=>L.extensionPath(wrong),/MZ_EXTENSION_IDENTITY/);
 assert.throws(()=>L.extensionPath(path.join(home,'missing')),/MZ_EXTENSION_PATH/);
 console.log('PASS path identity: renamed folder, spaces, Unicode, #, literal %, encoded path, file URL, renderer/native disagreement and wrong bundle');
 const zip=path.join(home,'update.zip');
 const py="import json,hashlib,zipfile,sys\nf={'CSXS/manifest.xml':b'<ExtensionManifest ExtensionBundleId=\"com.victor.motionviewer\" ExtensionBundleVersion=\"4.0.0\"/>','app.js':b'new panel'}\nm={'format':'montazhopa-update','schemaVersion':1,'bundleId':'com.victor.motionviewer','version':'4.0.0-beta.5','files':{k:hashlib.sha256(v).hexdigest() for k,v in f.items()}}\nwith zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:\n z.writestr('update-manifest.json',json.dumps(m))\n for k,v in f.items():z.writestr('com.victor.motionviewer/'+k,v)\n";
 cp.execFileSync(process.platform==='win32'?'python':'python3',['-c',py,zip]);const bytes=fs.readFileSync(zip);
 L.write('assets.json',[{name:'preserve media'}]);denyWrite=true;assert.throws(()=>L.stageUpdate(bytes,target),/MZ_EXTENSION_READ_ONLY/);denyWrite=false;
 const staged=L.stageUpdate(bytes,pathToFileURL(target).href);assert.equal(staged.target,fs.realpathSync(target));assert.equal(fs.readFileSync(path.join(target,'original.txt'),'utf8'),'old panel');
 load('update-installer.js');L.launchUpdate();assert.equal(spawned.length,1);
 const script=fs.readFileSync(spawned[0].args[spawned[0].args.length-1],'utf8');assert(script.includes('installation-backups'));assert(!script.includes(target+'.previous'));
 if(process.platform!=='win32'){
  cp.execFileSync('/bin/sh',['-n',spawned[0].args[0]]);
  const guard=script.slice(script.indexOf('while :;'),script.indexOf('[ -d "$stage" ]'));
  assert(guard.includes('/bin/ps -axww -o comm='));assert(!guard.includes('pgrep'));
  const stub=path.join(home,'process-list'),calls=path.join(home,'process-calls');
  const quoted=s=>"'"+s.replace(/'/g,"'\\''")+"'";
  const helpers='/Library/Application Support/Adobe/AdobeIPCBroker\n/Applications/Adobe Premiere Pro 2026/Adobe Premiere Pro 2026.app/Contents/MacOS/crashpad_handler';
  const probe=guard.replace('/bin/ps',quoted(stub)).replace('sleep 2',"printf 'WAIT\\n'");
  fs.writeFileSync(stub,'#!/bin/sh\n[ "$*" = "-axww -o comm=" ] || exit 9\nprintf \'%s\\n\' '+quoted(helpers)+'\n',{mode:0o700});
  assert.equal(cp.execFileSync('/bin/sh',['-c',probe],{encoding:'utf8'}),'','Orphan helpers must not delay the updater');
  fs.writeFileSync(stub,'#!/bin/sh\nif [ ! -e '+quoted(calls)+' ]; then\n : > '+quoted(calls)+'\n printf \'%s\\n\' \'/Custom Apps/Adobe Premiere Pro.app/Contents/MacOS/Adobe Premiere Pro\'\nfi\n');
  assert.equal(cp.execFileSync('/bin/sh',['-c',probe],{encoding:'utf8'}),'WAIT\n','Updater must wait until Premiere exits');
  fs.writeFileSync(stub,'#!/bin/sh\nexit 1\n');
  assert.notEqual(cp.spawnSync('/bin/sh',['-c',probe]).status,0,'Failed process queries must abort the updater');
  console.log('PASS updater process guard: orphan helpers ignored, Premiere exit awaited, query errors abort');
 }
 assert(!L.backupPath().startsWith(path.dirname(target)+path.sep),'Backups must be outside CEP discovery');
 L.updateStarted=false;manifest(L.backupPath());fs.writeFileSync(path.join(L.backupPath(),'old.txt'),'previous version');L.launchUpdate=()=>L.hasPendingUpdate().version;
 assert.equal(L.rollback(target),'previous');assert(fs.existsSync(path.join(L.hasPendingUpdate().stage,'old.txt')));
 fs.rmSync(L.backupPath(),{recursive:true});manifest(target+'.previous');fs.writeFileSync(path.join(target+'.previous','legacy.txt'),'legacy previous');
 assert.equal(L.rollback(target),'previous');assert(fs.existsSync(path.join(L.hasPendingUpdate().stage,'legacy.txt')));
 assert.equal(L.read('assets.json',[])[0].name,'preserve media');assert.equal(fs.readFileSync(path.join(target,'original.txt'),'utf8'),'old panel');
 console.log('PASS update: renamed-panel staging, read-only rejection, detached installer paths, external backup, legacy rollback and preserved user data');
}finally{fs.rmSync(home,{recursive:true,force:true});}
