/* Native form semantics stay intact; only slider fill reflects its existing value. */
(function(){
 'use strict';
 function range(input){
  if(!input||input.type!=='range')return;
  const min=Number(input.min)||0,max=Number(input.max)||100,value=Number(input.value);
  const percent=max>min?Math.max(0,Math.min(100,(value-min)*100/(max-min))):0;
  input.style.setProperty('--range-progress',percent+'%');
 }
 function refresh(root){(root||document).querySelectorAll('input[type=range]').forEach(range);}
 document.addEventListener('input',e=>{range(e.target);if(e.target.type==='number')refresh(document.getElementById('main'));});
 document.addEventListener('change',e=>{range(e.target);if(e.target.type==='number')refresh(document.getElementById('main'));});
 window.AltoSurfaces={refresh,update:range};
}());
