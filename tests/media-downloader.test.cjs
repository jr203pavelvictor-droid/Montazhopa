'use strict';
// Media Downloader: FFmpeg discovery and single-file fallback (no network, no processes).
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const factory=require('../com.victor.motionviewer/media-downloader-core.js');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'alto-dl-')),out=path.join(tmp,'out');fs.mkdirSync(out);
function touch(p){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'x');return p;}
function core(env){return factory({fs,path,os,cp:{},https:{},crypto,platform:'win32',root:path.join(tmp,'managed'),env:env||{PATH:''}});}
const url='https://example.com/v';
test('No FFmpeg anywhere: one ready file, no split video/audio, no MP3 conversion',()=>{
 const c=core();assert.equal(c.findFfmpeg({engine:touch(path.join(tmp,'plain','yt-dlp.exe'))}),'');
 let a=c.buildArgs(url,out,{engine:path.join(tmp,'plain','yt-dlp.exe')});assert.equal(a[a.indexOf('-f')+1],'b[ext=mp4]/b');assert(!a.includes('--ffmpeg-location'));
 a=c.buildArgs(url,out,{mode:'audio'});assert(!a.includes('-x'));assert.equal(a[a.indexOf('-f')+1],'bestaudio[ext=m4a]/bestaudio/best');
 a=c.buildArgs(url,out,{mode:'1080'});assert.equal(a[a.indexOf('-f')+1],'b[height<=1080][ext=mp4]/b[height<=1080]/b');
 assert.throws(()=>c.buildArgs(url,out,{mode:'format:137+140'}),/нужен FFmpeg/);assert.equal(c.buildArgs(url,out,{mode:'format:22'})[c.buildArgs(url,out,{mode:'format:22'}).indexOf('-f')+1],'22');
});
test('Stacher layout: FFmpeg beside the engine is found and used for best quality',()=>{
 const engine=touch(path.join(tmp,'.stacher','yt-dlp.exe')),ff=touch(path.join(tmp,'.stacher','ffmpeg-master-latest-win64-gpl','bin','ffmpeg.exe')),c=core();
 assert.equal(c.findFfmpeg({engine}),ff);const a=c.buildArgs(url,out,{engine});assert.equal(a[a.indexOf('-f')+1],'bv*+ba/b');assert.equal(a[a.indexOf('--ffmpeg-location')+1],ff);
 assert(c.buildArgs(url,out,{engine,mode:'audio'}).includes('-x'));
});
test('FFmpeg on PATH is found; an explicit setting wins and must exist',()=>{
 const onPath=touch(path.join(tmp,'bin-on-path','ffmpeg.exe')),c=core({PATH:['/nope',path.dirname(onPath)].join(path.delimiter)});
 assert.equal(c.findFfmpeg({}),onPath);const chosen=touch(path.join(tmp,'chosen','ffmpeg.exe'));assert.equal(c.findFfmpeg({ffmpeg:chosen}),chosen);
 assert.throws(()=>c.buildArgs(url,out,{ffmpeg:path.join(tmp,'missing','ffmpeg.exe')}),/FFmpeg не найден/);
});
fs.rmSync(tmp,{recursive:true,force:true});console.log(`PASS ${passed} media downloader tests`);
