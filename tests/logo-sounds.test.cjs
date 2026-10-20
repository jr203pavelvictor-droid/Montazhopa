const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','com.victor.motionviewer','ui','logo-sounds.js'),'utf8');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'alto-logo-sounds-')),memory={},history=[];
let serial=0;
const local={
 available:true,
 assetDir(){return root;},
 read(name,fallback){return Object.prototype.hasOwnProperty.call(memory,name)?JSON.parse(JSON.stringify(memory[name])):fallback;},
 write(name,value){memory[name]=JSON.parse(JSON.stringify(value));},
 id(){return 'logo-'+(++serial);}
};
class AudioStub {
 constructor(src){this.src=src;this.volume=1;this.listeners={};this.paused=false;history.push(this);}
 addEventListener(evt,fn){this.listeners[evt]=fn;}
 play(){return Promise.resolve();}
 pause(){this.paused=true;}
 removeAttribute(name){if(name==='src')this.src='';}
 load(){}
}
const listeners={};
const win={MZLocal:local,AltoMyinstantsClient:{
 safeUrl(url){assert.match(url,/^https:\/\/www\.myinstants\.com\/media\/sounds\/[a-z]+\.mp3$/);return url;},
 async mp3(){return Buffer.from('ID3\x01\x02\x03','binary');}
},addEventListener(name,fn){listeners[name]=fn;}};
win.window=win;
const ctx={window:win,Audio:AudioStub,require:require,console:console,Date:Date,Math:Math};
vm.runInNewContext(source,ctx,{filename:'logo-sounds.js'});
const api=win.AltoLogoSounds;
(async()=>{
 try{
  assert.equal(api.read().sounds.length,0);
  api.playRandom();assert.equal(history.length,0,'no playback when playlist empty');
  const boom={title:'Vine Boom',mp3:'https://www.myinstants.com/media/sounds/boom.mp3'};
  const bruh={title:'Bruh',mp3:'https://www.myinstants.com/media/sounds/bruh.mp3'};
  assert.equal(await api.add(boom),true);
  assert.equal(await api.add(boom),false,'no duplicate MP3');
  assert.equal(await api.add(bruh),true);
  assert.equal(api.read().sounds.length,2);
  for(const x of api.read().sounds)assert.equal(fs.readFileSync(x.path).toString('ascii',0,3),'ID3');
  api.playRandom();assert.equal(history.length,1);
  assert.equal(history[0].volume,.15);
  const first=history[0].src;
  api.playRandom();assert.equal(history.length,2);
  assert.notEqual(history[1].src,first,'avoid repeating immediately');
  assert.equal(history[0].paused,true,'previous sound stops');
  let list=api.read();list.volume=8;api.remove(list.sounds[0].id);
  assert.equal(list.sounds.length,2,'read returns detached settings');
  assert.equal(api.read().sounds.length,1);
  assert.equal(fs.readdirSync(path.join(root,'logo-sounds')).length,1);
  list=api.read();list.volume=8;list.enabled=false;local.write('logo-sounds.json',list);
  const before=history.length;api.playRandom();assert.equal(history.length,before,'disabled board stays quiet');
  list.enabled=true;local.write('logo-sounds.json',list);
  api.playRandom();assert.equal(history[history.length-1].volume,.08);
  listeners.beforeunload();
  assert.equal(history[history.length-1].paused,true,'sound stops when extension unloads');
  console.log('PASS: ALTO logo playlist storage, duplicate rejection, quiet playback, no immediate repeat and cancellation');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
