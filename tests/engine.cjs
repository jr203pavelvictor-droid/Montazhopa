const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../com.victor.motionviewer'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'legacy-core.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'engine.js'),'utf8'),ctx);const E=ctx.MZEngine;
let checked=0,maxError=0;const kinds=['photo','move','pop','rotate','stretch','whip','shake','pulse','fade'];
for(const kind of kinds)for(const fps of [23.976,25,29.97,60])for(const easing of ['linear','smooth','elastic','bounce'])for(const phase of ['in','out']){
 const o=E.options({easing,phase,amount:1.7,angle:35}),spec=E.build(kind,o,fps,2.4),frames=Math.floor(2.4*fps+.000001);
 if(spec.interpolation===5){for(const ax of ['scale','x','y','rotation','opacity','sx','sy'])if(spec[ax]){assert.equal(spec[ax].length,2);approxEndpoint(spec[ax][0][1],E.sample(kind,o,0)[ax]);approxEndpoint(spec[ax][1][1],E.sample(kind,o,1)[ax]);}continue;}
 for(const axis of ['scale','x','y','rotation','opacity','sx','sy'])if(spec[axis])for(let f=0;f<=frames;f++){const expected=E.sample(kind,o,f/frames)[axis],actual=E.value(spec[axis],f/fps),tol=axis==='x'||axis==='y'?.000081:.025001,error=Math.abs(actual-expected);assert(error<tol,`${kind} ${easing} ${axis} ${error}`);maxError=Math.max(maxError,error);checked++;}
}
function approxEndpoint(a,b){assert(Math.abs(a-b)<1e-8);}
const linear=E.build('photo',{easing:'linear',pan:0},25,12);assert.equal(linear.scale.length,2);
const photo=E.sample('photo',{reverse:true,easing:'linear'},0);assert.equal(photo.scale,112);assert.equal(E.sample('photo',{reverse:true,easing:'linear'},1).scale,100);
const route=E.camera([{fx:.5,fy:.5,scale:100,hold:.6},{fx:.3,fy:.4,scale:200,hold:.6}],{mode:'linear',move:.5,settle:.2,overshoot:0,protect:true,fitFrames:100},25);assert(route.keys.length<=4);assert.equal(route.frames,100);
console.log(JSON.stringify({checked,maxError,linearKeys:linear.scale.length,cameraKeys:route.keys.length,status:'PASS'}));
// Motion Zoom Ease Out must reach the target with a decreasing velocity.
for(let i=0;i<=100;i++){
 const u=i/100,out=ctx.MZMotion.ease(u,{mode:'easeOut'}),mirror=1-ctx.MZMotion.ease(1-u,{mode:'easeIn'});
 assert(Math.abs(out-mirror)<1e-12);if(i>0)assert(out>=ctx.MZMotion.ease((i-1)/100,{mode:'easeOut'}));
}
for(const fps of [23.976,25,29.97,60]){
 const stops=[{fx:.5,fy:.5,scale:100,hold:0},{fx:.7,fy:.6,scale:180,hold:0}];
 const opts={mode:'easeOut',move:1,settle:.2,overshoot:0,protect:false};
 const route=E.camera(stops,opts,fps),n=route.frames;
 const start=ctx.MZMotion.sample(route,0),mid=ctx.MZMotion.sample(route,n/2),end=ctx.MZMotion.sample(route,n);
 assert.equal(start.scale,100);assert.equal(end.scale,180);
 // Even perceived zoom speed: scale is geometric in the eased progress (.875 at mid for Ease Out).
 assert(Math.abs(mid.scale-100*Math.pow(1.8,.875))<.6,'mid '+mid.scale);
 // One zoom about a fixed point: position stays linear in scale, so the target travels straight.
 const w=(mid.scale-100)/80;assert(Math.abs(mid.x-(start.x+(end.x-start.x)*w))<.002&&Math.abs(mid.y-(start.y+(end.y-start.y)*w))<.002);
}
console.log('PASS Motion Zoom Ease Out: mirror symmetry, monotonicity, endpoints and route sampling at four frame rates');

