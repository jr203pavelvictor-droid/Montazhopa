const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const client=require('../com.victor.motionviewer/myinstants-client.js');
const fixture='<div class="instant"><button class="small-button" onclick="play(\x27/media/sounds/vine-boom.mp3\x27)"></button><a class="instant-link" href="/en/instant/vine-boom-123/">VINE &amp; BOOM</a></div>'+
'<div class="instant"><button class="small-button" onmousedown="play(\x27/media/sounds/bruh.mp3\x27)"></button><a href="/en/instant/bruh-123/" class="instant-link">Bruh</a></div>';
const sounds=client.parseResults(fixture);
assert.equal(sounds.length,2);
assert.deepEqual(sounds[0],{title:'VINE & BOOM',page:'https://www.myinstants.com/en/instant/vine-boom-123/',mp3:'https://www.myinstants.com/media/sounds/vine-boom.mp3'});
assert.equal(sounds[1].title,'Bruh');
assert.equal(client.searchUrl('vine boom'),'https://www.myinstants.com/en/search/?name=vine%20boom');
for(const url of ['http://www.myinstants.com/media/sounds/a.mp3','https://evil.example/media/sounds/a.mp3','https://www.myinstants.com.evil.example/media/sounds/a.mp3','https://www.myinstants.com/media/sounds/evil.mp3?x=1','https://www.myinstants.com/media/img/foo.mp3']){
  assert.throws(()=>client.safeUrl(url,'mp3'),/Unexpected/);
}
assert.equal(client.safeName('   M:etal <Pipe> ?  '),'M etal Pipe');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'alto-mi-'));
try {
 const data=Buffer.from([0x49,0x44,0x33,0,0,0]);
 const one=client.save(data,temp,'Bruh');
 const two=client.save(data,temp,'Bruh');
 assert.equal(path.basename(one),'Bruh.mp3');
 assert.equal(path.basename(two),'Bruh (2).mp3');
 assert.deepEqual(fs.readFileSync(one),data);
 assert.deepEqual(fs.readFileSync(two),data);
 assert.throws(()=>client.save(data,path.join(temp,'missing'),'Bruh'));
} finally {fs.rmSync(temp,{recursive:true,force:true});}
console.log('PASS: Myinstants parser, URLs, filenames, duplicate-safe saving');
