/* QE still export is read-only with respect to the project. The receipt is
 * verified against a real PNG, never against the exporter's boolean result. */
MZ.frameCaptures={};
MZ.captureTimelineFrame=function(){
 var ticket=null;
 try{
  var seq=app.project.activeSequence;if(!seq)throw Error('MZ_FRAME_NO_SEQUENCE');
  var width=Number(seq.frameSizeHorizontal),height=Number(seq.frameSizeVertical),position=seq.getPlayerPosition();
  if(!(width>0&&height>0)||width*height>80000000)throw Error('MZ_FRAME_DIMENSIONS');
  var parent=new Folder(Folder.userData.fsName+'/Montazhopa3');if(!parent.exists&&!parent.create())throw Error('MZ_FRAME_FOLDER');
  var folder=new Folder(parent.fsName+'/frame-cache');if(!folder.exists&&!folder.create())throw Error('MZ_FRAME_FOLDER');
  ticket=String(new Date().getTime())+'-'+String(Math.floor(Math.random()*1000000000));
  var base=folder.fsName+'/mz-frame-'+ticket;
  // No user-defined filenames or arbitrary output paths cross this boundary.
  var receipt={ticket:ticket,base:base,sequenceID:String(seq.sequenceID),name:String(seq.name||''),ticks:String(position.ticks),width:width,height:height,timecode:'',exportError:'',created:new Date().getTime()};
  MZ.frameCaptures[ticket]=receipt;
  try{
   app.enableQE();var q=qe.project.getActiveSequence();
   if(!q||typeof q.exportFramePNG!=='function'||!q.CTI||!q.CTI.timecode)throw Error('MZ_FRAME_UNSUPPORTED');
   if(q.name&&seq.name&&String(q.name)!==String(seq.name))throw Error('MZ_FRAME_SEQUENCE_CHANGED');
   receipt.timecode=String(q.CTI.timecode);
   // Adobe's QE sample convention: timecode first, destination basename second.
   // Some builds return false even when a PNG is produced. No blind retry and
   // no guessed public sequence.exportFramePNG / GUI keystrokes / AME dialogs.
   q.exportFramePNG(receipt.timecode,base);
  }catch(exportError){receipt.exportError=String(exportError.message||exportError);}
  if(receipt.exportError==='MZ_FRAME_UNSUPPORTED'||receipt.exportError==='MZ_FRAME_SEQUENCE_CHANGED')throw Error(receipt.exportError);
  return MZ.pollTimelineFrame(ticket);
 }catch(e){if(ticket)MZ.discardTimelineFrame(ticket);return VMV.encode({ok:false,error:String(e.message||e)});}
};
MZ.pollTimelineFrame=function(ticket){
 try{
  if(!/^[0-9]+-[0-9]+$/.test(String(ticket)))throw Error('MZ_FRAME_TICKET');
  var r=MZ.frameCaptures[String(ticket)];if(!r)throw Error('MZ_FRAME_TICKET');
  var seq=app.project.activeSequence;
  if(!seq||String(seq.sequenceID)!==r.sequenceID||String(seq.getPlayerPosition().ticks)!==r.ticks)throw Error('MZ_FRAME_SEQUENCE_CHANGED');
  var candidates=[r.base+'.png',r.base,r.base+'.png.png'],file=null;
  for(var i=0;i<candidates.length;i++){var candidate=new File(candidates[i]);if(candidate.exists&&candidate.length>=24){file=candidate;break;}}
  if(!file){if(new Date().getTime()-r.created>5000)throw Error('MZ_FRAME_EXPORT_FAILED'+(r.exportError?': '+r.exportError:''));return VMV.encode({ok:true,pending:true,ticket:r.ticket});}
  if(file.length>20*1024*1024)throw Error('MZ_FRAME_TOO_LARGE');
  file.encoding='BINARY';if(!file.open('r'))throw Error('MZ_FRAME_READ');var header;
  try{header=file.read(24);}finally{file.close();}
  var signature=[137,80,78,71,13,10,26,10];for(i=0;i<signature.length;i++)if((header.charCodeAt(i)&255)!==signature[i])throw Error('MZ_FRAME_INVALID_PNG');
  function uint32(at){var n=0;for(var j=0;j<4;j++)n=n*256+(header.charCodeAt(at+j)&255);return n;}
  if(uint32(16)!==r.width||uint32(20)!==r.height)throw Error('MZ_FRAME_DIMENSIONS');
  return VMV.encode({ok:true,ticket:r.ticket,path:file.fsName,width:r.width,height:r.height,sequenceID:r.sequenceID,name:r.name,ticks:r.ticks,timecode:r.timecode});
 }catch(e){MZ.discardTimelineFrame(ticket);return VMV.encode({ok:false,error:String(e.message||e)});}
};
MZ.discardTimelineFrame=function(ticket){
 if(!/^[0-9]+-[0-9]+$/.test(String(ticket)))return VMV.encode({ok:true});
 var r=MZ.frameCaptures[String(ticket)];if(!r)return VMV.encode({ok:true});
 // Delete only the three exact private paths belonging to this capture ticket.
 var candidates=[r.base+'.png',r.base,r.base+'.png.png'];for(var i=0;i<candidates.length;i++)try{var f=new File(candidates[i]);if(f.exists)f.remove();}catch(ignore){}
 delete MZ.frameCaptures[String(ticket)];return VMV.encode({ok:true});
};
