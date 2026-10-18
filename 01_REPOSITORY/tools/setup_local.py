#!/usr/bin/env python3
"""Optional user-run setup. No administrator install; media is never uploaded."""
import argparse
import json
import os
import platform
import subprocess
import sys
import venv
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--ai',action='store_true',help='Download/install faster-whisper into a per-user venv')
    ap.add_argument('--model',choices=['tiny','base','small','medium'],help='Explicitly download this Whisper model')
    ap.add_argument('--ffmpeg',help='Path to an existing ffmpeg executable')
    ap.add_argument('--ffprobe',help='Path to an existing ffprobe executable')
    args=ap.parse_args()
    if sys.version_info < (3,11):raise SystemExit('Install Python 3.11+ first: https://www.python.org/downloads/')
    base=Path(os.environ.get('APPDATA',str(Path.home()/'AppData/Roaming'))) if os.name=='nt' else Path.home()/('Library/Application Support' if sys.platform=='darwin' else '.local/share')
    root=base/'Montazhopa3';root.mkdir(parents=True,exist_ok=True)
    cfgfile=root/'tools.json';cfg=json.loads(cfgfile.read_text()) if cfgfile.exists() else {}
    cfg['python']=str(Path(sys.executable).resolve())
    for key in ('ffmpeg','ffprobe'):
        value=getattr(args,key)
        if value:
            p=Path(value).expanduser().resolve(strict=True)
            subprocess.run([str(p),'-version'],check=True,stdout=subprocess.DEVNULL)
            cfg[key]=str(p)
    if args.ai or args.model:
        print('Downloading Python dependencies into your Montazhopa user folder…')
        env=root/'runtime';venv.EnvBuilder(with_pip=True).create(env)
        py=env/('Scripts/python.exe' if os.name=='nt' else 'bin/python3')
        subprocess.run([str(py),'-m','pip','install','faster-whisper==1.2.1'],check=True)
        cfg['python']=str(py)
        if args.model:
            dest=root/'models'/args.model
            code='from huggingface_hub import snapshot_download; import sys; snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2])'
            subprocess.run([str(py),'-c',code,'Systran/faster-whisper-'+args.model,str(dest)],check=True)
            cfg['model']=str(dest)
    temp=cfgfile.with_suffix('.tmp');temp.write_text(json.dumps(cfg,indent=2),encoding='utf-8');os.replace(temp,cfgfile)
    print('Saved. In Montazhopa open Tools > Local tools > Check availability.')
    if not args.ai and not args.model:
        print('No AI packages or models downloaded. To enable them explicitly:')
        print('python tools/setup_local.py --ai --model small')

if __name__=='__main__':main()
