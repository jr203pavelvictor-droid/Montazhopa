/* Detached update installer. Runs only after explicit user action and Premiere exit. */
(function(){
 'use strict';
 const L=window.MZLocal;if(!L.available)return;
 const req=window.require||require,fs=req('fs'),path=req('path'),child=req('child_process'),crypto=req('crypto');
 const bundle='com.victor.motionviewer',lockPath=path.join(L.root(),'updater-running.json');
 L.launchUpdate=()=>{
  if(L.updateStarted)throw Error('Update is already waiting for Premiere to close');
  const pending=L.hasPendingUpdate();if(!pending)throw Error('No staged update');
  const stage=path.resolve(pending.stage),target=L.extensionPath(pending.target),parent=path.dirname(target);
  if(path.dirname(stage)!==parent||!path.basename(stage).startsWith(bundle+'.staging-')||fs.lstatSync(stage).isSymbolicLink())throw Error('Invalid update paths');
  if(!fs.existsSync(target))throw Error('Current extension folder is missing');
  const xml=fs.readFileSync(path.join(stage,'CSXS/manifest.xml'),'utf8');
  if(!xml.includes('ExtensionBundleId="'+bundle+'"'))throw Error('Staged panel identity is invalid');
  if(pending.files){for(const name of Object.keys(pending.files)){const file=path.resolve(stage,name);if(!file.startsWith(stage+path.sep)||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==pending.files[name])throw Error('Staged files changed. Download the update again.');}}
  if(fs.existsSync(lockPath)){
   let alive=false;try{const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));if(Number.isInteger(lock.pid)&&lock.pid>0){process.kill(lock.pid,0);alive=true;}}catch(e){}
   if(alive)throw Error('An updater is already waiting for Premiere to close');
   fs.unlinkSync(lockPath);
  }
  const backup=L.backupPath(),ps=s=>"'"+s.replace(/'/g,"''")+"'",sh=s=>"'"+s.replace(/'/g,"'\\''")+"'";
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  let file,args;
  if(process.platform==='win32'){
   const script=path.join(L.root(),'apply-update.ps1');
   const text="$ErrorActionPreference='Stop'\n$target="+ps(target)+"\n$stage="+ps(stage)+"\n$backup="+ps(backup)+"\n$lock="+ps(lockPath)+"\ntry {\n while(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -like '*Premiere*'}){Start-Sleep -Seconds 2}\n if(!(Test-Path -LiteralPath $stage)){throw 'Staging folder is missing'}\n if(Test-Path -LiteralPath $backup){Remove-Item -LiteralPath $backup -Recurse -Force}\n Move-Item -LiteralPath $target -Destination $backup\n try {Move-Item -LiteralPath $stage -Destination $target} catch {if(!(Test-Path -LiteralPath $target)){Move-Item -LiteralPath $backup -Destination $target};throw}\n Write-Output 'Montazhopa update completed.'\n} catch {Write-Output $_; exit 1} finally {Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue}\n";
   fs.writeFileSync(script,'\ufeff'+text,'utf8');file='powershell.exe';args=['-NoProfile','-ExecutionPolicy','Bypass','-File',script];
  }else{
   const script=path.join(L.root(),'apply-update.command');
   // Inspect argv[0] only, never a helper's --launchedbyvulcan argument.
   // A failed process query exits before touching the installed panel.
   const waitForPremiere='while :; do\n processes="$(/bin/ps -axww -o comm=)" || exit 1\n if ! printf \'%s\\n\' "$processes" | /usr/bin/grep -Eq \'(^|/)Adobe Premiere Pro( [[:digit:]][^/]*)?$\'; then break; fi\n sleep 2\ndone\n';
   const text='#!/bin/sh\nset -eu\ntarget='+sh(target)+'\nstage='+sh(stage)+'\nbackup='+sh(backup)+'\nlock='+sh(lockPath)+'\ntrap \'rm -f -- "$lock"\' EXIT\n'+waitForPremiere+'[ -d "$stage" ] || exit 1\nrm -rf -- "$backup"\nmv -- "$target" "$backup"\nif ! mv -- "$stage" "$target"; then mv -- "$backup" "$target"; exit 1; fi\nprintf "Montazhopa update completed.\\n"\n';
   fs.writeFileSync(script,text,{mode:0o700});file='/bin/sh';args=[script];
  }
  const fd=fs.openSync(path.join(L.root(),'update.log'),'a');let proc;
  try{proc=child.spawn(file,args,{detached:true,stdio:['ignore',fd,fd],windowsHide:true});proc.on('error',e=>{L.updateStarted=false;try{fs.unlinkSync(lockPath);}catch(_){}try{fs.appendFileSync(path.join(L.root(),'update.log'),e.message+'\n');}catch(_){}if(window.MZUI)window.MZUI.error(e);});if(!proc.pid)throw Error('Could not start the update installer');fs.writeFileSync(lockPath,JSON.stringify({pid:proc.pid,created:Date.now()}));proc.unref();}finally{fs.closeSync(fd);}
  L.updateStarted=true;return pending.version;
 };
}());
