'use strict';
// Execute the real shell control flow in an isolated HOME. Only macOS-specific
// ditto/defaults/ps are shimmed; no host preferences or installed CEP files.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'alto-mac-install-'));
const original=fs.readFileSync(path.resolve(__dirname,'../INSTALL_MAC.command'),'utf8');
const sh=s=>"'"+s.replace(/'/g,"'\\''")+"'";
// On the macOS runner, verify the real ps output with live harmless processes.
// The helper has a Premiere path in argv[1], exactly the false positive reported.
if(process.platform==='darwin'){
 const premiere='/Applications/Adobe Premiere Pro 2026/Adobe Premiere Pro 2026.app/Contents/MacOS/Adobe Premiere Pro 2026';
 const helper='/Library/Application Support/Adobe/AdobeIPCBroker';
 const pattern=original.match(/grep -Eq '([^']*Adobe Premiere Pro[^']*)'/)[1];
 for(const [name,expected]of [[helper,1],[premiere,0],[premiere.replace(/Adobe Premiere Pro 2026$/,'crashpad_handler'),1]]){
  const shell='/bin/bash -c '+sh('exec -a "$1" /bin/sh -c \'while :; do /bin/sleep 1; done\' "$2"')+' alto-probe '+sh(name)+' '+sh(premiere)+' &\npid=$!\ntrap \'kill "$pid" 2>/dev/null || :\' EXIT\n/bin/sleep 0.2\n/bin/ps -ww -p "$pid" -o comm=\n';
  const command=cp.execFileSync('/bin/bash',['-c',shell],{encoding:'utf8'}).trim();
  assert.equal(command,name,'macOS comm must omit helper arguments');
  assert.equal(cp.spawnSync('/usr/bin/grep',['-Eq',pattern],{input:command+'\n'}).status,expected);
 }
 console.log('PASS native macOS ps: live helper argv ignored, Premiere executable detected');
}
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function panel(folder,label,id='com.victor.motionviewer'){write(path.join(folder,'CSXS','manifest.xml'),'<ExtensionManifest ExtensionBundleId="'+id+'"/>');write(path.join(folder,'app.js'),label);}
function scenario(name,options={}){
 const base=path.join(temp,name),home=path.join(base,"Рабочий Mac's Home"),source=path.join(base,'Official Package'),system=path.join(base,'System Extensions');
 const extensions=path.join(home,'Library/Application Support/Adobe/CEP/extensions'),data=path.join(home,'Library/Application Support/Montazhopa3');
 const target=path.join(extensions,'com.victor.motionviewer'),alias=path.join(extensions,'Montazhopa 3.2'),legacy=target+'.previous',unrelated=path.join(extensions,'Other');
 panel(target,'canonical old');panel(alias,'renamed old');panel(legacy,'older old');panel(unrelated,'other extension','other.id');panel(path.join(source,'com.victor.motionviewer'),'new panel');
 write(path.join(data,'assets.json'),'personal assets');write(path.join(data,'installation-backups/com.victor.motionviewer/app.js'),'older external backup');
 const checks=['app.js','CSXS/manifest.xml'].map(name=>{const rel='com.victor.motionviewer/'+name;return crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex')+'  '+rel;}).join('\n')+'\n';
 write(path.join(source,'checksums.sha256'),checks);
 if(options.corrupt)write(path.join(source,'com.victor.motionviewer/app.js'),'corrupt');
 if(options.system)panel(path.join(system,'Legacy'),'system panel');
 const stubs=path.join(base,'stubs');
 write(path.join(stubs,'ditto'),"#!/bin/bash\nset -eu\nmkdir -p -- \"$2\"\ncp -R -- \"$1/.\" \"$2/\"\n");
 write(path.join(stubs,'defaults'),'#!/bin/sh\nexit '+(options.failDefaults?'1':'0')+'\n');
 const premiere='/Applications/Adobe Premiere Pro 2026/Adobe Premiere Pro 2026.app/Contents/MacOS/Adobe Premiere Pro 2026';
 const helpers='/Library/Application Support/Adobe/Adobe Desktop Common/IPCBox/AdobeIPCBroker.app/Contents/MacOS/AdobeIPCBroker\n/Applications/Adobe Premiere Pro 2026/Adobe Premiere Pro 2026.app/Contents/MacOS/crashpad_handler\n';
 write(path.join(stubs,'ps'),'#!/bin/sh\n[ "$*" = "-axww -o comm=" ] || exit 9\n'+(options.failQuery?'exit 1\n':"printf '%s\\n' "+sh(helpers+(options.running?(options.processName||premiere):''))+'\n'));
 for(const name of ['ditto','defaults','ps'])fs.chmodSync(path.join(stubs,name),0o700);
 let script=original.replace('mz_system_base="/Library/Application Support/Adobe/CEP/extensions"','mz_system_base='+sh(system));
 for(const name of ['ditto','defaults'])script=script.replaceAll('/usr/bin/'+name,sh(path.join(stubs,name)));
 script=script.replaceAll('/bin/ps',sh(path.join(stubs,'ps')));
 const installer=path.join(source,'INSTALL_MAC.command');write(installer,script);
 const result=cp.spawnSync('/bin/bash',[installer],{encoding:'utf8',env:Object.assign({},process.env,{HOME:home})});
 assert.equal(fs.readFileSync(path.join(data,'assets.json'),'utf8'),'personal assets');
 assert.equal(fs.readFileSync(path.join(unrelated,'app.js'),'utf8'),'other extension');
 if(options.corrupt||options.failDefaults||options.system||options.running||options.failQuery){
  assert.notEqual(result.status,0,result.stdout+result.stderr);
  if(options.running)assert.match(result.stdout,/Close Adobe Premiere Pro completely/);
  if(options.failQuery)assert.match(result.stdout,/Cannot check running applications/);
  for(const [folder,label]of [[target,'canonical old'],[alias,'renamed old'],[legacy,'older old']])assert.equal(fs.readFileSync(path.join(folder,'app.js'),'utf8'),label);
  assert.equal(fs.readFileSync(path.join(data,'installation-backups/com.victor.motionviewer/app.js'),'utf8'),'older external backup');
 }else{
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(fs.readFileSync(path.join(target,'app.js'),'utf8'),'new panel');
  assert(!fs.existsSync(alias));assert(!fs.existsSync(legacy));
  const saved=path.join(data,'installation-backups');
  assert.equal(fs.readFileSync(path.join(saved,'com.victor.motionviewer/app.js'),'utf8'),'canonical old');
  const recovery=fs.readdirSync(saved).find(n=>n.startsWith('install-'));
  for(const [name,label]of [['Montazhopa 3.2','renamed old'],['com.victor.motionviewer.previous','older old']])assert.equal(fs.readFileSync(path.join(saved,recovery,'previous',name,'app.js'),'utf8'),label);
 }
 console.log('PASS macOS installer shell: '+name);
}
try{scenario('migrate duplicates with orphan Adobe helpers');scenario('real Premiere blocks install',{running:true});scenario('unversioned Premiere blocks install',{running:true,processName:'/Custom Apps/Adobe Premiere Pro.app/Contents/MacOS/Adobe Premiere Pro'});scenario('failed process query changes no files',{failQuery:true});scenario('restore on preference failure',{failDefaults:true});scenario('checksum failure',{corrupt:true});scenario('system copy detected',{system:true});}
finally{fs.rmSync(temp,{recursive:true,force:true});}
