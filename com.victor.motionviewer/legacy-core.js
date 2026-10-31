/* ES3 shared preset customization. Preview and host use identical values. */
var MZPresets=(function(){
    var axes=['scale','sx','sy','x','y','rotation','opacity'];
    function val(v,d,min,max){if(typeof v==='undefined')return d;if(typeof v!=='number'||!isFinite(v)||v<min||v>max)throw new Error('Параметры пресета вне допустимого диапазона.');return v;}
    function value(a,t){if(t<=a[0][0])return a[0][1];for(var i=1;i<a.length;i++)if(t<=a[i][0])return a[i-1][1]+(a[i][1]-a[i-1][1])*(t-a[i-1][0])/(a[i][0]-a[i-1][0]);return a[a.length-1][1];}
    function customize(p,o){
        o=o||{};var q={},k,i,j;
        for(k in p)if(p.hasOwnProperty(k))q[k]=p[k];
        var strength=val(o.strength,1,0.1,4),speed=val(o.speed,1,0.25,4),angle=val(o.angle,0,-180,180)*Math.PI/180;
        q.duration=p.duration/speed;q.shutter=val(o.shutter,180,0,360);
        for(i=0;i<axes.length;i++) {k=axes[i];if(!p[k])continue;q[k]=[];
            for(j=0;j<p[k].length;j++) {var base=/^(scale|sx|sy)$/.test(k)?100:0,v=p[k][j][1];
                if(k!=='opacity')v=base+(v-base)*strength;
                if(/^(scale|sx|sy)$/.test(k))v=Math.max(0.01,v);
                q[k].push([p[k][j][0]/speed,v]);
            }
        }
        if(angle && (q.x||q.y)) {var times=[],x=[],y=[];for(i=0;i<2;i++){var a=i?q.y:q.x;if(a)for(j=0;j<a.length;j++)times.push(a[j][0]);}times.sort(function(a,b){return a-b;});
            for(i=0;i<times.length;i++){if(i&&times[i]===times[i-1])continue;var xx=q.x?value(q.x,times[i]):0,yy=q.y?value(q.y,times[i]):0;x.push([times[i],xx*Math.cos(angle)-yy*Math.sin(angle)]);y.push([times[i],xx*Math.sin(angle)+yy*Math.cos(angle)]);}q.x=x;q.y=y;
        }
        if(p.shadow){q.shadow=[];for(i=0;i<p.shadow.length;i++){var s=p.shadow[i];q.shadow.push([Math.min(1,s[0]*val(o.shadowOpacity,1,0,2)),s[1]+val(o.angle,0,-180,180),s[2]*strength,s[3]*val(o.softness,1,0,4)]);}}
        return q;
    }
    function frames(p,plan){
        var q={},k,i,n,last,full=plan.full;
        if(plan.last/plan.frame>3000)throw new Error('Слишком длинный клип для покадровой анимации: максимум 3000 кадров. Разрежь клип.');
        plan.offset=Math.round(plan.offset/plan.frame)*plan.frame;
        for(k in p)if(p.hasOwnProperty(k))q[k]=p[k];
        for(i=0;i<axes.length;i++){k=axes[i];if(!p[k])continue;var a=p[k],end=a[a.length-1][0],ratio=plan.presetFit||1;
            last=full?plan.last:end*ratio;n=Math.max(1,Math.round(last/plan.frame));n=Math.min(n,Math.floor((plan.last-plan.offset)/plan.frame+0.00001));
            if(n<1)throw new Error('Недостаточно кадров для анимации.');q[k]=[];
            // Sample on frame boundaries, then keep only bends. This preserves
            // the old per-frame path while linear segments use two keys.
            var samples=[],f;
            for(f=0;f<=n;f++)samples.push(value(a,f/n*end));
            q[k].push([0,samples[0]]);
            for(f=1;f<n;f++){
                var left=samples[f]-samples[f-1],right=samples[f+1]-samples[f];
                if(Math.abs(right-left)>1e-12*Math.max(1,Math.abs(samples[f]))){
                    q[k].push([f*plan.frame,samples[f]]);
                }
            }
            q[k].push([n*plan.frame,samples[n]]);
        }
        // Already mapped to local clip time. OUT offset is retained.
        plan.full=false;
        return q;
    }
    return {customize:customize,frames:frames,value:value};
}());
if(typeof module!=='undefined'&&module.exports)module.exports=MZPresets;

