MZ.audioDestination=function(trackIndex,duration){try{
 var seq=app.project.activeSequence;if(!seq)throw Error('Open a sequence');duration=AltoTimeline.number(duration,.001,86400,'audio duration');trackIndex=AltoTimeline.number(trackIndex,0,seq.audioTracks.numTracks-1,'audio track');if(trackIndex%1)throw Error('Invalid track');
 var track=seq.audioTracks[trackIndex];if(track.isLocked())throw Error('Audio track locked');var at=VMV.seconds(seq.getPlayerPosition()),clips=[];
 for(var i=0;i<track.clips.numItems;i++){var c=track.clips[i],a=VMV.seconds(c.start),b=VMV.seconds(c.end);if(a<at+duration&&b>at)throw Error('MZ_TRACK_OCCUPIED');clips.push([String(c.nodeId),a,b]);}
 return VMV.encode({ok:true,token:VMV.encode({project:MZ.projectKey(),sequence:String(seq.sequenceID),track:trackIndex,at:at,duration:duration,clips:clips})});
 }catch(e){return VMV.encode({ok:false,error:String(e.message||e)});}};
MZ.insertAudioRange=function(path,trackIndex,token,duration){var added=null,fresh=[],seq=null,track=null;try{
 var check=MZJSON.parse(MZ.audioDestination(trackIndex,duration));if(!check.ok)throw Error(check.error);if(check.token!==token)throw Error('Audio destination changed. Check the track and retry.');
 seq=app.project.activeSequence;track=seq.audioTracks[trackIndex];var before={},i;for(i=0;i<track.clips.numItems;i++)before[String(track.clips[i].nodeId)]=true;
 var result=null,insertError=null;try{result=MZJSON.parse(MZ.insertMedia(path,trackIndex,true));}catch(ie){insertError=ie;}
 for(i=0;i<track.clips.numItems;i++)if(!before[String(track.clips[i].nodeId)])fresh.push(track.clips[i]);
 if(insertError)throw insertError;if(!result.ok)throw Error(result.error);
 if(fresh.length!==1)throw Error('Premiere did not confirm exactly one inserted audio clip');added=fresh[0];
 var expected=MZJSON.parse(token),frame=Number(seq.timebase)/VMV.TICKS;
 if(Math.abs(VMV.seconds(added.start)-expected.at)>frame/4||Math.abs(VMV.seconds(added.end)-VMV.seconds(added.start)-duration)>frame||!added.projectItem||String(new File(added.projectItem.getMediaPath()).fsName)!==String(new File(path).fsName))throw Error('Inserted audio readback failed');
 return VMV.encode({ok:true,nodeId:String(added.nodeId),duration:VMV.seconds(added.end)-VMV.seconds(added.start)});
 }catch(e){var remaining=0;for(var r=fresh.length-1;r>=0;r--){var clip=fresh[r];try{var id=String(clip.nodeId);clip.remove(false,false);for(var k=0;k<track.clips.numItems;k++)if(String(track.clips[k].nodeId)===id)remaining++;}catch(re){remaining++;}}return VMV.encode({ok:false,error:String(e.message||e),remainingClips:remaining});}};
