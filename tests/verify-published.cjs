/* Public release verification for GitHub Actions. Staging uses private test
   storage; no installed extension or native updater helper is executed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const repo='jr203pavelvictor-droid/Montazhopa',root=path.resolve(__dirname,'..'),panel=path.join(root,'com.victor.motionviewer');fs.mkdirSync(path.join(root,'test-results'),{recursive:true});const home=fs.mkdtempSync(path.join(root,'test-results','published-'));
 const expected=process.env.ALTO_VERIFY_VERSION||require('../version.json').version;
 const ctx={console,process,Buffer,URL,setTimeout,clearTimeout,fetch:(url,opts)=>fetch(url,Object.assign({},opts,{signal:AbortSignal.timeout(60000)})),MZ_VERSION:'0.0.0'};ctx.window=ctx;ctx.require=n=>n==='os'?Object.assign({},os,{homedir:()=>home}):require(n);vm.createContext(ctx);
 for(const name of ['local.js','github-releases.js'])vm.runInContext(fs.readFileSync(path.join(panel,name),'utf8'),ctx);
 let release;for(let attempt=0;attempt<10;attempt++){release=await ctx.MZLocal.checkRepository(repo,true,true);if(release&&release.version===expected)break;await new Promise(resolve=>setTimeout(resolve,3000));}assert.equal(release&&release.version,expected);
 const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200,url);return Buffer.from(await r.arrayBuffer());};
 const zip=await get(release.url),sha=await get(release.url+'.sha256');const digest=crypto.createHash('sha256').update(zip).digest('hex');assert.equal(digest,sha.toString('utf8').trim().split(/\s+/)[0]);if(release.digest)assert.equal(release.digest,'sha256:'+digest);
 const target=path.join(home,'extensions','com.victor.motionviewer');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'previous.txt'),'unchanged');
 const staged=await ctx.MZLocal.downloadRelease(release,repo,true,target);assert.equal(staged.version,expected);assert.equal(fs.readFileSync(path.join(target,'previous.txt'),'utf8'),'unchanged');
 const output=path.join(root,'dist','published');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'Montazhopa_'+expected+'.zip'),zip);fs.writeFileSync(path.join(output,'Montazhopa_'+expected+'.zip.sha256'),sha);
 const report={version:release.version,release:release.htmlUrl,archive:release.url,bytes:zip.length,sha256:digest,updaterDetection:true,updaterDownloadAndStaging:true,livePremiere:false};fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
