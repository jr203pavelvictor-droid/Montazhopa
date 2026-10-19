/* Montazhopa 3: shared ES3 motion model. No external code or runtime required. */
var MZEngine=(function(){
 function num(v,d,lo,hi){v=typeof v==='undefined'?d:Number(v);if(!isFinite(v)||v<lo||v>hi)throw Error('Invalid motion value');return v;}
 function lerp(a,b,u){return a+(b-a)*u;}
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function ease(u,kind,spring){
  if(u<=0)return 0;if(u>=1)return 1;
  if(kind==='linear')return u;
  if(kind==='easeIn')return u*u*u;
  if(kind==='easeOut')return 1-Math.pow(1-u,3);
  if(kind==='elastic')return 1-Math.pow(1-u,3)*Math.cos(u*Math.PI*(2+spring*3));
  if(kind==='bounce'){var c=7.5625,d=2.75;if(u<1/d)return c*u*u;if(u<2/d){u-=1.5/d;return c*u*u+.75;}if(u<2.5/d){u-=2.25/d;return c*u*u+.9375;}u-=2.625/d;return c*u*u+.984375;}
  return u*u*u*(u*(u*6-15)+10);
 }
 function options(o){o=o||{};return {duration:num(o.duration,.55,.08,20),amount:num(o.amount,1,.05,4),angle:num(o.angle,0,-180,180),phase:/^(in|out|accent|hold)$/.test(o.phase)?o.phase:'in',easing:/^(linear|smooth|easeIn|easeOut|elastic|bounce)$/.test(o.easing)?o.easing:'smooth',spring:num(o.spring,.5,0,1),shutter:num(o.shutter,180,0,360),zoom:num(o.zoom,12,1,100),pan:num(o.pan,3,0,30),reverse:!!o.reverse,frequency:num(o.frequency,5,1,20),opacity:num(o.opacity,50,0,100),softness:num(o.softness,24,0,200),distance:num(o.distance,10,0,300),seed:num(o.seed,17,0,100000)};}
 function sample(kind,o,u){
  o=options(o);u=clamp(u,0,1);var v=ease(u,o.easing,o.spring),p=o.phase==='out'?1-v:v,a=o.angle*Math.PI/180,s=o.amount;
  var r={scale:100,x:0,y:0,rotation:0,opacity:100,sx:100,sy:100};
  if(kind==='photo'){var q=o.reverse?1-v:v;r.scale=100+o.zoom*q;r.x=Math.cos(a)*o.pan/100*q;r.y=Math.sin(a)*o.pan/100*q;return r;}
  if(kind==='move'||kind==='whip'){var travel=(kind==='whip'?1.2:.25)*s;r.x=-Math.cos(a)*travel*(1-p);r.y=-Math.sin(a)*travel*(1-p);r.opacity=clamp(p*5,0,1)*100;if(kind==='whip')r.rotation=-(1-p)*8*s;}
  if(kind==='pop'){r.scale=Math.max(.01,100*(1-s*.8*(1-p)));r.opacity=clamp(p*5,0,1)*100;}
  if(kind==='rotate'){r.rotation=-90*s*(1-p);r.scale=Math.max(.01,100*(1-.25*s*(1-p)));r.opacity=clamp(p*5,0,1)*100;}
  if(kind==='stretch'){r.sx=Math.max(.01,100+70*s*(1-p));r.sy=Math.max(.01,100-65*s*(1-p));r.opacity=clamp(p*5,0,1)*100;}
  if(kind==='fade')r.opacity=p*100;
  if(kind==='shake'){var wave=Math.sin(u*Math.PI*2*o.frequency)*Math.pow(1-u,2)*Math.sin(u*Math.PI*.5);r.x=Math.cos(a)*.08*s*wave;r.y=Math.sin(a)*.08*s*wave;r.rotation=2*s*wave;}
  if(kind==='pulse'){r.scale=100+8*s*Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI);}
  if(o.phase==='accent'&&kind!=='shake'&&kind!=='pulse'){var w=Math.sin(u*Math.PI);r.scale=100+12*s*w;r.opacity=100;r.x=0;r.y=0;r.rotation=kind==='rotate'?15*s*w:0;r.sx=100;r.sy=100;}
  return r;
 }
 function value(points,t){if(t<=points[0][0])return points[0][1];for(var i=1;i<points.length;i++){var a=points[i-1],b=points[i];if(t<=b[0])return lerp(a[1],b[1],(t-a[0])/(b[0]-a[0]));}return points[points.length-1][1];}
 function simplify(points,tolerance){
  if(points.length<=2)return points;
  var keep={},stack=[[0,points.length-1]];keep[0]=true;keep[points.length-1]=true;
  while(stack.length){var seg=stack.pop(),a=seg[0],b=seg[1],worst=0,at=-1;
   for(var i=a+1;i<b;i++){var expected=lerp(points[a][1],points[b][1],(points[i][0]-points[a][0])/(points[b][0]-points[a][0]));var err=Math.abs(points[i][1]-expected);if(err>worst){worst=err;at=i;}}
   if(worst>tolerance&&at>a){keep[at]=true;stack.push([a,at]);stack.push([at,b]);}
  }
  var out=[];for(var j=0;j<points.length;j++)if(keep[j])out.push(points[j]);return out;
 }
 function build(kind,raw,fps,seconds){
  var o=options(raw),duration=seconds||o.duration,n=Math.max(2,Math.round(duration*fps)),axes=['scale','x','y','rotation','opacity','sx','sy'],spec={title:kind,name:'MZ / '+kind,group:kind==='photo'||o.phase==='hold'?'PHOTO':o.phase==='out'?'OUT':'IN',duration:n/fps,shutter:o.shutter};
  if(kind==='shadow'){spec.group='SHD';spec.duration=0;spec.shadow=[[o.opacity/100,o.angle,o.distance,o.softness]];return spec;}
  if(n>18000)throw Error('Animation exceeds 18000 frames');
  for(var a=0;a<axes.length;a++){
   var axis=axes[a],points=[],base=/^(scale|sx|sy|opacity)$/.test(axis)?100:0,changed=false;
   for(var f=0;f<=n;f++){var v=sample(kind,o,f/n)[axis];points.push([f/fps,v]);if(Math.abs(v-base)>.00000001)changed=true;}
   if(changed)spec[axis]=simplify(points,axis==='x'||axis==='y'?.00008:.025);
  }
  return spec;
 }
 function camera(stops,o,fps){
  var route=MZMotion.build(stops,o,fps),keys=route.keys,keep={},axes=['scale','x','y'];
  for(var a=0;a<axes.length;a++){var points=[];for(var i=0;i<keys.length;i++)points.push([keys[i].frame,keys[i][axes[a]]]);var reduced=simplify(points,a===0?.025:.00008);for(var j=0;j<reduced.length;j++)keep[reduced[j][0]]=true;}
  var out=[];for(var k=0;k<keys.length;k++)if(keep[keys[k].frame])out.push(keys[k]);route.keys=out;return route;
 }
 return {options:options,sample:sample,build:build,value:value,simplify:simplify,ease:ease,camera:camera};
}());
if(typeof module!=='undefined'&&module.exports)module.exports=MZEngine;
