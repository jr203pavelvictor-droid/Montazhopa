import unittest
import tempfile
import sys
import json
import os
import subprocess
import wave
import math
import struct
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
WORKER=ROOT/'com.victor.motionviewer/worker'
sys.path.insert(0,str(WORKER))
from main import srt_text,clean_segments
from opencut.core.repeat_detect import detect_repeated_takes

class WorkerTests(unittest.TestCase):
    def test_srt_unicode_and_timestamp_rounding(self):
        text=srt_text([{'start':59.9996,'end':62,'text':'Привет, România!'}])
        self.assertIn('00:01:00,000 --> 00:01:02,000',text)
        self.assertIn('Привет, România!',text)

    def test_rejects_overlapping_and_nonfinite_ranges(self):
        for ranges in [[{'start':0,'end':2},{'start':1,'end':3}],[{'start':float('nan'),'end':2}],[{'start':3,'end':2}]]:
            with self.assertRaises(ValueError):clean_segments(ranges,10)

    def test_repeated_russian_phrase(self):
        r=detect_repeated_takes([{'start':0,'end':1,'text':'Это наш повторный дубль'},{'start':1.3,'end':3,'text':'Это наш повторный дубль'}])
        self.assertEqual(len(r['repeats']),1)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg not installed')
    def test_real_silence_worker_and_valid_xml(self):
        with tempfile.TemporaryDirectory() as temp:
            media=Path(temp)/'тест # audio.wav';rate=16000
            with wave.open(str(media),'wb') as w:
                w.setparams((1,2,rate,0,'NONE','not compressed'))
                pcm=[]
                for i in range(4*rate):
                    t=i/rate;active=.5<=t<1.5 or 2<=t<3
                    pcm.append(struct.pack('<h',int(16000*math.sin(2*math.pi*440*t)) if active else 0))
                w.writeframes(b''.join(pcm))
            env=dict(os.environ,MZ_DATA_DIR=temp,PYTHONDONTWRITEBYTECODE='1')
            def run(data):
                p=subprocess.run([sys.executable,str(WORKER/'main.py')],input=json.dumps(data),capture_output=True,text=True,env=env,timeout=30)
                result=json.loads(p.stdout);self.assertTrue(result['ok'],result);return result['result']
            r=run({'op':'silence','path':str(media),'threshold':-35,'minPause':.3,'padding':0})
            self.assertEqual(len(r['segments']),2)
            self.assertAlmostEqual(r['segments'][0]['start'],.5,places=2)
            out=run({'op':'xml','path':str(media),'segments':r['segments']})
            xml=ET.parse(out['path']);self.assertEqual(xml.getroot().tag,'xmeml')
            self.assertIn('%23',xml.findtext('.//pathurl'))
            self.assertTrue(xml.findall('.//clipitem'))
            self.assertAlmostEqual(out['duration'],2,places=2)

    @unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg not installed')
    def test_ffmpeg_failure_is_error_not_empty_cut(self):
        from opencut.core.silence import detect_silences
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'broken.wav';p.write_bytes(b'not audio')
            with self.assertRaises(RuntimeError):detect_silences(str(p),file_duration=4)

if __name__=='__main__':unittest.main()
