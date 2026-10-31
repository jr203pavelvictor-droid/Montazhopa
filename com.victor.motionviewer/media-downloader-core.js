/* ALTO Media Downloader — yt-dlp process integration.
   Uses the real upstream extractor. No site-specific allowlist and no shell commands.
   No process is started or downloaded without user action. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  if(root)root.AltoDownloaderCore=factory;
})(typeof window==='undefined'?this:window,function createDownloader(deps){
  'use strict';
  var fs=deps.fs,path=deps.path,os=deps.os,cp=deps.cp,https=deps.https,crypto=deps.crypto;
  var platform=deps.platform||process.platform, root=deps.root||path.join(os.homedir(),'.alto-downloader');
  var running=null, installing=false, env=deps.env||process.env;
  // FFmpeg merges the best video with its audio and converts to MP3. Use the one
  // chosen in settings, else one beside the engine (Stacher keeps ffmpeg-*/bin next
  // to its yt-dlp), else the first on PATH. Empty string: none on this computer.
  function findFfmpeg(options){
    options=options||{};if(options.ffmpeg)return String(options.ffmpeg);
    var exe=platform==='win32'?'ffmpeg.exe':'ffmpeg',dirs=[],i;
    function isFile(p){try{return fs.statSync(p).isFile();}catch(_){return false;}}
    var engine=options.engine||(isFile(managedPath())?managedPath():'');
    if(engine){var base=path.dirname(String(engine));dirs.push(base);try{var names=fs.readdirSync(base);for(i=0;i<names.length&&i<200;i++)if(/^ffmpeg/i.test(names[i]))dirs.push(path.join(base,names[i],'bin'),path.join(base,names[i]));}catch(_){}}
    var parts=String(env.PATH||env.Path||'').split(path.delimiter);for(i=0;i<parts.length&&i<200;i++)if(parts[i])dirs.push(parts[i]);
    for(i=0;i<dirs.length;i++){var candidate=path.join(dirs[i],exe);if(isFile(candidate))return candidate;}
    return '';
  }
  function ensureDir(dir){if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw Error('Папка не существует: '+dir);return dir;}
  function url(v){var u;try{u=new URL(String(v||'').trim());}catch(_){throw Error('Некорректная ссылка');}if(u.protocol!=='https:'&&u.protocol!=='http:')throw Error('Ссылка должна начинаться с http:// или https://');return u.href;}
  function binaryName(){return platform==='win32'?'yt-dlp.exe':platform==='darwin'?'yt-dlp_macos':'yt-dlp';}
  function managedPath(){return path.join(root,'bin',platform==='win32'?'yt-dlp.exe':'yt-dlp');}
  function resolve(config){
    var paths=[config&&config.engine,managedPath()].filter(Boolean);
    for(var p of paths)try{if(fs.statSync(p).isFile())return p;}catch(_){}
    return 'yt-dlp'; // PATH lookup by spawn, no shell
  }
  function get(urlStr,limit,redirects){
    redirects=redirects||0;
    if(redirects>7)return Promise.reject(Error('Too many redirects'));
    var parsed=new URL(urlStr);
    if(parsed.protocol!=='https:'||!/(^|\.)github\.com$|(^|\.)githubusercontent\.com$/.test(parsed.hostname))return Promise.reject(Error('Unexpected engine download host'));
    return new Promise(function(resolve,reject){
      var request=https.get(urlStr,{headers:{'User-Agent':'ALTO-Premiere/4.0','Accept':'application/vnd.github+json'}},function(response){
        if([301,302,303,307,308].includes(response.statusCode)){
          response.resume();if(!response.headers.location)return reject(Error('Missing redirect location'));
          get(new URL(response.headers.location,urlStr).href,limit,redirects+1).then(resolve,reject);return;
        }
        if(response.statusCode!==200){response.resume();return reject(Error('GitHub HTTP '+response.statusCode));}
        var pieces=[],received=0;
        response.on('data',function(chunk){received+=chunk.length;if(received>limit){request.destroy(Error('Download exceeds allowed executable size'));return;}pieces.push(chunk);});
        response.on('end',function(){resolve(Buffer.concat(pieces));});response.on('error',reject);
      });request.on('error',reject);request.setTimeout(30000,function(){request.destroy(Error('Network timeout'));});
    });
  }
  async function install(onProgress){
    if(installing||running)throw Error('Операция уже выполняется');
    installing=true;
    try{
      if(onProgress)onProgress('Получаю последнюю версию с GitHub…');
      var response=await get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',3*1024*1024);
      var release=JSON.parse(response.toString('utf8'));
      if(!release.assets||!Array.isArray(release.assets))throw Error('GitHub release metadata unavailable');
      var name=binaryName(),asset=release.assets.find(function(a){return a.name===name;});
      if(!asset||!asset.browser_download_url||!/^\d/.test(release.tag_name||''))throw Error('No compatible official release asset');
      var expected=asset.digest&&/^sha256:[a-f0-9]{64}$/i.test(asset.digest)?asset.digest.slice(7).toLowerCase():'';
      if(!expected){
        var checks=release.assets.find(function(a){return a.name==='SHA2-256SUMS';});
        if(!checks)throw Error('SHA256 checksums missing. Refusing unverified executable');
        var sums=(await get(checks.browser_download_url,2*1024*1024)).toString('utf8');
        var escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        var match=sums.match(new RegExp('(?:^|\\n)([a-fA-F0-9]{64})\\s+\\*?'+escaped+'(?:\\r?\\n|$)'));
        if(!match)throw Error('SHA256 for '+name+' not available');expected=match[1].toLowerCase();
      }
      if(onProgress)onProgress('Скачиваю yt-dlp '+release.tag_name+'…');
      var content=await get(asset.browser_download_url,120*1024*1024);
      var actual=crypto.createHash('sha256').update(content).digest('hex');
      if(expected!==actual)throw Error('Контрольная сумма yt-dlp не совпала!');
      var dir=path.dirname(managedPath());fs.mkdirSync(dir,{recursive:true});
      var tmp=managedPath()+'.part-'+process.pid;
      try{
        fs.writeFileSync(tmp,content,{flag:'wx',mode:0o700});if(platform!=='win32')fs.chmodSync(tmp,0o700);
        try{fs.unlinkSync(managedPath());}catch(e){if(e.code!=='ENOENT')throw e;}
        fs.renameSync(tmp,managedPath());
      }catch(e){try{fs.unlinkSync(tmp);}catch(_){}throw e;}
      if(onProgress)onProgress('yt-dlp '+release.tag_name+' установлен (SHA-256 проверен).');
      return {path:managedPath(),version:release.tag_name,sha256:actual};
    }finally{installing=false;}
  }
  function spawn(args,config,onLine){
    if(running)throw Error('Уже выполняется загрузка / анализ');
    return new Promise(function(resolve,reject){
      var stdout='',stderr='',done=false,proc;
      try{proc=cp.spawn(resolveEngine(config),args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:process.env});}catch(e){reject(e);return;}
      running=proc;
      function finish(err,result){if(done)return;done=true;if(running===proc)running=null;err?reject(err):resolve(result);}
      proc.on('error',function(e){finish(Error('Не удалось запустить yt-dlp. Установи движок или укажи его путь. '+e.message));});
      function receive(which,data){
        var field=which==='out'?'stdout':'stderr';var str=data.toString('utf8');
        if(which==='out'){stdout+=str;if(stdout.length>16*1024*1024){proc.kill();finish(Error('yt-dlp metadata too large'));return;}}
        else{stderr+=str;if(stderr.length>512000)stderr=stderr.slice(-256000);}
        if(onLine){var chunks=(which==='out'?outbuf:errbuf)+str;var lines=chunks.split(/[\r\n]+/);if(which==='out')outbuf=lines.pop();else errbuf=lines.pop();for(var line of lines)if(line)onLine(line,which);}
      }
      var outbuf='',errbuf='';
      proc.stdout.on('data',function(d){receive('out',d);});proc.stderr.on('data',function(d){receive('err',d);});
      proc.on('close',function(code,signal){
        if(done)return;
        if(code===0)return finish(null,{stdout:stdout,stderr:stderr});
        finish(Error(signal?'Загрузка отменена':'yt-dlp: '+(stderr.trim().split('\n').slice(-3).join(' ').slice(-550)||'exit '+code)));
      });
    });
  }
  function resolveEngine(config){return resolve(config||{});}
  function version(config){return spawn(['--version'],config).then(function(x){return x.stdout.trim().slice(0,60);});}
  async function inspect(address,config){
    var result=await spawn(['--ignore-config','--no-playlist','--no-download','--dump-single-json','--no-warnings','--',url(address)],config);
    var data=JSON.parse(result.stdout);
    return {title:String(data.title||'Untitled').slice(0,230),id:String(data.id||''),extractor:String(data.extractor_key||data.extractor||''),
      duration:Number(data.duration)||0,thumbnail:String(data.thumbnail||''),formats:(Array.isArray(data.formats)?data.formats:[]).slice(-500).map(function(f){return {id:String(f.format_id||''),ext:String(f.ext||''),height:Number(f.height)||0,fps:Number(f.fps)||0,vcodec:String(f.vcodec||''),acodec:String(f.acodec||''),note:String(f.format_note||'')};})};
  }
  function buildArgs(address,folder,options){
    options=options||{};ensureDir(folder);
    var args=['--ignore-config','--no-warnings','--newline','--no-overwrites', '--windows-filenames', '--no-mtime'];
    if(!options.playlist)args.push('--no-playlist');
    var mode=options.mode||'best',ffmpeg=findFfmpeg(options);
    if(options.ffmpeg&&!fs.existsSync(options.ffmpeg))throw Error('FFmpeg не найден: '+options.ffmpeg);
    if(ffmpeg){
      if(mode==='audio')args.push('-f','bestaudio/best','-x','--audio-format',options.audioFormat||'mp3');
      else if(mode==='mp4')args.push('-f','bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b[ext=mp4]/best','--merge-output-format','mp4');
      else if(mode==='1080'||mode==='720')args.push('-f','bv*[height<='+mode+']+ba/b[height<='+mode+']/best[height<='+mode+']','--merge-output-format','mp4/mkv');
      else if(mode.startsWith('format:')){
        var id=mode.slice(7);if(!/^[a-zA-Z0-9_.+-]{1,80}$/.test(id))throw Error('Неверный ID формата');args.push('-f',id.indexOf('+ba')<0?id:(id+'/best'),'--merge-output-format','mp4/mkv');
      }else args.push('-f','bv*+ba/b','--merge-output-format','mp4/mkv');
      args.push('--ffmpeg-location',ffmpeg);
    }else{
      // Without FFmpeg yt-dlp cannot join separate video and audio streams: it would
      // leave a silent video next to a separate audio file. Ask for one ready file.
      if(mode==='audio')args.push('-f','bestaudio[ext=m4a]/bestaudio/best');
      else if(mode==='1080'||mode==='720')args.push('-f','b[height<='+mode+'][ext=mp4]/b[height<='+mode+']/b');
      else if(mode.startsWith('format:')){
        var single=mode.slice(7);if(!/^[a-zA-Z0-9_.+-]{1,80}$/.test(single))throw Error('Неверный ID формата');if(single.indexOf('+')>=0)throw Error('Этот формат состоит из отдельных видео и звука: для него нужен FFmpeg.');args.push('-f',single);
      }else args.push('-f','b[ext=mp4]/b');
    }
    // Use an ASCII-only per-run stem for yt-dlp. Russian/emoji titles are renamed
    // in Node after the file is confirmed. This avoids uncertain terminal encoding
    // and makes recovery deterministic even when yt-dlp prints a quoted Unicode path.
    var token=/^[a-f0-9]{12}$/.test(options.jobToken||'')?options.jobToken:'000000000000';
    args.push('-P',folder,'-o','ALTO_'+token+'_%(autonumber)03d.%(ext)s',
      '--progress-template','download:ALTO_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
      '--print','after_move:ALTO_RESULT:%(filepath)j\t%(title)j\t%(id)j','--',url(address));
    return args;
  }
  // yt-dlp reports its destination through --print after_move, but the value can
  // occasionally differ from the actual post-processed filename. Resolve both.
  var MEDIA_EXT=/\.(mp4|mov|mkv|webm|m4v|avi|mp3|wav|m4a|aac|ogg|opus|flac|aif|aiff|mka|ts|m2ts)$/i;
  var TEMP_EXT=/\.(part|ytdl|tmp|temp)$/i;
  function mediaSnapshot(folder){
    var result=new Map(),names=[];
    try{names=fs.readdirSync(folder);}catch(_){return result;}
    // Keep scans bounded on large user libraries; don't traverse directories.
    if(names.length>20000)return result;
    for(var name of names){
      if(!MEDIA_EXT.test(name)||TEMP_EXT.test(name)||/\.f\d+\.(?:mp4|m4a|webm|opus)$/i.test(name))continue;
      try{var full=path.join(folder,name),stat=fs.statSync(full);if(stat.isFile())result.set(full,{size:stat.size,mtime:stat.mtimeMs});}catch(_){}
    }
    return result;
  }
  function asReportedJson(raw){
    if(typeof raw!=='string')return '';
    raw=raw.trim();
    if(!raw||raw==='NA'||raw==='null')return '';
    if(raw[0]==='"')try{raw=JSON.parse(raw);}catch(_){raw=raw.replace(/^"|"$/g,'');}
    // Defensive fallback if another intermediary double-escaped \uXXXX.
    if(typeof raw==='string'&&/\\u[0-9a-fA-F]{4}/.test(raw))raw=raw.replace(/\\u([0-9a-fA-F]{4})/g,function(_,hex){return String.fromCharCode(parseInt(hex,16));});
    return typeof raw==='string'?raw:'';
  }
  function finalPath(raw,folder){
    if(typeof raw!=='string')return '';
    raw=asReportedJson(raw);
    if(!raw.trim())return '';
    var p=path.isAbsolute(raw)?raw:path.resolve(folder,raw);
    try{if(fs.statSync(p).isFile())return p;}catch(_){}
    return '';
  }
  function reportedResults(output,folder){
    var found=[];
    for(var line of String(output||'').split(/[\r\n]+/)){
      var idx=line.indexOf('ALTO_RESULT:');
      if(idx<0)continue;
      var fields=line.slice(idx+12).split('\t');
      if(fields.length<3)continue;
      var file=finalPath(fields[0],folder);
      if(file)found.push({file:file,title:asReportedJson(fields[1]),id:asReportedJson(fields[2])});
    }
    return found;
  }
  function cleanFileName(title,id,ext){
    var name=String(title||'').normalize('NFC').replace(/[<>:\"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').replace(/[. ]+$/g,'').trim();
    if(!name)name='Video';
    if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))name='Video '+name;
    // Keep a margin for the directory prefix on older Windows installations.
    name=Array.from(name).slice(0,90).join('').replace(/[. ]+$/g,'');
    var safeId=String(id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
    return name+(safeId?' ['+safeId+']':'')+ext;
  }
  function renameForUser(file,title,id,folder){
    var ext=path.extname(file);
    if(!MEDIA_EXT.test(ext)||!title)return file;
    var target=path.join(folder,cleanFileName(title,id,ext));
    if(path.resolve(target)===path.resolve(file))return file;
    var dir=path.resolve(folder);
    if(path.resolve(path.dirname(target))!==dir)return file;
    var base=target.slice(0,-ext.length),candidate=target,n=2;
    while(fs.existsSync(candidate)&&n<=999){candidate=base+' ('+(n++)+')'+ext;}
    if(fs.existsSync(candidate))return file;
    try{fs.renameSync(file,candidate);return candidate;}catch(_){return file;}
  }
  function reportedPaths(output,folder){
    var paths=[];
    for(var line of String(output||'').split(/[\r\n]+/)){
      var idx=line.indexOf('ALTO_FILE:');
      if(idx>=0){var p=finalPath(line.slice(idx+10),folder);if(p&&!paths.includes(p))paths.push(p);}
      var match=line.match(/^\[download\] (.+?) has already been downloaded(?:$|\s)/);
      if(match){var existing=finalPath(match[1],folder);if(existing&&!paths.includes(existing))paths.push(existing);}
    }
    return paths;
  }
  function existingById(after,mediaId){
    if(!mediaId||!/^[a-zA-Z0-9_-]{3,100}$/.test(mediaId))return [];
    var suffix='['+mediaId+']';
    return [...after.keys()].filter(function(p){return path.basename(p).includes(suffix);});
  }
  function errorTail(log){
    return String(log||'').split(/[\r\n]+/).map(function(x){return x.trim();}).filter(Boolean).slice(-4).join(' / ').slice(-500);
  }
  async function download(address,folder,options,progress){
    options=options||{};
    var before=mediaSnapshot(folder),files=[],token=crypto.randomBytes(6).toString('hex');
    var args=buildArgs(address,folder,Object.assign({},options,{jobToken:token}));
    var result=await spawn(args,options,function(line){
      if(line.startsWith('ALTO_PROGRESS:')){
        var p=line.slice(14).split('|');if(progress)progress({percent:p[0]||'',speed:p[1]||'',eta:p[2]||'',message:''});
      }else if(progress && (line.includes('[download]')||line.includes('[Merger]')||line.includes('[ExtractAudio]'))){
        progress({message:line.slice(0,180)});
      }
    });
    // Prefer the unambiguous ASCII filename this ALTO job created. This is
    // independent of yt-dlp stdout newline framing and Unicode JSON escaping.
    var after=mediaSnapshot(folder);
    var prefix='ALTO_'+token+'_';
    for(var file of after.keys())if(path.basename(file).startsWith(prefix))files.push(file);
    var reports=reportedResults(result.stdout+'\n'+result.stderr,folder);
    for(var info of reports)if(!files.includes(info.file))files.push(info.file);
    // Legacy support for older yt-dlp responses and files in unexpected names.
    if(!files.length||options.playlist){
      for(var file of reportedPaths(result.stdout+'\n'+result.stderr,folder))if(!files.includes(file))files.push(file);
      for(var [file,stat] of after){
        var previous=before.get(file);
        if(!previous||previous.size!==stat.size||previous.mtime!==stat.mtime){if(!files.includes(file))files.push(file);}
      }
    }
    if(!files.length&&!options.playlist){
      for(var file of existingById(after,options.mediaId))if(!files.includes(file))files.push(file);
    }
    files=files.filter(function(file){try{return fs.statSync(file).isFile();}catch(_){return false;}});
    if(files.length){
      // Rename individually with yt-dlp's original title if it was reported,
      // falling back to the inspected title for single-video downloads.
      var normalized=[];
      for(var file of files){
        var meta=reports.find(function(r){return r.file===file;});
        var title=meta&&meta.title||(!options.playlist&&options.mediaTitle)||'';
        var id=meta&&meta.id||(!options.playlist&&options.mediaId)||'';
        var finalFile=path.basename(file).startsWith(prefix)?renameForUser(file,title,id,folder):file;
        if(!normalized.includes(finalFile))normalized.push(finalFile);
      }
      return normalized;
    }
    var reportedName='';
    for(var line of (result.stdout+'\n'+result.stderr).split(/[\r\n]+/)){
      var m=line.match(/ALTO_RESULT:([^\t]+)/);
      if(m){var x=asReportedJson(m[1]);reportedName=path.basename(x).slice(0,120);}
    }
    var existing=[];
    try{existing=fs.readdirSync(folder).filter(function(x){return MEDIA_EXT.test(x);}).slice(0,5);}catch(_){}
    var details=[];
    if(reportedName)details.push('yt-dlp сообщил: '+reportedName);
    details.push('Найдено медиафайлов в папке: '+after.size);
    if(existing.length)details.push('Примеры: '+existing.join(', ').slice(0,160));
    var problem=errorTail(result.stderr);
    if(problem)details.push('yt-dlp: '+problem.slice(0,180));
    throw Error('yt-dlp завершился, но файл не обнаружен в '+folder+'. '+details.join(' · ')+'. Проверь папку в Проводнике.');
  }
  function cancel(){if(running){try{running.kill();}catch(_){}return true;}return false;}
  return {inspect:inspect,download:download,install:install,version:version,cancel:cancel,managedPath:managedPath,resolveEngine:resolveEngine,buildArgs:buildArgs,findFfmpeg:findFfmpeg};
});