// Motion Zoom 2.0 model: box framing, fly-over and marker timing.
{
 const M=ctx.MZMotion;
 let v=M.fitBox(.7,.15,.9,.25);assert(Math.abs(v.fx-.8)<1e-9&&Math.abs(v.fy-.2)<1e-9);assert.equal(v.scale,400);
 v=M.fitBox(.9,.9,.1,.1);assert.equal(v.scale,100);assert.throws(()=>M.fitBox(.3,.3,.3,.3));
 const far=[{fx:.15,fy:.2,scale:300,hold:0},{fx:.85,fy:.8,scale:300,hold:0,transition:{mode:'smooth',move:1,path:'arc'}}];
 const direct=E.camera([far[0],Object.assign({},far[1],{transition:{mode:'smooth',move:1}})],{mode:'smooth',protect:true},25),arc=E.camera(far,{mode:'smooth',protect:true},25);
 const dMid=M.sample(direct,direct.frames/2),aMid=M.sample(arc,arc.frames/2);
 assert(Math.abs(dMid.scale-300)<.01,'direct pan keeps the zoom');assert(aMid.scale<190&&aMid.scale>=100,'fly-over pulls back: '+aMid.scale);
 assert.equal(M.sample(arc,0).scale,300);assert.equal(M.sample(arc,arc.frames).scale,300);
 for(let f=0;f<=arc.frames;f++){const p=M.sample(arc,f),m=(p.scale/100-1)/2;assert(p.scale>=100&&Math.abs(p.x-.5)<=m+1e-9&&Math.abs(p.y-.5)<=m+1e-9,'fly-over stays inside the frame');}
 assert(M.arcDip(far[0],far[1])>0);assert.equal(M.arcDip({fx:.5,fy:.5,scale:100},{fx:.85,fy:.2,scale:320}),0,'no pull-back from the overview');assert.equal(M.arcDip({fx:.5,fy:.5,scale:300},{fx:.52,fy:.5,scale:300}),0);
 // Markers: view 2 arrives on marker 1, view 3 on marker 2, at 25 and 29.97 fps.
 for(const fps of [25,29.97]){
  const stops=[{fx:.5,fy:.5,scale:100,hold:.6},{fx:.3,fy:.4,scale:200,hold:.8,transition:{mode:'smooth',move:.45}},{fx:.7,fy:.6,scale:200,hold:.8,transition:{mode:'spring',move:.45,settle:.3,overshoot:.12}},{fx:.5,fy:.5,scale:100,hold:.6,transition:{mode:'smooth',move:.45}}];
  const a=M.alignToMarkers(stops,{mode:'smooth',move:.45},[1.2,2.6,4.0,9],fps),route=E.camera(a.stops,{mode:'smooth',protect:true},fps);
  assert.equal(a.used,3);assert.equal(a.ignored,1);assert.equal(a.missing,0);
  assert.deepEqual([1,2,3].map(i=>route.arrivals[i]),[1.2,2.6,4.0].map(t=>Math.round(t*fps)));
  assert.equal(stops[0].hold,.6,'input stops are not mutated');
 }
 const tight=M.alignToMarkers([{fx:.5,fy:.5,scale:100,hold:0},{fx:.3,fy:.4,scale:200,hold:0,transition:{mode:'smooth',move:1}}],{},[.4],25);
 assert.deepEqual(tight.shortened,[2]);assert.equal(tight.stops[0].hold,0);assert.equal(E.camera(tight.stops,{protect:true},25).arrivals[1],10);
 assert.throws(()=>M.alignToMarkers([{fx:.5,fy:.5,scale:100,hold:0},{fx:.3,fy:.4,scale:200,hold:0}],{},[.04],25),/слишком близко/);
 console.log('PASS Motion Zoom 2.0: box framing, fly-over inside the frame, marker arrivals at 25/29.97 fps');
}
