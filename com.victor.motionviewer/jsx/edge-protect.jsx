/* Geometry is read from the public DOM; never assume unknown media fills a sequence. */
MZ.edgeGeometry=function(seq,target,ownedIndex){
 var clip=target.clip,fw=Number(seq.frameSizeHorizontal),fh=Number(seq.frameSizeVertical);
 if(!(fw>0&&fh>0))throw Error('MZ_EDGE_GEOMETRY_UNKNOWN');
 var width=fw,height=fh,par=1,motion=null;
 if(!(clip.isAdjustmentLayer&&clip.isAdjustmentLayer())){
  var item=clip.projectItem;if(!item||!item.getProjectMetadata)throw Error('MZ_EDGE_GEOMETRY_UNKNOWN');
  var metadata=String(item.getProjectMetadata()),field=metadata.match(/<(?:[\w.-]+:)?Column\.Intrinsic\.VideoInfo\b[^>]*>([^<]+)</i);
  if(!field)field=metadata.match(/(?:[\w.-]+:)?Column\.Intrinsic\.VideoInfo\s*=\s*["']([^"']+)["']/i);
  var size=field&&field[1].match(/(\d+)\s*[x\u00d7]\s*(\d+)/i);
  if(!size)throw Error('MZ_EDGE_GEOMETRY_UNKNOWN');width=Number(size[1]);height=Number(size[2]);
  if(item.getFootageInterpretation){var interpretation=item.getFootageInterpretation();if(interpretation&&interpretation.pixelAspectRatio)par=Number(interpretation.pixelAspectRatio);}
 }
 // НЕ ПОДДЕРЖИВАЕТСЯ: alpha holes, Crop, masks, perspective, animated native
 // Motion, non-square pixels, rotated footage and off-center anchors.
 // These change the visible footprint and cannot be inferred from a bounding box.
 if(Math.abs(par-1)>.00001)throw Error('MZ_EDGE_PIXEL_ASPECT');
 if(seq.getSettings){var settings=seq.getSettings();if(settings&&settings.videoPixelAspectRatio&&Math.abs(Number(settings.videoPixelAspectRatio)-1)>.00001)throw Error('MZ_EDGE_PIXEL_ASPECT');}
 for(var i=0;i<clip.components.numItems;i++){var match=String(clip.components[i].matchName);if(match==='AE.ADBE Motion')motion=clip.components[i];if(match==='AE.ADBE Crop'||(match==='AE.ADBE Geometry2'&&i!==ownedIndex))throw Error('MZ_EDGE_STACK_UNSUPPORTED');}
 if(!motion||motion.properties.numItems<6)throw Error('MZ_EDGE_MOTION_UNSUPPORTED');
 var p=motion.properties,indices=[0,1,2,3,4,5];
 for(i=0;i<indices.length;i++)if(p[indices[i]].areKeyframesSupported()&&p[indices[i]].isTimeVarying())throw Error('MZ_EDGE_ANIMATED_MOTION');
 var position=p[0].getValue(),scale=Number(p[1].getValue()),uniform=p[3].getValue(),rotation=Number(p[4].getValue()),anchor=p[5].getValue();
 if((!position||position.length!==2)||(!anchor||anchor.length!==2)||!(scale>0)||Math.abs(rotation%360)>.00001)throw Error('MZ_EDGE_MOTION_UNSUPPORTED');
 var acx=Number(anchor[0]),acy=Number(anchor[1]);
 if(!((Math.abs(acx-.5)<.00001&&Math.abs(acy-.5)<.00001)||(Math.abs(acx-width/2)<.01&&Math.abs(acy-height/2)<.01)))throw Error('MZ_EDGE_ANCHOR_UNSUPPORTED');
 var cx=Number(position[0]),cy=Number(position[1]);if(Math.abs(cx)<=2&&Math.abs(cy)<=2){cx*=fw;cy*=fh;}
 var sx=uniform?scale:Number(p[2].getValue());if(!(sx>0)||!isFinite(cx)||!isFinite(cy))throw Error('MZ_EDGE_MOTION_UNSUPPORTED');
 return {frameW:fw,frameH:fh,width:width*sx/100,height:height*scale/100,cx:cx,cy:cy};
};
MZ.transitionTargets=function(targets,frame){
 if(targets.length!==2)throw Error('MZ_TRANSITION_SELECT_TWO');
 targets.sort(function(a,b){return a.start-b.start;});
 if(targets[0].trackIndex!==targets[1].trackIndex||Math.abs(targets[0].end-targets[1].start)>frame*.1)throw Error('MZ_TRANSITION_NOT_ADJACENT');
 return targets;
};
