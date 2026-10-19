'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {fixture,clip,Time}=require('./fixture.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
function header(width=1920,height=1080){const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b.toString('latin1');}
function captureFixture(options={}){
 const f=fixture([clip('Layer',12,8,{selected:false})]),files={},folders=new Set(),calls=[];
 const seq=f.ctx.app.project.activeSequence;seq.name='Timeline';
 function File(name){if(!(this instanceof File))return new File(name);this.fsName=String(name);}
 Object.defineProperties(File.prototype,{exists:{get(){return files[this.fsName]!==undefined;}},length:{get(){return (files[this.fsName]||'').length;}}});
 File.prototype.open=function(){return this.exists;};File.prototype.read=function(n){return files[this.fsName].slice(0,n);};File.prototype.close=function(){};File.prototype.remove=function(){delete files[this.fsName];return true;};
 function Folder(name){this.fsName=String(name);}Object.defineProperty(Folder.prototype,'exists',{get(){return folders.has(this.fsName);}});Folder.prototype.create=function(){folders.add(this.fsName);return true;};Folder.userData={fsName:options.userData||'/Users/Victor/Library/Application Support'};
 f.ctx.File=File;f.ctx.Folder=Folder;
 const q={name:'Timeline',CTI:{timecode:'00:00:12:00'},exportFramePNG(time,base){calls.push([time,base]);if(options.write!==false)files[base+(options.suffix===undefined?'.png':options.suffix)]=options.data||header();if(options.move)seq.getPlayerPosition=()=>new Time(13);if(options.switchSequence)f.ctx.app.project.activeSequence={sequenceID:'other'};if(options.throwAfterWrite)throw Error('Exporter reported a failure after writing');return options.result===undefined?false:options.result;}};
 f.ctx.qe.project.getActiveSequence=()=>options.unsupported?{}:q;
 return {...f,files,calls,run:()=>JSON.parse(f.ctx.MZ.captureTimelineFrame())};
}
test('False export result plus a verified PNG is success without selecting any clips',()=>{const f=captureFixture(),r=f.run();assert(r.ok&&!r.pending,JSON.stringify(r));assert.equal(r.timecode,'00:00:12:00');assert.equal(f.calls[0][0],'00:00:12:00');assert.equal(f.mutations(),0);assert.equal(r.width,1920);assert(f.files[r.path]);JSON.parse(f.ctx.MZ.discardTimelineFrame(r.ticket));assert.equal(Object.keys(f.files).length,0);});
test('True export result without a file stays pending',()=>{const f=captureFixture({write:false,result:true}),r=f.run();assert(r.ok&&r.pending);f.files[f.calls[0][1]+'.png']=header();const p=JSON.parse(f.ctx.MZ.pollTimelineFrame(r.ticket));assert(p.ok&&!p.pending);});
test('An exception after successful file output is verified through the PNG',()=>{const f=captureFixture({throwAfterWrite:true}),r=f.run();assert(r.ok&&!r.pending);});
test('Unsupported exporter, corrupt PNG and wrong dimensions preserve the project',()=>{for(const options of [{unsupported:true},{data:'not png'.repeat(5)},{data:header(1280,720)}]){const f=captureFixture(options),r=f.run();assert(!r.ok);assert.equal(f.mutations(),0);assert.equal(Object.keys(f.files).length,0);assert.equal(Object.keys(f.ctx.MZ.frameCaptures).length,0);}});
test('A moving playhead or changed sequence rejects a stale snapshot',()=>{for(const options of [{move:true},{switchSequence:true}]){const f=captureFixture(options),r=f.run();assert(!r.ok);assert.equal(r.error,'MZ_FRAME_SEQUENCE_CHANGED');assert.equal(Object.keys(f.files).length,0);}});
test('Native Mac and Windows Unicode paths are preserved',()=>{for(const userData of ['/Users/Виктор/Library/Application Support','C:\\Users\\Виктор\\AppData\\Roaming']){const f=captureFixture({userData}),r=f.run();assert(r.ok);assert(r.path.startsWith(userData));assert(!r.path.includes('C:\\C:'));}});
test('Only private ticket files are removed; basename variants are supported',()=>{for(const suffix of ['', '.png','.png.png']){const f=captureFixture({suffix});f.files['/keep/my-image.png']=header();const r=f.run();assert(r.ok&&!r.pending);f.ctx.MZ.discardTimelineFrame('unknown');assert(f.files[r.path]);f.ctx.MZ.discardTimelineFrame(r.ticket);assert.deepEqual(Object.keys(f.files),['/keep/my-image.png']);}});
test('No active sequence reports a readable error without exporting',()=>{const f=captureFixture();f.ctx.app.project.activeSequence=null;const r=f.run();assert(!r.ok);assert.equal(r.error,'MZ_FRAME_NO_SEQUENCE');assert.equal(f.calls.length,0);});
test('CEP reads only a bounded, non-symlink PNG in the private frame cache',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mz-frame-test-'));
 try{
  const c={window:{},require:n=>n==='os'?{homedir:()=>temp}:require(n),process,Buffer};vm.createContext(c);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../com.victor.motionviewer/local.js'),'utf8'),c);const L=c.window.MZLocal,dir=path.join(L.root(),'frame-cache');fs.mkdirSync(dir,{recursive:true});const receipt={path:path.join(dir,'mz-frame-1-2.png'),width:1920,height:1080};fs.writeFileSync(receipt.path,Buffer.from(header(),'latin1'));assert(L.frameDataURL(receipt).startsWith('data:image/png;base64,'));assert.throws(()=>L.frameDataURL({...receipt,path:path.join(temp,'outside.png')}));assert.throws(()=>L.frameDataURL({...receipt,width:100}));const link=path.join(dir,'mz-frame-2-3.png');try{fs.symlinkSync(receipt.path,link);assert.throws(()=>L.frameDataURL({...receipt,path:link}));}catch(e){if(process.platform!=='win32'||e.code!=='EPERM')throw e;const lstat=fs.lstatSync;fs.copyFileSync(receipt.path,link);try{fs.lstatSync=target=>{const st=lstat(target);return target===link?Object.assign(st,{isSymbolicLink:()=>true}):st;};assert.throws(()=>L.frameDataURL({...receipt,path:link}));console.log('INFO Windows cannot create symlinks without extra privileges; symlink metadata guard simulated. CI tests a real symlink.');}finally{fs.lstatSync=lstat;}}
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
console.log(JSON.stringify({passed,scope:'QE export receipt simulation and private PNG loader. Not a live Premiere export.'}));
