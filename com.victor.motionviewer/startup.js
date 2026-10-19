/* Runs before all application modules. No Node, storage, host calls or network. */
(function(){
 'use strict';
 var complete=false,firstError=null;
 function show(){
  if(complete||!firstError||!document.body||document.getElementById('alto-startup-error'))return;
  var box=document.createElement('section'),heading=document.createElement('h2'),note=document.createElement('p'),details=document.createElement('pre');
  box.id='alto-startup-error';box.setAttribute('role','alert');
  box.style.cssText='position:fixed;z-index:100000;inset:16px;overflow:auto;padding:20px;background:#20283d;color:#f0f3fa;border:1px solid #8894aa;border-radius:16px;font:13px sans-serif;';
  heading.textContent='ALTO: ошибка запуска / Startup error';
  note.textContent='Интерфейс не запустился. Скопируй или сфотографируй сообщение ниже. / Capture the error below for diagnosis.';
  details.style.cssText='white-space:pre-wrap;overflow-wrap:break-word;user-select:text;font:12px monospace;';
  details.textContent=firstError;
  box.appendChild(heading);box.appendChild(note);box.appendChild(details);document.body.appendChild(box);
 }
 function fail(message){if(complete)return;if(!firstError)firstError=String(message).slice(0,8000);show();}
 window.AltoStartup={ready:function(){complete=true;var box=document.getElementById('alto-startup-error');if(box)box.parentNode.removeChild(box);},error:function(){return firstError;}};
 window.addEventListener('error',function(e){
  if(e.target&&e.target.tagName==='SCRIPT'){fail('Script did not load: '+e.target.src);return;}
  if(e.message)fail(e.error&&e.error.stack?e.error.stack:e.message+'\n'+(e.filename||'')+':'+(e.lineno||0)+':'+(e.colno||0));
 },true);
 window.addEventListener('unhandledrejection',function(e){var reason=e.reason;fail(reason&&reason.stack?reason.stack:reason||'Unhandled startup rejection');});
 document.addEventListener('DOMContentLoaded',show);
 window.addEventListener('load',function(){if(!complete)fail('Application initialization did not complete. Check that all files from the same ALTO package are installed.');});
}());
