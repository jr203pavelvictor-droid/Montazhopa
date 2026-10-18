/* Montazhopa CEP adapters. No timeline deletion or positional QE-index guesses. */
MZ.projectContext=function(){try{if(!app.project||!app.project.path)throw Error('Save the Premiere project before enabling watched folders');return VMV.encode({ok:true,key:String(app.project.path)});}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.findBin=function(name,parent){
 parent=parent||app.project.rootItem;var parts=String(name).split(/\s*\/\s*/);
 for(var n=0;n<parts.length;n++){var part=parts[n];if(!part)continue;var next=null;for(var i=0;i<parent.children.numItems;i++){var c=parent.children[i];if(c.type===2&&c.name===part){next=c;break;}}parent=next||parent.createBin(part);if(!parent)throw Error('Cannot create Project bin');}return parent;
};
MZ.mediaIndex=function(){
 var result={};function norm(p){p=String(p).replace(/\\/g,'/');return $.os.toLowerCase().indexOf('windows')>=0?p.toLowerCase():p;}
 function visit(item){if(item.children){for(var i=0;i<item.children.numItems;i++)visit(item.children[i]);}try{var p=item.getMediaPath();if(p)result[norm(p)]=true;}catch(e){}}
 visit(app.project.rootItem);return {items:result,normalise:norm};
};
MZ.importFiles=function(paths,binName){try{
 if(!(paths instanceof Array)||paths.length>200)throw Error('Select up to 200 files');
 var before=MZ.mediaIndex(),clean=[],accepted=[],failed=[];
 for(var i=0;i<paths.length;i++){var f=new File(paths[i]);if(!f.exists||!/\.(mp4|mov|mxf|avi|mkv|wav|mp3|aif|aiff|aac|m4a|png|jpg|jpeg|webp|psd|tif|tiff)$/i.test(f.name)){failed.push(paths[i]);continue;}if(before.items[before.normalise(f.fsName)])accepted.push(paths[i]);else clean.push({path:paths[i],nativePath:f.fsName});}
 if(clean.length){var raw=[];for(i=0;i<clean.length;i++)raw.push(clean[i].nativePath);app.project.importFiles(raw,true,MZ.findBin(binName||'Montazhopa'),false);var after=MZ.mediaIndex();for(i=0;i<clean.length;i++){if(after.items[after.normalise(clean[i].nativePath)])accepted.push(clean[i].path);else failed.push(clean[i].path);}}
 return VMV.encode({ok:true,count:accepted.length,accepted:accepted,failed:failed});
}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.importInterchange=function(path){try{
 var f=new File(path);if(!f.exists||!/\.(xml|srt)$/i.test(f.name))throw Error('Choose an existing XML or SRT export');
 if(!app.project.importFiles([f.fsName],true,MZ.findBin('Montazhopa / Generated'),false))throw Error('Premiere rejected the interchange file');
 return VMV.encode({ok:true});
}catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