/* Shared ES3-compatible camera math: used by both CEP UI and ExtendScript. */
var MZMotion = (function () {
    function number(v, min, max, name) {
        if (typeof v !== 'number' || !isFinite(v) || v < min || v > max) {
            throw new Error('Недопустимое значение: ' + name + '.');
        }
        return v;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function pose(stop, protect) {
        var s = stop.scale / 100;
        var x = 0.5 + (0.5 - stop.fx) * s;
        var y = 0.5 + (0.5 - stop.fy) * s;
        return safe({scale:stop.scale,x:x,y:y}, protect);
    }
    function safe(p, protect) {
        p.scale=Math.max(0.01,p.scale);
        if (protect) {
            p.scale = Math.max(100, p.scale);
            var margin = (p.scale / 100 - 1) / 2;
            p.x = clamp(p.x, 0.5 - margin, 0.5 + margin);
            p.y = clamp(p.y, 0.5 - margin, 0.5 + margin);
        }
        return p;
    }
    function same(a, b) {
        return Math.abs(a.scale-b.scale)<0.0000001 && Math.abs(a.x-b.x)<0.0000001 && Math.abs(a.y-b.y)<0.0000001;
    }
    function bezier(u,x1,y1,x2,y2) {
        function at(t,a,b){return 3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;}
        var lo=0,hi=1,t=u;for(var i=0;i<24;i++){t=(lo+hi)/2;if(at(t,x1,x2)<u)lo=t;else hi=t;}return at(t,y1,y2);
    }
    function ease(u,o){
        u=clamp(u,0,1);if(u===0||u===1)return u;
        var mode=o.mode||'smooth';
        if(mode==='linear')return u;
        if(mode==='hold')return u<1?0:1;
        if(mode==='snap'||mode==='spring')return 1-Math.pow(1-u,4);
        if(mode==='easeIn')return u*u*u;
        if(mode==='easeOut')return 1-Math.pow(1-u,3);
        if(mode==='bezier')return bezier(u,o.x1,o.y1,o.x2,o.y2);
        return u*u*u*(u*(u*6-15)+10);
    }
    function settings(base,override){
        var o={},k;for(k in base)if(base.hasOwnProperty(k))o[k]=base[k];
        if(override)for(k in override)if(override.hasOwnProperty(k))o[k]=override[k];
        o.mode=o.mode||'smooth';
        if(!/^(smooth|snap|spring|linear|hold|bezier|easeIn|easeOut)$/.test(o.mode))throw new Error('Неизвестная кривая.');
        o.move=number(typeof o.move==='undefined'?.45:o.move,0.08,5,'длительность перехода');o.settle=number(typeof o.settle==='undefined'?.3:o.settle,0.08,3,'время успокоения');
        o.overshoot=number(typeof o.overshoot==='undefined'?0:o.overshoot,0,0.6,'сила пружины');
        o.cycles=number(typeof o.cycles==='undefined'?1:o.cycles,0.5,4,'колебания');
        o.delay=number(typeof o.delay==='undefined'?0:o.delay,-0.8,0.8,'задержка зума');
        o.x1=number(typeof o.x1==='undefined'?.2:o.x1,0,1,'ручка X1');o.x2=number(typeof o.x2==='undefined'?.3:o.x2,0,1,'ручка X2');
        o.y1=number(typeof o.y1==='undefined'?0:o.y1,-1,2,'ручка Y1');o.y2=number(typeof o.y2==='undefined'?1:o.y2,-1,2,'ручка Y2');
        if(o.mode!=='spring')o.overshoot=0;
        // direct: one zoom about a fixed point; arc: pull back mid-flight when the
        // next view is far away, then zoom in again (fly-over).
        o.path=o.path==='arc'?'arc':'direct';
        return o;
    }
    function allocate(segments, fitFrames) {
        var i, total=0, minimum=0, weight=0, remaining, used=0, fractions=[];
        for (i=0;i<segments.length;i++) {
            total += segments[i].desired;
            minimum += segments[i].min;
            weight += Math.max(0, segments[i].desired-segments[i].min);
        }
        if (fitFrames === null || typeof fitFrames === 'undefined') {
            for (i=0;i<segments.length;i++) segments[i].frames=segments[i].desired;
            return total;
        }
        number(fitFrames, 1, 3000, 'длина маршрута');
        fitFrames=Math.floor(fitFrames);
        if (fitFrames<minimum) throw new Error('Слой слишком короткий для всех ракурсов. Удлини его или убери точки.');
        remaining=fitFrames-minimum;
        if (!weight) throw new Error('Маршрут не содержит движения.');
        for (i=0;i<segments.length;i++) {
            var exact=remaining*Math.max(0,segments[i].desired-segments[i].min)/weight;
            var extra=Math.floor(exact);
            segments[i].frames=segments[i].min+extra;
            used+=extra;
            fractions.push({i:i,value:exact-extra});
        }
        fractions.sort(function(a,b){return b.value-a.value || a.i-b.i;});
        for(i=0;i<remaining-used;i++) segments[fractions[i%fractions.length].i].frames++;
        return fitFrames;
    }
    function build(stops, options, fps) {
        options=options||{};
        if(Object.prototype.toString.call(stops)!=='[object Array]' || stops.length<2 || stops.length>10) {
            throw new Error('Добавь от 2 до 10 ракурсов.');
        }
        number(fps, 1, 240, 'частота кадров');
        var defaults=settings(options), transitions=[];
        var protect=options.protect!==false, segments=[], poses=[], keys=[], arrivals=[0], frame=0, i;
        for(i=0;i<stops.length;i++) {
            var s=stops[i];
            if(!s || typeof s!=='object') throw new Error('Не удалось прочитать ракурс.');
            number(s.fx,0,1,'центр X'); number(s.fy,0,1,'центр Y');
            number(s.scale,100,500,'масштаб'); number(s.hold,0,60,'пауза');
            poses.push(pose(s,protect));
            if(i) {
                var transition=settings(defaults,s.transition);transitions[i]=transition;
                segments.push({type:'move',to:i,desired:Math.max(2,Math.round(transition.move*fps)),min:2});
                if(transition.overshoot>0) segments.push({type:'settle',to:i,desired:Math.max(2,Math.round(transition.settle*fps)),min:2});
            }
            var hold=Math.round(s.hold*fps);
            segments.push({type:'hold',to:i,desired:hold,min:hold?1:0});
        }
        var total=allocate(segments,options.fitFrames);
        if(total>3000) throw new Error('Маршрут слишком длинный: максимум 3000 кадров.');
        function add(p) {
            var k={frame:frame,scale:p.scale,x:p.x,y:p.y};
            if(keys.length && keys[keys.length-1].frame===frame) { keys[keys.length-1]=k; return; }
            if(keys.length>=2 && same(keys[keys.length-1],k) && same(keys[keys.length-2],k)) keys[keys.length-1]=k;
            else keys.push(k);
        }
        // Camera move between two views. Zoom runs at an even perceived speed
        // (geometric in scale); position stays linear in scale, so the flight is
        // one zoom about a fixed point and the next word travels straight to its
        // place on screen. zp only differs from p when the zoom delay is used.
        // Linear keeps the literal constant percent change (two editable keys).
        function zoomAt(a,b,p,geo){if(!geo)return a.scale+(b.scale-a.scale)*p;return a.scale>0&&b.scale>0&&Math.abs(b.scale-a.scale)>1e-9?a.scale*Math.pow(b.scale/a.scale,p):a.scale;}
        function between(a,b,p,zp,geo) {
            var s=zoomAt(a,b,typeof zp==='number'?zp:p,geo),w=typeof zp!=='number'&&Math.abs(b.scale-a.scale)>1e-6?(s-a.scale)/(b.scale-a.scale):p;
            return safe({scale:s,x:a.x+(b.x-a.x)*w,y:a.y+(b.y-a.y)*w},protect);
        }
        // Fly-over: centres travel straight while the zoom dips to a level where
        // both views fit (window = distance + half the tighter window).
        function arc(a,b,p) {
            var dip=arcDip(a,b);if(dip<=1e-6)return null;
            var sa=a.scale/100,sb=b.scale/100,ca=centre(a),cb=centre(b),q=clamp(p,0,1);
            var s=Math.exp(Math.log(sa)+(Math.log(sb)-Math.log(sa))*p-dip*Math.sin(Math.PI*q)),cx=ca.x+(cb.x-ca.x)*p,cy=ca.y+(cb.y-ca.y)*p;
            return safe({scale:s*100,x:.5+(.5-cx)*s,y:.5+(.5-cy)*s},protect);
        }
        add(poses[0]);
        for(i=0;i<segments.length;i++) {
            var seg=segments[i], j, u, p;
            if(seg.type==='hold') {frame+=seg.frames;add(poses[seg.to]);continue;}
            var cfg=transitions[seg.to],overshoot=cfg.overshoot;
            for(j=1;j<=seg.frames;j++) {
                u=j/seg.frames;
                p=seg.type==='move'?(1+overshoot)*ease(u,cfg):
                    1+overshoot*Math.pow(1-u,2)*Math.cos(2*Math.PI*cfg.cycles*u);
                frame++;
                var result;
                if(seg.type==='move'&&cfg.delay!==0){
                    var zoomU=cfg.delay>0?(u-cfg.delay)/(1-cfg.delay):u/(1+cfg.delay);
                    result=between(poses[seg.to-1],poses[seg.to],p,(1+overshoot)*ease(clamp(zoomU,0,1),cfg),cfg.mode!=='linear');
                } else result=(seg.type==='move'&&cfg.path==='arc'&&arc(poses[seg.to-1],poses[seg.to],p))||between(poses[seg.to-1],poses[seg.to],p,undefined,cfg.mode!=='linear');
                add(result);
            }
            if(seg.type==='settle' || overshoot===0) arrivals[seg.to]=frame;
        }
        if(options.keyMode && options.keyMode!=='sampled') {
            if(!/^(nativeLinear|nativeBezier|nativeHold)$/.test(options.keyMode))throw new Error('Неизвестный тип ключей.');
            for(i=1;i<transitions.length;i++)if(transitions[i].overshoot || transitions[i].delay)throw new Error('Нативные ключи: отключи пружину и задержку зума, либо выбери «Точная кривая».');
            var sparse=[],f=0;sparse.push({frame:0,scale:poses[0].scale,x:poses[0].x,y:poses[0].y});
            for(i=0;i<segments.length;i++){f+=segments[i].frames;var target=poses[segments[i].to];if(f===sparse[sparse.length-1].frame)continue;sparse.push({frame:f,scale:target.scale,x:target.x,y:target.y});}keys=sparse;
        }
        return {keys:keys,frames:frame,seconds:frame/fps,fps:fps,arrivals:arrivals};
    }
    // Marker timing: view i+1 arrives on marker i. Holds absorb the gaps; a move
    // that cannot fit is shortened (minimum 2 frames). Times are seconds from
    // the route start; frames follow build() rounding exactly.
    function alignToMarkers(stops,defaults,times,fps){
        number(fps,1,240,'частота кадров');
        var out=[],marks=[],i,k,d={move:.45,settle:.3,overshoot:0};for(k in defaults||{})if(defaults.hasOwnProperty(k))d[k]=defaults[k];var base=settings(d);
        for(i=0;i<stops.length;i++){var c={};for(k in stops[i])if(stops[i].hasOwnProperty(k))c[k]=stops[i][k];var tr={};if(stops[i].transition)for(k in stops[i].transition)if(stops[i].transition.hasOwnProperty(k))tr[k]=stops[i].transition[k];if(i)c.transition=tr;out.push(c);}
        for(i=0;i<(times||[]).length;i++){var f=Math.round(Number(times[i])*fps);if(isFinite(f)&&f>0&&(!marks.length||marks[marks.length-1]!==f))marks.push(f);}
        marks.sort(function(a,b){return a-b;});
        var views=out.length-1,n=Math.min(views,marks.length),previous=0,shortened=[];
        for(i=1;i<=n;i++){
            var cfg=settings(base,out[i].transition),move=Math.max(2,Math.round(cfg.move*fps)),settle=cfg.overshoot>0?Math.max(2,Math.round(cfg.settle*fps)):0,hold=marks[i-1]-previous-move-settle;
            if(hold<0){var fitted=Math.max(2,move+hold);hold+=move-fitted;move=fitted;if(hold<0)throw new Error('Маркер '+i+' слишком близко к предыдущему: перелёт к ракурсу '+(i+1)+' не успевает. Раздвинь маркеры.');shortened.push(i+1);out[i].transition.move=move/fps;}
            if(hold/fps>60)throw new Error('Между маркерами больше 60 секунд.');
            out[i-1].hold=hold/fps;previous=marks[i-1];
        }
        return {stops:out,used:n,ignored:Math.max(0,marks.length-views),missing:views-n,shortened:shortened};
    }
    function centre(p){var s=p.scale/100;return {x:.5-(p.x-.5)/s,y:.5-(p.y-.5)/s};}
    // Pull back only between two close-ups whose next word lies outside the
    // current window; flights from or to the overview are already wide.
    function arcDip(a,b){var sa=a.scale/100,sb=b.scale/100,ca=centre(a),cb=centre(b),d=Math.max(Math.abs(cb.x-ca.x),Math.abs(cb.y-ca.y)),low=Math.min(sa,sb);if(low<=1.05||d<=.5/low)return 0;var mid=Math.max(1,Math.min(Math.sqrt(sa*sb),1/(d+.5/low)));return Math.max(0,Math.log(Math.sqrt(sa*sb))-Math.log(mid));}
    // A box drawn around a word (frame fractions) becomes a view: centred on the
    // box, scaled so the box fills 80% of the frame on its tighter side.
    function fitBox(x0,y0,x1,y1){
        var l=clamp(Math.min(x0,x1),0,1),r=clamp(Math.max(x0,x1),0,1),t=clamp(Math.min(y0,y1),0,1),b=clamp(Math.max(y0,y1),0,1),size=Math.max(r-l,b-t);
        if(!(size>0))throw new Error('Обведи слово рамкой.');
        return {fx:(l+r)/2,fy:(t+b)/2,scale:Math.round(clamp(100/(1.25*size),100,500))};
    }
    function sample(route, frame) {
        var k=route.keys;
        if(frame<=k[0].frame) return k[0];
        for(var i=1;i<k.length;i++) if(frame<=k[i].frame) {
            var a=k[i-1],b=k[i],u=(frame-a.frame)/(b.frame-a.frame);
            return {scale:a.scale+(b.scale-a.scale)*u,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
        }
        return k[k.length-1];
    }
    return {build:build,sample:sample,pose:pose,number:number,ease:ease,settings:settings,fitBox:fitBox,alignToMarkers:alignToMarkers,arcDip:function(a,b,protect){return arcDip(pose(a,protect!==false),pose(b,protect!==false));}};
}());
if(typeof module!=='undefined' && module.exports) module.exports=MZMotion;
