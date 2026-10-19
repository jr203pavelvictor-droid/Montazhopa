/* Explicit JSX bootstrap and data-only replies. Never retry a mutating command. */
(function(root,factory){
 if(typeof window!=='undefined')window.MZBridge=factory(window);
 if(typeof module!=='undefined'&&module.exports)module.exports=factory;
}(this,function(win){
 'use strict';
 let ready=null;
 // This function is also embedded in ExtendScript: keep its body ES3-compatible.
 function encode(value){
  if(value===null||typeof value==='undefined')return 'null';
  if(typeof value==='string')return '"'+value.replace(/[\\"\x00-\x1f\u2028\u2029]/g,function(c){var hex=c.charCodeAt(0).toString(16);return '\\u'+('0000'+hex).slice(-4);})+'"';
  if(typeof value==='number')return isFinite(value)?String(value):'null';
  if(typeof value==='boolean')return value?'true':'false';
  var parts=[],i;if(Object.prototype.toString.call(value)==='[object Array]'){for(i=0;i<value.length;i++)parts.push(encode(value[i]));return '['+parts.join(',')+']';}
  for(i in value)if(Object.prototype.hasOwnProperty.call(value,i))parts.push(encode(i)+':'+encode(value[i]));return '{'+parts.join(',')+'}';
 }
 function parse(raw,label){
  const text=String(raw===undefined?'':raw).replace(/^\ufeff/,'').trim();let data;
  try{data=JSON.parse(text);}catch(e){const error=Error('Premiere не вернул JSON · '+label+'\nОтвет: '+(text||'(пусто)').slice(0,2000));error.raw=text;error.hostMethod=label;throw error;}
  if(!data||typeof data!=='object'||typeof data.ok!=='boolean')throw Error('Некорректный ответ Premiere · '+label+'\n'+text.slice(0,2000));
  if(!data.ok&&!data.needsConfirm){const error=Error(data.error||'Premiere command failed');error.result=data;error.hostMethod=label;if(data.fileName||data.line)error.message+='\nJSX: '+(data.fileName||'')+':'+(data.line||'?');throw error;}
  return data;
 }
 function evaluate(script,label){return new Promise((resolve,reject)=>{
  if(!win.__adobe_cep__)return reject(Error('MZ_DESKTOP_REQUIRED'));
  try{win.__adobe_cep__.evalScript(script,raw=>{try{resolve(parse(raw,label));}catch(e){reject(e);}});}catch(e){reject(e);}
 });}
 function literal(value){return JSON.stringify(value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
 function bundlePath(){
  let value=win.__adobe_cep__.getSystemPath('extension');const req=win.require;
  if(req){const path=req('path');if(/^file:/i.test(value))value=req('url').fileURLToPath(value);else{value=decodeURI(value);if(req('os').platform()==='win32')value=value.replace(/^\/(?=[A-Za-z]:)/,'');}return path.join(value,'jsx','host.bundle.jsx').replace(/\\/g,'/');}
  value=decodeURI(value).replace(/^file:\/\//,'').replace(/^\/(?=[A-Za-z]:)/,'');return value.replace(/\/$/,'')+'/jsx/host.bundle.jsx';
 }
 function ensure(){
  if(ready)return ready;
  try{const version=win.MZ_VERSION;
  const source='(function(){var encode='+encode.toString()+';try{'+
   'if(typeof MZ===\"undefined\"||MZ.version!=='+literal(version)+'||typeof MZ.health!==\"function\"){var file=new File('+literal(bundlePath())+');if(!file.exists)throw Error(\"JSX bundle is missing: \"+file.fsName);$.evalFile(file);}' +
   'if(typeof MZ===\"undefined\"||MZ.version!=='+literal(version)+'||typeof MZ.health!==\"function\")throw Error(\"JSX bootstrap did not initialize the expected version\");return MZ.health();'+
   '}catch(e){return encode({ok:false,error:String(e.message||e),line:e.line||0,fileName:String(e.fileName||\"\"),number:e.number||0});}}())';
  ready=evaluate(source,'JSX bootstrap').catch(e=>{ready=null;throw e;});return ready;}catch(e){ready=null;return Promise.reject(e);}
 }
 async function call(method,args){
  if(!/^(?:MZ|VMV)\.[A-Za-z][A-Za-z0-9_]*$/.test(method))throw Error('Invalid Premiere method');
  await ensure();const [namespace,name]=method.split('.');
  const source='(function(){var encode='+encode.toString()+';try{var owner='+namespace+';if(typeof owner['+literal(name)+']!==\"function\")throw Error(\"JSX method is unavailable: '+method+'\");var result=owner['+literal(name)+'].apply(owner,'+literal(args||[])+');if(typeof result===\"string\")return result;if(typeof result===\"undefined\")throw Error(\"JSX method returned no data: '+method+'\");return encode(result);}catch(e){return encode({ok:false,error:String(e.message||e),line:e.line||0,fileName:String(e.fileName||\"\"),number:e.number||0});}}())';
  return evaluate(source,method);
 }
 return {ensure,call,parse,bundlePath};
}));
