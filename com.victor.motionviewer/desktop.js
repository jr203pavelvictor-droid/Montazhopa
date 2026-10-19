/* Montazhopa desktop adapters. No shell interpolation; user data lives outside the panel. */
(function () {
 'use strict';
 const L=window.MZLocal, api={available:L.available};
 window.MZDesktop=api;
 if(!api.available)return;
 const req=window.require||require,fs=req('fs'),path=req('path'),cp=req('child_process'),url=req('url');
 function panelRoot(){return path.dirname(url.fileURLToPath(window.location.href));}
 api.config=()=>L.read('tools.json',{python:'',ffmpeg:'',ffprobe:'',model:''});
 api.saveConfig=c=>L.write('tools.json',c);
 api.fileURL=p=>url.pathToFileURL(p).href;
 api.revealFile=p=>{
  if(!p||!fs.existsSync(p))throw Error('File is missing');
  const proc=process.platform==='win32'?cp.spawn('explorer.exe',['/select,'+path.resolve(p)],{detached:true,stdio:'ignore'}):cp.spawn(process.platform==='darwin'?'open':'xdg-open',process.platform==='darwin'?['-R',p]:[path.dirname(p)],{detached:true,stdio:'ignore'});
  proc.on('error',()=>{});proc.unref();
 };
 function executable(){
  const c=api.config(),venv=path.join(L.root(),'runtime',process.platform==='win32'?'Scripts/python.exe':'bin/python3');
  if(c.python)return {file:c.python,args:[]};
  if(fs.existsSync(venv))return {file:venv,args:[]};
  return {file:process.platform==='win32'?'py':'python3',args:process.platform==='win32'?['-3']:[]};
 }
 let running=false;
 api.runWorker=request=>new Promise((resolve,reject)=>{
  if(running)return reject(Error('Local analysis is already running'));
  running=true;
  const c=api.config(),exe=executable(),env=Object.assign({},process.env,{PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',MZ_DATA_DIR:L.root(),HF_HUB_DISABLE_TELEMETRY:'1'});
  if(c.ffmpeg)env.MZ_FFMPEG=c.ffmpeg;
  if(c.ffprobe)env.MZ_FFPROBE=c.ffprobe;
  let child,stdout='',stderr='',finished=false;
  const end=(err,result)=>{if(finished)return;finished=true;running=false;clearTimeout(timer);if(err)reject(err);else resolve(result);};
  let timer;
  try{child=cp.spawn(exe.file,exe.args.concat([path.join(panelRoot(),'worker','main.py')]),{env,windowsHide:true,stdio:['pipe','pipe','pipe']});}catch(e){running=false;return reject(e);}
  timer=setTimeout(()=>{child.kill();end(Error('Local analysis timed out (30 minutes)'));},1800000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.length>16*1024*1024){child.kill();end(Error('Analysis result is too large'));}});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-6000);});
  child.on('error',e=>end(Error('Python could not start. Open Local tools and set Python 3.11+: '+e.message)));
  child.on('close',code=>{if(finished)return;try{const out=JSON.parse(stdout);if(!out.ok)throw Error(out.error);if(code!==0)throw Error(stderr||'Local process failed');end(null,out.result);}catch(e){end(Error(e.message+(stderr?'\n'+stderr:'')));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));
 });
 api.exportPreview=async()=>{
  const player=window.MZVibeAudio.AudioPreview;
  if(!player.asset||!player.audioBuffer)throw Error('Choose and load an audio asset first');
  const c=api.config(),reverse=player.reverseCheck.checked,pitch=player.pitch;
  const dest=path.join(L.assetDir(),'processed-'+L.id()+'.wav');
  const filters=[];if(reverse)filters.push('areverse');if(pitch!==1)filters.push('rubberband=pitch='+pitch);
  const args=['-hide_banner','-loglevel','error','-nostdin','-i',player.asset.path];
  if(filters.length)args.push('-af',filters.join(','));args.push('-c:a','pcm_s16le',dest);
  await new Promise((resolve,reject)=>cp.execFile(c.ffmpeg||'ffmpeg',args,{windowsHide:true,timeout:300000,maxBuffer:1024*1024},e=>{if(e){try{fs.unlinkSync(dest);}catch(_){}reject(Error('Audio export failed. Check FFmpeg; pitch export requires the rubberband filter. '+e.message));}else resolve();}));
  const item={id:L.id(),path:dest,name:player.asset.name+(reverse?' · reverse':'')+(pitch!==1?' · pitch '+pitch:'')+' · WAV',tags:'processed',type:'audio',created:Date.now()};L.addAsset(item);return item;
 };
 // Independent XML indexer: no IronFX application code or unsafe QE index mapping.
 api.presetFiles=()=>{
  const base=process.platform==='darwin'?path.join(req('os').homedir(),'Documents','Adobe','Premiere Pro'):path.join(req('os').homedir(),'Documents','Adobe','Premiere Pro');
  const roots=L.read('preset-roots.json',[]).concat([base]);const found=[],seen=new Set();
  function walk(dir,depth){if(depth>5||found.length>=200||!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);let s;try{s=fs.lstatSync(p);}catch(e){continue;}if(s.isSymbolicLink())continue;if(s.isDirectory())walk(p,depth+1);else if(/\.prfpset$/i.test(name)&&s.size<16*1024*1024&&!seen.has(p)){found.push(p);seen.add(p);}}}
  roots.forEach(p=>walk(p,0));return found;
 };
 api.indexPresets=()=>{
  const result=[];
  for(const file of api.presetFiles()){
   let text=fs.readFileSync(file);text=text.length>2&&text[0]===255&&text[1]===254?text.slice(2).toString('utf16le'):text.toString('utf8');
   if(/<!DOCTYPE|<!ENTITY/i.test(text))continue;
   const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))continue;
   const names=new Set();Array.from(doc.querySelectorAll('TreeItem,FilterPreset')).forEach(n=>{const name=n.querySelector('Name');if(name&&name.textContent.trim())names.add(name.textContent.trim());});
   if(!names.size)names.add(path.basename(file,'.prfpset'));
   for(const name of names)result.push({name,file});
  }
  return result;
 };
 api.addPresetRoot=folder=>{if(!fs.statSync(folder).isDirectory())throw Error('Choose a folder');const roots=L.read('preset-roots.json',[]);if(!roots.includes(folder)){roots.push(folder);L.write('preset-roots.json',roots);}};
}());
