/* Use Node's bundled Acorn for an ES3 syntax gate; not a Premiere emulator. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parserModule={exports:{}};
const source=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
if(!source)throw Error('This test requires the Acorn parser bundled with Node 22/24');
vm.runInNewContext(source,{module:parserModule,exports:parserModule.exports});
function parse(code){return parserModule.exports.parse(code,{ecmaVersion:3,allowReserved:'never'});}
module.exports=parse;
if(require.main===module){const file=process.argv[2]||path.resolve(__dirname,'../com.victor.motionviewer/jsx/host.bundle.jsx');parse(fs.readFileSync(file,'utf8'));console.log('PASS ES3 syntax: '+file);}
