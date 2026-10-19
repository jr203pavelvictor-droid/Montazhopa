/* Shared ES3 model: UI, ExtendScript and tests use the same time rules. */
var AltoTimeline=(function(){
 function n(v,min,max,label){v=Number(v);if(!isFinite(v)||v<min||v>max)throw Error('Invalid '+label);return v;}
 function copy(v){var o={},k;for(k in v)if(v.hasOwnProperty(k))o[k]=v[k];return o;}
 function freezeTransitions(stops,defaults){for(var i=1;i<stops.length;i++){var o=copy(defaults),k;if(stops[i].transition)for(k in stops[i].transition)if(stops[i].transition.hasOwnProperty(k))o[k]=stops[i].transition[k];stops[i].transition=o;}return stops;}
 // Incoming transition belongs to its destination point, including after reorder.
 function reorder(stops,from,to){n(from,0,stops.length-1,'source point');n(to,0,stops.length-1,'destination point');if(from%1||to%1)throw Error('Invalid point index');var point=stops.splice(from,1)[0];stops.splice(to,0,point);return to;}
 function duplicate(stops,index){n(index,0,stops.length-1,'point');if(index%1||stops.length>=10)throw Error('Maximum 10 views');var point=copy(stops[index]);if(point.transition)point.transition=copy(point.transition);if(point.focus)point.focus=copy(point.focus);stops.splice(index+1,0,point);return index+1;}
 function focus(stops,route){var events=[],i,f,keys=[],fps=n(route.fps,1,240,'FPS'),duration=route.frames/fps;
  for(i=0;i<stops.length;i++){var o=stops[i].focus;if(!o)continue;var strength=n(o.strength,0,200,'blur strength');if(!strength)continue;
   var arrival=route.arrivals[i]/fps;if(!isFinite(arrival))throw Error('Missing route arrival');
   var a=arrival+n(o.riseStart,-30,30,'blur start'),b=a+n(o.riseDuration,.01,30,'blur rise'),c=arrival+n(o.fallStart,-30,60,'focus return'),d=c+n(o.fallDuration,.01,30,'focus return duration');
   if(a<0||c<b||d>duration+1e-7)throw Error('Blur interval must fit route and return after its rise (view '+(i+1)+')');events.push({start:a,peak:b,returnAt:c,end:d,strength:strength,point:i});
  }
  // Maximum envelope resolves overlaps deterministically. One value per frame.
  for(f=0;f<=route.frames;f++){var t=f/fps,value=0;for(i=0;i<events.length;i++){var e=events[i],v=0;if(t>=e.start&&t<=e.end){if(t<e.peak)v=e.strength*(t-e.start)/(e.peak-e.start);else if(t<=e.returnAt)v=e.strength;else v=e.strength*(e.end-t)/(e.end-e.returnAt);}value=Math.max(value,v);}keys.push([f/fps,value]);}
  return {keys:keys,events:events,duration:duration};
 }
 function audio(o,duration){var a=n(o.in,0,duration,'audio In'),b=n(o.out,0,duration,'audio Out');if(b-a<.001)throw Error('Audio Out must follow In');var fi=n(o.fadeIn||0,0,b-a,'fade-in'),fo=n(o.fadeOut||0,0,b-a,'fade-out');if(fi+fo>b-a+1e-8)throw Error('Audio fades overlap');return {in:a,out:b,fadeIn:fi,fadeOut:fo,duration:b-a};}
 function removals(speech,duration){var out=[],cursor=0;for(var i=0;i<speech.length;i++){var a=n(speech[i].start,0,duration,'speech start'),b=n(speech[i].end,0,duration,'speech end');if(a<cursor||b<=a)throw Error('Invalid speech intervals');if(a>cursor)out.push({start:cursor,end:a,remove:true});cursor=b;}if(cursor<duration)out.push({start:cursor,end:duration,remove:true});return out;}
 function retained(cuts,duration){var out=[],cursor=0;for(var i=0;i<cuts.length;i++){var c=cuts[i];if(!c.remove)continue;if(c.start<cursor||c.end<=c.start||c.end>duration)throw Error('Invalid silence intervals');if(c.start>cursor)out.push({start:cursor,end:c.start});cursor=c.end;}if(cursor<duration)out.push({start:cursor,end:duration});return out;}
 return {number:n,copy:copy,freezeTransitions:freezeTransitions,reorder:reorder,duplicate:duplicate,focus:focus,audio:audio,removals:removals,retained:retained};
}());
if(typeof module!=='undefined'&&module.exports)module.exports=AltoTimeline;
