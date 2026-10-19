const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.join(__dirname,'../com.victor.motionviewer');
let host=fs.readFileSync(path.join(root,'jsx/host.jsx'),'utf8');for(const [needle,file] of [['base.jsx','jsx/base.jsx'],['json.jsx','jsx/json.jsx'],['../engine.js','engine.js']])host=host.replace('#include '+JSON.stringify(needle),fs.readFileSync(path.join(root,file),'utf8'));
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const TICKS=254016000000;
class Time{constructor(seconds=0){this.ticks=String(Math.round(seconds*TICKS));}get seconds(){return Number(this.ticks)/TICKS;}}
function collection(array,kind='numItems'){Object.defineProperty(array,kind,{get(){return this.length},configurable:true});return array;}
class Param{
 constructor(value,options={}){this.value=clone(value);this.keys=new Map();this.interp=new Map();this.options=options;this.varying=false;this.writes=0;}
 getValue(){return clone(this.value);} getValueAtKey(t){return clone(this.keys.get(t.ticks));}
 areKeyframesSupported(){return true;} isTimeVarying(){return this.varying;}
 setTimeVarying(v){this.varying=v;if(v)this.keys.set(new Time(99).ticks,clone(this.value));return 0;}
 getKeys(){return [...this.keys.keys()].map(t=>{const time=new Time();time.ticks=t;return time;});}
 removeKey(t){this.keys.delete(t.ticks);return 0;}
 addKey(t){if(this.options.failKey)throw Error('Injected keyframe failure');this.keys.set(t.ticks,clone(this.value));return 0;}
 setValueAtKey(t,v){this.keys.set(t.ticks,clone(v));this.writes++;return 0;}
 setInterpolationTypeAtKey(t,v){this.interp.set(t.ticks,v);return 0;}
 setValue(v){this.value=clone(v);this.writes++;return 0;}
 setColorValue(...v){this.value=v.slice(0,4);this.writes++;return 0;}
}
function component(match,options={}){
 if(match==='AE.ADBE Geometry2'){
  const point=options.pixelPoints?[2000,1500]:[.5,.5];
  return {matchName:match,properties:collection([new Param(point),new Param(point),new Param(true),new Param(100,{failKey:options.failKey}),new Param(100),new Param(0),new Param(0),new Param(0),new Param(100),new Param(true),new Param(0),new Param(0)])};
 }
 if(match==='AE.ADBE Drop Shadow')return {matchName:match,properties:collection([new Param([255,0,0,0]),new Param(options.shadowUI?50:127.5),new Param(135),new Param(5),new Param(0),new Param(false)])};
 return {matchName:match,properties:collection([new Param([.47,.52]),new Param(38),new Param(7)])};
}
function clip(name,start,duration,options={}){
 const sourceIn=options.inPoint??3600,rate=options.rate??1;
 return {nodeId:name+'_'+start,name,start:new Time(start),end:new Time(start+duration),inPoint:new Time(sourceIn),outPoint:new Time(sourceIn+duration*rate),components:collection([component('AE.ADBE Motion'),component('AE.ADBE Opacity'),component('EXISTING_CUSTOM')]),isSelected:()=>options.selected!==false,isSpeedReversed:()=>!!options.reverse,isAdjustmentLayer:()=>!!options.adjustment};
}
function fixture(clips=[clip('Photo',12,3)],options={}){
 let mutations=0;
 const sequence={sequenceID:'sequence-test-01',frameSizeHorizontal:options.width||1920,frameSizeVertical:options.height||1080,getPlayerPosition:()=>new Time(options.playhead??12),timebase:String(TICKS/(options.fps??25)),videoTracks:collection([{clips:collection(clips),isLocked:()=>!!options.locked}],'numTracks')};
 const qitems=[];
 for(const c of clips){
  qitems.push({type:'Empty',name:'',start:{secs:0},end:{secs:Number(c.start.ticks)/TICKS}});
  const qi={type:'Clip',name:c.name,start:{secs:Number(c.start.ticks)/TICKS},end:options.noQEEnd?undefined:{secs:Number(c.end.ticks)/TICKS},
   addVideoEffect(effect){mutations++;c.components.push(component(effect.matchName,options));if(options.throwAfterAdd)throw Error('Injected add failure');},
   get numComponents(){return c.components.length;},getComponentAt(i){return options.noRemove?{}:{remove(){c.components.splice(i,1);}}}};
  qitems.push(qi);
 }
 if(options.ambiguous)qitems.push(qitems[qitems.length-1]);
 const qseq={getVideoTrackAt:i=>({numItems:qitems.length,getItemAt:j=>qitems[j]})};
 const context={Time,app:{version:'25.5.0',project:{activeSequence:sequence},enableQE(){}},qe:{project:{getActiveSequence:()=>qseq,getVideoEffectByName:name=>name==='AE.ADBE Geometry2'||name==='AE.ADBE Drop Shadow'?{matchName:name}:null}}};
 vm.createContext(context);vm.runInContext(host,context);
 return {ctx:context,clips,mutations:()=>mutations,apply:key=>JSON.parse(context.VMV.applyById(key)),selection:()=>JSON.parse(context.VMV.selectionInfo())};
}
function approx(a,b,tol=1e-6){assert(Math.abs(a-b)<tol,`${a} vs ${b}`);}
function keySeconds(p){return [...p.keys.keys()].map(x=>Number(x)/TICKS).sort((a,b)=>a-b);}

module.exports={fixture,clip,Time,keySeconds,approx,clone};
