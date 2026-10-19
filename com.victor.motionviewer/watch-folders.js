/* Montazhopa watcher: stable writes, recursive folders, project-specific ACK/retry.
 * Independent implementation informed by the SheepDog audit; no upstream code copied. */
(function(){
 'use strict';
 const L=window.MZLocal;if(!L.available)return;
 const fs=(window.require||require)('fs'),path=(window.require||require)('path');
 const media=/\.(mp4|mov|mxf|avi|mkv|wav|mp3|aif|aiff|aac|m4a|png|jpg|jpeg|webp|psd|tif|tiff)$/i;
 let scanning=false;const pending=new Map();
 function listFiles(root,recursive){
  const out=[];
  function walk(dir,depth){if(depth>8||out.length>=10000)return;for(const name of fs.readdirSync(dir)){
   if(out.length>=10000)break;if(name[0]==='.'||/\.(tmp|part|download)$/i.test(name))continue;
   const p=path.join(dir,name);let s;try{s=fs.lstatSync(p);}catch(e){continue;}if(s.isSymbolicLink())continue;
   if(s.isDirectory()){if(recursive)walk(p,depth+1);}else if(s.isFile()&&s.size&&media.test(name))out.push({p,relative:path.relative(root,p),sign:s.size+':'+s.mtimeMs});
  }}walk(root,0);return out;
 }
 L.addWatch=(folder,bin,includeExisting,recursive)=>{
  if(!fs.statSync(folder).isDirectory())throw Error('Choose a folder');
  const items=L.read('watches.json',[]);if(items.some(w=>path.resolve(w.folder)===path.resolve(folder)))throw Error('Folder already watched');
  const baseline={};if(!includeExisting)listFiles(folder,recursive).forEach(f=>baseline[f.relative]=f.sign);
  items.push({id:L.id(),folder:path.resolve(folder),bin:bin||'Montazhopa / Imports',enabled:true,recursive:!!recursive,baseline,projects:{},lastError:''});L.write('watches.json',items);
 };
 L.scanWatches=async(importFn,projectKey)=>{
  if(scanning||!projectKey)return;scanning=true;
  try{
   const items=L.read('watches.json',[]);let modified=false;
   for(const w of items){
    if(!w.enabled)continue;
    try{
     if(!fs.existsSync(w.folder))throw Error('Watched folder is unavailable');
     w.projects=w.projects||{};const seen=w.projects[projectKey]||(w.projects[projectKey]=Object.assign({},w.baseline||w.seen||{}));
     let cache=pending.get(w.id+'|'+projectKey);if(!cache){cache={};pending.set(w.id+'|'+projectKey,cache);}
     const groups={};let total=0;
     for(const f of listFiles(w.folder,w.recursive)){
      if(seen[f.relative]===f.sign)continue;
      let old=cache[f.relative];if(!old||old.sign!==f.sign){cache[f.relative]={sign:f.sign,since:Date.now(),tries:0,retry:0};continue;}
      if(Date.now()-old.since<2000||old.retry>Date.now())continue;
      const sub=path.dirname(f.relative),bin=w.bin+(sub==='.'?'':' / '+sub.split(path.sep).join(' / '));
      (groups[bin]||(groups[bin]=[])).push(f);if(++total>=30)break;
     }
     for(const bin of Object.keys(groups)){
      const files=groups[bin],result=await importFn(files.map(f=>f.p),bin);
      const accepted=new Set(Array.isArray(result)?result:result===true?files.map(f=>f.p):[]);
      for(const f of files){if(accepted.has(f.p)){seen[f.relative]=f.sign;delete cache[f.relative];modified=true;}
       else{const entry=cache[f.relative];entry.tries++;entry.retry=Date.now()+Math.min(60000,2000*Math.pow(2,entry.tries));w.lastError='Import will retry: '+path.basename(f.p);modified=true;}}
      if(accepted.size===files.length){w.lastError='';modified=true;}
     }
    }catch(e){w.lastError=e.message;modified=true;}
   }
   if(modified){const latest=L.read('watches.json',[]);for(const w of latest){const scanned=items.find(x=>x.id===w.id);if(scanned){w.projects=scanned.projects;w.lastError=scanned.lastError;}}L.write('watches.json',latest);}
  }finally{scanning=false;}
 };
}());
