'use strict';
// Meme inserts: GIPHY parsing/safety, YouTube search through yt-dlp, section cuts, track choice.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const G=require('../com.victor.motionviewer/memes-client.js'),factory=require('../com.victor.motionviewer/media-downloader-core.js'),{fixture,clip,Time}=require('./fixture.cjs');
let passed=0;function test(name,fn){return Promise.resolve(fn()).then(()=>{passed++;console.log('PASS',name);});}
const KEY='abcdefghijklmnopqrstuvwxyz123456';
(async()=>{
await test('GIPHY search URL, key check and Russian emotions',()=>{
 const u=new URL(G.searchUrl('недоумение',KEY,{limit:24}));assert.equal(u.origin+u.pathname,'https://api.giphy.com/v1/gifs/search');assert.equal(u.searchParams.get('q'),'недоумение');assert.equal(u.searchParams.get('lang'),'ru');assert.equal(u.searchParams.get('rating'),'pg-13');
 assert.throws(()=>G.searchUrl('x','short'),/MZ_GIPHY_KEY/);assert.throws(()=>G.searchUrl('',KEY));assert.equal(G.EMOTIONS.length,12);assert(G.EMOTIONS.every(e=>e.length===3&&e[2].includes('мем')));
});
await test('GIPHY results keep only https giphy.com MP4s, trim titles, drop duplicates',()=>{
 const mk=(id,host='media2.giphy.com')=>({id,title:'Confused Travolta GIF by Some Studio',url:'https://giphy.com/gifs/'+id,images:{fixed_width:{mp4:`https://${host}/media/${id}/200w.mp4`},original:{mp4:`https://${host}/media/${id}/giphy.mp4`,width:'480',height:'270'}}});
 const r=G.parse({data:[mk('abc123'),mk('abc123'),mk('evil99','evil.example'),{id:'nomp4',images:{}},mk('xyz789')]});
 assert.deepEqual(r.map(x=>x.id),['abc123','xyz789']);assert.equal(r[0].title,'Confused Travolta');assert.equal(r[0].mp4,'https://media2.giphy.com/media/abc123/giphy.mp4');assert.equal(r[0].width,480);
 assert.throws(()=>G.safeMedia('http://media.giphy.com/a.mp4'));assert.throws(()=>G.safeMedia('https://giphy.com.evil.example/a.mp4'));
});
await test('GIPHY save writes a real MP4 with a safe unique name',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alto-meme-')),mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(2000)]);
 const a=G.save(mp4,dir,'What? / Huh','abc123'),b=G.save(mp4,dir,'What? / Huh','abc123');assert.equal(path.basename(a),'What Huh abc123.mp4');assert.notEqual(a,b);
 assert.throws(()=>G.save(Buffer.from('<html>nope</html>'+' '.repeat(2000)),dir,'x'),/не MP4/);fs.rmSync(dir,{recursive:true,force:true});
});
await test('YouTube search runs yt-dlp ytsearch and returns clean entries',async()=>{
 let seen=null;const cp={spawn(bin,args){seen=args;const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>{};setImmediate(()=>{p.stdout.emit('data',Buffer.from(JSON.stringify({entries:[{id:'dQw4w9WgXcQ',title:'Недоумение мем',duration:7,channel:'Memes'},{id:'bad id',title:'x'},{id:'abcdefghijk',title:'Long clip',duration:185}]})));p.emit('close',0);});return p;}};
 const c=factory({fs,path,os,cp,https:{},crypto,platform:'win32',root:os.tmpdir(),env:{PATH:''}});
 const r=await c.search('недоумение мем',12,{engine:'yt-dlp'});assert.equal(seen.at(-1),'ytsearch12:недоумение мем');assert(seen.includes('--flat-playlist'));
 assert.deepEqual(r.map(x=>x.id),['dQw4w9WgXcQ','abcdefghijk']);assert.equal(r[0].thumb,'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');assert.equal(r[1].duration,185);
 await assert.rejects(()=>c.search('',12,{}),/от 1 до 100/);
});
await test('A piece of a long clip is cut by yt-dlp with FFmpeg, and refused without it',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'alto-cut-')),engine=path.join(tmp,'yt-dlp.exe');fs.writeFileSync(engine,'x');fs.mkdirSync(path.join(tmp,'ffmpeg-x','bin'),{recursive:true});fs.writeFileSync(path.join(tmp,'ffmpeg-x','bin','ffmpeg.exe'),'x');
 const c=factory({fs,path,os,cp:{},https:{},crypto,platform:'win32',root:path.join(tmp,'m'),env:{PATH:''}});
 const a=c.buildArgs('https://www.youtube.com/watch?v=abcdefghijk',tmp,{engine,mode:'720',section:{start:61.5,end:66.5}});assert.equal(a[a.indexOf('--download-sections')+1],'*61.50-66.50');assert(a.includes('--force-keyframes-at-cuts'));
 assert.throws(()=>c.buildArgs('https://x.example/v',tmp,{engine,section:{start:5,end:2}}),/Неверный отрезок/);
 const none=factory({fs,path,os,cp:{},https:{},crypto,platform:'win32',root:path.join(tmp,'m2'),env:{PATH:''}});assert.throws(()=>none.buildArgs('https://x.example/v',tmp,{section:{start:0,end:5}}),/нужен FFmpeg/);
 fs.rmSync(tmp,{recursive:true,force:true});
});
await test('Meme track choice: free video track up from V-pref; with sound, a free audio track too',()=>{
 const f=fixture(),T=f.ctx.Time,track=(spans,locked=false)=>({isLocked:()=>locked,clips:{numItems:spans.length,...Object.fromEntries(spans.map((s,i)=>[i,{start:new T(s[0]),end:new T(s[1])}]))}});
 const seq={videoTracks:{numTracks:3,0:track([[0,20]]),1:track([[4,6]]),2:track([])},audioTracks:{numTracks:3,0:track([[0,20]]),1:track([]),2:track([[0,30]])}};
 assert.deepEqual(JSON.parse(JSON.stringify(f.ctx.MZ.memeTracks(seq,0,0,5,8,false))),{v:2,a:-1});
 seq.overwriteClip=()=>{};assert.deepEqual(JSON.parse(JSON.stringify(f.ctx.MZ.memeTracks(seq,1,0,5,8,true))),{v:2,a:1});
 delete seq.overwriteClip;assert.throws(()=>f.ctx.MZ.memeTracks(seq,1,0,5,8,true),/MZ_TRACK_OCCUPIED/,'old API keeps V and A equal: V3/A3 busy');
 seq.audioTracks[2]=track([]);assert.deepEqual(JSON.parse(JSON.stringify(f.ctx.MZ.memeTracks(seq,1,0,5,8,true))),{v:2,a:2});
});
console.log(`PASS ${passed} meme tests`);
})().catch(e=>{console.error(e);process.exit(1);});
