const assert=require('assert');
const {fixture,clip,approx,keySeconds,clone}=require('./fixture.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
function selected(f){return JSON.parse(f.ctx.MZ.selection());}
function apply(f,kind='photo',options={},replace=false,token){return JSON.parse(f.ctx.MZ.apply({kind,options,replace,token:token||selected(f).token}));}
test('No selection never writes',()=>{const f=fixture([clip('A',0,5,{selected:false})]);assert(!apply(f).ok);assert.equal(f.mutations(),0);});
test('Linear photo motion uses two endpoint keys per changed parameter',()=>{const f=fixture([clip('Photo',10,12)]);const r=apply(f,'photo',{easing:'linear',pan:0});assert(r.ok,r.error);assert.equal(f.clips[0].components[3].properties[3].keys.size,2);approx(keySeconds(f.clips[0].components[3].properties[3]).at(-1),3611.96);});
test('Photo source offsets, speed, sequence gaps and original effects survive',()=>{const f=fixture([clip('A',2,3,{selected:false}),clip('B',18,8,{inPoint:25,rate:2})]);const before=clone(f.clips[1].components.map(c=>c.properties.map(p=>p.value)));assert(apply(f,'photo',{easing:'linear'}).ok);assert.equal(f.clips[0].components.length,3);assert.deepEqual(f.clips[1].components.slice(0,3).map(c=>c.properties.map(p=>p.value)),before);const times=keySeconds(f.clips[1].components[3].properties[3]);approx(times[0],25);approx(times.at(-1),40.92);});
test('Existing MZ effect requests confirmation without any write',()=>{const f=fixture();assert(apply(f,'pop').ok);const count=f.mutations(),before=f.ctx.VMV.fingerprint(f.clips[0].components[3]);const r=apply(f,'move');assert(r.needsConfirm);assert.equal(f.mutations(),count);assert.equal(f.ctx.VMV.fingerprint(f.clips[0].components[3]),before);});
test('Approved replacement reuses owned Transform without stacking',()=>{const f=fixture();assert(apply(f,'pop').ok);const r=apply(f,'move',{angle:90},true);assert(r.ok,r.error);assert.equal(f.clips[0].components.length,4);assert.equal(f.mutations(),1);assert.equal(f.clips[0].components[3].properties[3].keys.size,0);assert(f.clips[0].components[3].properties[1].keys.size>1);});
test('Approved single-clip replacement changes Transform to Shadow and back',()=>{const f=fixture();assert(apply(f,'pop').ok);let r=apply(f,'shadow',{},true);assert(r.ok,r.error);assert.equal(f.clips[0].components.length,4);assert.equal(f.clips[0].components[3].matchName,'AE.ADBE Drop Shadow');r=apply(f,'move',{},true);assert(r.ok,r.error);assert.equal(f.clips[0].components.length,4);assert.equal(f.clips[0].components[3].matchName,'AE.ADBE Geometry2');});
test('Failed replacement restores the previous owned effect',()=>{const f=fixture();assert(apply(f,'pop').ok);const comp=f.clips[0].components[3],before=f.ctx.VMV.fingerprint(comp);let attempts=0;const add=comp.properties[1].addKey;comp.properties[1].addKey=function(t){if(attempts++===0)throw Error('Injected replacement failure');return add.call(this,t);};const r=apply(f,'move',{},true);assert(!r.ok);assert.equal(r.restoreErrors,0);assert.equal(f.ctx.VMV.fingerprint(comp),before);assert.equal(f.clips[0].components.length,4);});
test('Manually edited owned effects are never silently overwritten',()=>{const f=fixture();assert(apply(f,'pop').ok);f.clips[0].components[3].properties[7].value=17;const r=apply(f,'move',{},true);assert(!r.ok);assert.equal(r.error,'MZ_OWNERSHIP_CHANGED');assert.equal(f.clips[0].components[3].properties[7].value,17);});
test('Stale selection token cannot apply',()=>{const f=fixture(),s=selected(f);f.clips[0].name='Changed';const r=apply(f,'pop',{},false,s.token);assert(!r.ok);assert.equal(f.mutations(),0);});
test('Failed key writing rolls back only the new effect',()=>{const f=fixture(undefined,{failKey:true});const r=apply(f,'pop');assert(!r.ok);assert.equal(f.clips[0].components.length,3);assert.equal(r.remainingEffects,0);});
test('Batch preflight protects all clips on locked tracks',()=>{const f=fixture([clip('A',2,3),clip('B',8,4)],{locked:true});assert(!apply(f).ok);assert.equal(f.mutations(),0);});
test('All grouped tools apply through the host contract',()=>{for(const kind of ['photo','move','pop','rotate','stretch','whip','shake','pulse','fade','shadow']){const f=fixture([clip('A',5,8)]);const r=apply(f,kind);assert(r.ok,kind+': '+r.error);assert.equal(f.clips[0].components.length,4);}});
test('OUT ends on the last frame at 60fps',()=>{const f=fixture([clip('A',12,4)],{fps:60});const r=apply(f,'fade',{phase:'out',duration:.5,easing:'linear'});assert(r.ok,r.error);const times=keySeconds(f.clips[0].components[3].properties[8]);approx(times.at(-1),3600+4-1/60);approx(times[0],3600+4-1/60-.5);});
test('Camera route applies, asks on replace and does not stack',()=>{const f=fixture([clip('Adj',12,8,{adjustment:true})]);const binding=JSON.parse(f.ctx.VMV.cameraInfo()).binding;const request={binding,start:'clip',stops:[{fx:.5,fy:.5,scale:100,hold:.5},{fx:.3,fy:.4,scale:180,hold:.5}],options:{mode:'linear',move:.4,settle:.2,overshoot:0,protect:true,fit:true,shutter:180}};let r=JSON.parse(f.ctx.MZ.applyCamera(request));assert(r.ok,r.error);r=JSON.parse(f.ctx.MZ.applyCamera(request));assert(r.needsConfirm);request.replace=true;r=JSON.parse(f.ctx.MZ.applyCamera(request));assert(r.ok,r.error);assert.equal(f.clips[0].components.length,4);});
test('Motion Zoom binds a full-frame clip directly and refuses one that does not fill the frame',()=>{
 let f=fixture([clip('Screenshot',12,6)]);let info=JSON.parse(f.ctx.VMV.cameraInfo());assert(info.ok,info.error);assert.equal(info.layer,'clip');
 const request={binding:info.binding,start:'clip',stops:[{fx:.5,fy:.5,scale:100,hold:.4},{fx:.8,fy:.2,scale:300,hold:.4,transition:{mode:'smooth',move:.6,path:'arc'}}],options:{mode:'smooth',move:.5,settle:.2,overshoot:0,protect:true,fit:false,shutter:180}};
 let r=JSON.parse(f.ctx.MZ.applyCamera(request));assert(r.ok,r.error);assert.equal(f.clips[0].components.at(-1).matchName,'AE.ADBE Geometry2');
 info=JSON.parse(f.ctx.VMV.cameraInfo());assert(info.ok,'re-binding a clip that already carries the ALTO Transform: '+info.error);
 f=fixture([clip('Portrait',12,6,{sourceWidth:1080,sourceHeight:1920})]);info=JSON.parse(f.ctx.VMV.cameraInfo());assert(!info.ok);assert.equal(info.error,'MZ_CAMERA_CLIP_NOT_FULL_FRAME');
 f=fixture([clip('Rotated',12,6)]);f.clips[0].components[0].properties[4].value=15;info=JSON.parse(f.ctx.VMV.cameraInfo());assert.equal(info.error,'MZ_CAMERA_CLIP_UNSUPPORTED');
});
test('Motion Zoom reads sequence markers inside the layer as seconds from the route start',()=>{
 const f=fixture([clip('Adj',10,8,{adjustment:true})],{markers:[4,11.5,13,17.9,19],playhead:12});const binding=JSON.parse(f.ctx.VMV.cameraInfo()).binding;
 let r=JSON.parse(f.ctx.MZ.cameraMarkers(binding,'clip'));assert(r.ok,r.error);assert.deepEqual(JSON.parse(JSON.stringify(r.times)).map(x=>Math.round(x*1000)/1000),[1.5,3,7.9]);assert.equal(r.fps,25);
 r=JSON.parse(f.ctx.MZ.cameraMarkers(binding,'playhead'));assert.deepEqual(JSON.parse(JSON.stringify(r.times)).map(x=>Math.round(x*1000)/1000),[1,5.9]);
 assert.equal(JSON.parse(fixture([clip('Adj',10,8,{adjustment:true})]).ctx.MZ.cameraMarkers(binding,'clip')).times.length,0);
});
test('Insertion picks the first free track instead of refusing or overwriting',()=>{
 const f=fixture(),T=f.ctx.Time,track=(spans,locked=false)=>({isLocked:()=>locked,clips:{numItems:spans.length,...Object.fromEntries(spans.map((s,i)=>[i,{start:new T(s[0]),end:new T(s[1])}]))}});
 const tracks={numTracks:4,0:track([[0,5],[20,30]]),1:track([[9,12]]),2:track([],true),3:track([])};
 assert.equal(f.ctx.MZ.freeTrack(tracks,0,6,10),0,'gap on the chosen track is used');
 assert.equal(f.ctx.MZ.freeTrack(tracks,0,4,14),3,'busy V1 and V2, locked V3: goes to V4');
 assert.equal(f.ctx.MZ.freeTrack(tracks,1,11,1e9),3,'MOGRT needs nothing after the playhead');assert.equal(f.ctx.MZ.freeTrack(tracks,1,13,1e9),1);
 assert.equal(f.ctx.MZ.freeTrack(tracks,3,0,100),3);assert.equal(f.ctx.MZ.freeTrack({numTracks:1,0:track([[0,50]])},0,1,2),-1);
 assert.equal(f.ctx.MZ.freeTrack(tracks,3,21,22),3);assert.equal(f.ctx.MZ.freeTrack({numTracks:2,0:track([]),1:track([[0,9]])},1,1,2),0,'falls back below the chosen track');
});
test('Premiere transitions: listed from this Premiere, added on the cut, verified by the track count',()=>{
 let f=fixture([clip('Left',10,3),clip('Right',13,3)]);let r=JSON.parse(f.ctx.MZ.transitionNames());assert(r.ok);assert(r.names.includes('Cross Dissolve'));
 r=JSON.parse(f.ctx.MZ.addTransition('Cross Dissolve'));assert(r.ok,r.error);assert(r.verified);assert.equal(f.ctx.app.project.activeSequence.videoTracks[0].transitions.numItems,1);
 assert.equal(JSON.parse(f.ctx.MZ.addTransition('Glitch 3000')).error,'MZ_TRANSITION_NOT_FOUND');
 f=fixture([clip('Left',10,3),clip('Right',13,3)],{transitionNoop:true});assert.equal(JSON.parse(f.ctx.MZ.addTransition('Push')).error,'MZ_TRANSITION_NOT_ADDED');
 f=fixture([clip('Left',10,3),clip('Right',14,3)]);assert.equal(JSON.parse(f.ctx.MZ.addTransition('Push')).error,'MZ_TRANSITION_NOT_ADJACENT');
 f=fixture([clip('Only',10,3)]);assert.equal(JSON.parse(f.ctx.MZ.addTransition('Push')).error,'MZ_TRANSITION_SELECT_TWO');
});
test('JSON parser rejects code, prototype keys and malformed input',()=>{for(const input of ['(function(){return 1})()','{"__proto__":{}}','[1,]','{"a":1} garbage','"\\x41"'])assert.throws(()=>fixture().ctx.MZJSON.parse(input));const f=fixture();assert.equal(f.ctx.MZJSON.parse('{"a":[true,null,"тест"]}').a[2],'тест');});
test('Ownership survives a host-session reset for a saved project',()=>{const f=fixture(),files={};f.ctx.app.project.path='/projects/demo.prproj';function File(name){this.fsName=name;this.encoding='';}Object.defineProperties(File.prototype,{name:{get(){return this.fsName.split('/').pop();}},exists:{get(){return Object.prototype.hasOwnProperty.call(files,this.fsName);}},length:{get(){return (files[this.fsName]||'').length;}}});File.prototype.open=function(mode){this.mode=mode;return true;};File.prototype.read=function(){return files[this.fsName]||'';};File.prototype.write=function(text){files[this.fsName]=text;return true;};File.prototype.close=function(){};File.prototype.remove=function(){delete files[this.fsName];return true;};File.prototype.rename=function(name){const next=this.fsName.slice(0,this.fsName.lastIndexOf('/')+1)+name;files[next]=files[this.fsName];delete files[this.fsName];return true;};function Folder(name){this.fsName=name;this.exists=true;}Folder.userData={fsName:'/user/data'};Folder.prototype.create=()=>true;f.ctx.File=File;f.ctx.Folder=Folder;let r=apply(f,'pop');assert(r.ok,r.error);assert(Object.keys(files).some(x=>x.endsWith('.json')));f.ctx.MZ.memory={};assert.equal(selected(f).conflicts,1);r=apply(f,'move',{},true);assert(r.ok,r.error);assert.equal(f.clips[0].components.length,4);});
test('Motion Zoom Ease Out is accepted by the real bundled host math and reads back correctly',()=>{
 const f=fixture([clip('Adj',12,4,{adjustment:true})]);
 const binding=JSON.parse(f.ctx.VMV.cameraInfo()).binding;
 const request={binding,start:'clip',stops:[{fx:.5,fy:.5,scale:100,hold:0},{fx:.5,fy:.5,scale:180,hold:0}],options:{mode:'easeOut',move:1,settle:.2,overshoot:0,protect:false,fit:false,shutter:0}};
 const r=JSON.parse(f.ctx.MZ.applyCamera(request));assert(r.ok,r.error);
 const p=f.clips[0].components[3].properties[3];const times=keySeconds(p);const t=new f.ctx.Time();
 // Time.seconds is assigned in the host's real Time object; fixture uses ticks explicitly.
 t.ticks=String(Math.round((times[0]+.5)*254016000000));
 // Ease Out reaches 87.5% of its progress at mid-flight; the zoom is geometric (even perceived speed).
 const value=p.getValueAtTime(t);assert(Math.abs(value-100*Math.pow(1.8,.875))<1.5,value);
 const values=[...p.keys.values()];approx(values[0],100);approx(values.at(-1),180);
});
console.log(JSON.stringify({passed,scope:'Mock Premiere API contracts. Not a live Premiere render test.'}));
