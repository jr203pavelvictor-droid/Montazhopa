'use strict';
// Mock-Premiere checks for the developer API probe (jsx/api-probe.jsx).
const assert=require('node:assert/strict');
const {fixture,clip,approx}=require('./fixture.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name);}
const motion=f=>f.clips[0].components[0];
const writes=f=>f.clips[0].components.reduce((n,c)=>n+[...c.properties].reduce((m,p)=>m+(p.writes||0),0),0);

test('API probe is read-only and reports sequence, clip and components',()=>{
 const f=fixture(),r=JSON.parse(f.ctx.MZ.apiProbe());
 assert(r.ok,r.error);assert.equal(r.sequence.fps,25);assert.equal(r.clip.name,'Photo');
 assert.equal(r.clip.components.length,3);assert.equal(r.clip.components[0].match,'AE.ADBE Motion');
 assert(r.api.sequence.missing.includes('createCaptionTrack'));assert(r.api.param.present.includes('setInterpolationTypeAtKey'));
 assert.equal(f.mutations(),0);assert.equal(writes(f),0);
});
test('API probe without a selection still reports the app and sequence',()=>{
 const f=fixture([clip('Photo',12,3,{selected:false})]),r=JSON.parse(f.ctx.MZ.apiProbe());
 assert(r.ok,r.error);assert.equal(r.clip,undefined);assert(r.notes.some(n=>/No clip selected/.test(n)));
});
test('Key test measures linear and Bezier curves, then restores Motion and removes the temporary Transform',()=>{
 const f=fixture(),r=JSON.parse(f.ctx.MZ.easingProbe());
 assert(r.ok,r.error);
 approx(r.motionScale.types['0'].at25,125,1e-3);approx(r.motionScale.types['5'].at25,115.625,1e-3);
 approx(r.motionPosition.types['0'].at25[0],0.4,1e-3);
 approx(r.transformScale.types['0'].at25,125,1e-3);
 assert.equal(r.motionRestored,true);assert.equal(r.transformLeft,0);
 assert.equal(f.clips[0].components.length,3);
 assert.equal(motion(f).properties[0].isTimeVarying(),false);assert.equal(motion(f).properties[1].isTimeVarying(),false);
 assert.deepEqual(motion(f).properties[0].getValue(),[.5,.5]);assert.equal(motion(f).properties[1].getValue(),100);
});
test('Key test skips an already animated Motion but still measures the temporary Transform',()=>{
 const f=fixture();motion(f).properties[1].varying=true;const before=writes(f);const r=JSON.parse(f.ctx.MZ.easingProbe());
 assert(r.ok,r.error);assert(r.notes.some(n=>/already animated/.test(n)));assert.equal(r.motionScale,undefined);assert(r.matrix.scale['start-1s']['5-5']);assert.equal(r.transformLeft,0);
 assert.equal(f.clips[0].components.length,3);assert.equal(motion(f).properties[0].writes,0);
});
test('Key test needs exactly one selected clip',()=>{
 const f=fixture([clip('A',0,3),clip('B',3,3)]),r=JSON.parse(f.ctx.MZ.easingProbe());
 assert(!r.ok);assert.match(r.error,/exactly one/);assert.equal(f.mutations(),0);
});
test('A failure while writing keys restores Motion before reporting',()=>{
 const f=fixture();const pos=motion(f).properties[0];pos.setValueAtKey=()=>{throw Error('Injected write failure');};
 const r=JSON.parse(f.ctx.MZ.easingProbe());
 assert(!r.ok);assert.equal(r.motionRestored,true);
 assert.equal(motion(f).properties[1].isTimeVarying(),false);assert.equal(motion(f).properties[1].getValue(),100);
 assert.equal(pos.isTimeVarying(),false);assert.equal(f.clips[0].components.length,3);
});
test('Key test v2 compares key orders and runs the real ALTO key writer',()=>{
 const f=fixture(),r=JSON.parse(f.ctx.MZ.easingProbe());
 assert(r.ok,r.error);assert.equal(r.probeVersion,4);
 approx(r.order.scale.afterAllKeys,115.625,1e-3);assert(r.altoWriteKeys.scale.ok,r.altoWriteKeys.scale.error);assert(r.altoWriteKeys.position.ok,r.altoWriteKeys.position.error);
 assert.equal(r.motionRestored,true);assert.equal(motion(f).properties[1].isTimeVarying(),false);assert.equal(motion(f).properties[1].getValue(),100);
});
test('Visible punch-in writes two eased Motion Scale keys from the playhead and keeps them',()=>{
 const f=fixture(),r=JSON.parse(f.ctx.MZ.zoomPreview());
 assert(r.ok,r.error);assert.equal(r.keys,2);const scale=motion(f).properties[1];
 assert.deepEqual([...scale.interp.values()],[5,5]);assert.deepEqual([...scale.keys.values()].sort((a,b)=>a-b),[100,118]);
 assert.equal(f.mutations(),0);
});
test('Visible punch-in refuses an animated Motion Scale',()=>{
 const f=fixture();motion(f).properties[1].varying=true;const r=JSON.parse(f.ctx.MZ.zoomPreview());assert(!r.ok);assert.match(r.error,/already animated/);
});
console.log(JSON.stringify({passed,scope:'Mock Premiere DOM/QE; not a live Premiere run'}));
