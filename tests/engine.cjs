const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../com.victor.motionviewer'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'legacy-core.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'engine.js'),'utf8'),ctx);const E=ctx.MZEngine;
let checked=0,maxError=0;const kinds=['photo','move','pop','rotate','stretch','whip','shake','pulse','fade'];
for(const kind of kinds)for(const fps of [23.976,25,29.97,60])for(const easing of ['linear','smooth','elastic','bounce'])for(const phase of ['in','out']){
 const o=E.options({easing,phase,amount:1.7,angle:35}),spec=E.build(kind,o,fps,2.4),frames=Math.round(2.4*fps);
 for(const axis of ['scale','x','y','rotation','opacity','sx','sy'])if(spec[axis])for(let f=0;f<=frames;f++){const expected=E.sample(kind,o,f/frames)[axis],actual=E.value(spec[axis],f/fps),tol=axis==='x'||axis==='y'?.000081:.025001,error=Math.abs(actual-expected);assert(error<tol,`${kind} ${easing} ${axis} ${error}`);maxError=Math.max(maxError,error);checked++;}
}
const linear=E.build('photo',{easing:'linear',pan:0},25,12);assert.equal(linear.scale.length,2);
const photo=E.sample('photo',{reverse:true,easing:'linear'},0);assert.equal(photo.scale,112);assert.equal(E.sample('photo',{reverse:true,easing:'linear'},1).scale,100);
const route=E.camera([{fx:.5,fy:.5,scale:100,hold:.6},{fx:.3,fy:.4,scale:200,hold:.6}],{mode:'linear',move:.5,settle:.2,overshoot:0,protect:true,fitFrames:100},25);assert(route.keys.length<=4);assert.equal(route.frames,100);
console.log(JSON.stringify({checked,maxError,linearKeys:linear.scale.length,cameraKeys:route.keys.length,status:'PASS'}));
