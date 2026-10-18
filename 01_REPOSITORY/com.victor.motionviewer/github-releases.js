/* Adapted from PR Extension githubReleases.ts (MIT), Georg Miñoza / itGenius.
 * Full original and patch are in third_party; notices ship in licenses/. */
(function(){
 'use strict';
 const VERSION_REGEX=/^(\d+)\.(\d+)\.(\d+)$/;
 function parseSemver(v){const m=v.match(VERSION_REGEX);return m?[Number(m[1]),Number(m[2]),Number(m[3])]:null;}
 function compareSemver(a,b){const pa=parseSemver(a),pb=parseSemver(b);if(!pa||!pb)return 0;for(let i=0;i<3;i++){if(pa[i]>pb[i])return 1;if(pa[i]<pb[i])return -1;}return 0;}
 async function fetchLatestExtensionRelease(repo,includePrerelease){
  const resp=await fetch('https://api.github.com/repos/'+repo+'/releases?per_page=50',{headers:{Accept:'application/vnd.github+json'}});
  if(!resp.ok)throw Error('GitHub HTTP '+resp.status);
  const releases=await resp.json();if(!Array.isArray(releases))throw Error('Invalid GitHub releases response');
  const compare=window.MZLocal.compareVersion;
  const candidates=releases.filter(r=>!r.draft&&(includePrerelease||!r.prerelease)).map(r=>{
   const version=String(r.tag_name||'').replace(/^(?:montazhopa-)?v/,'');
   try{compare(version,version);}catch(e){return null;}
   if(!includePrerelease&&version.includes('-'))return null;
   const asset=(r.assets||[]).find(a=>a.name==='Montazhopa_'+version+'.zip');
   if(!asset)return null;
   return {version,tag:r.tag_name,url:asset.browser_download_url,size:asset.size,digest:asset.digest||'',notes:r.body||'',htmlUrl:r.html_url,publishedAt:r.published_at};
  }).filter(Boolean).sort((a,b)=>compare(b.version,a.version));
  return candidates[0]||null;
 }
 window.MZGithub={parseSemver,compareSemver,fetchLatestExtensionRelease};
}());
