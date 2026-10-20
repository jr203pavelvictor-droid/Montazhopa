#!/usr/bin/env python3
"""Deterministic release ZIP compatible with Montazhopa 3.0 beta 1's updater."""
from pathlib import Path
import hashlib
import json
import re
import stat
import subprocess
import zipfile
import xml.etree.ElementTree as ET

from bundle_host import bundle as bundle_host

ROOT=Path(__file__).resolve().parent.parent
def build():
    meta=json.loads((ROOT/'version.json').read_text(encoding='utf-8-sig'))
    version=meta['version'];bundle=meta['bundleId']
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?',version):raise ValueError('Invalid version')
    panel=ROOT/bundle
    if f"window.MZ_VERSION='{version}'" not in (panel/'app.js').read_text(encoding='utf-8-sig'):raise ValueError('app.js version differs from version.json')
    manifest=ET.parse(panel/'CSXS/manifest.xml').getroot()
    if manifest.attrib['ExtensionBundleVersion']!=version.split('-')[0]:raise ValueError('CEP version differs')
    if manifest.attrib['ExtensionBundleId']!=bundle:raise ValueError('Bundle ID differs')
    if f"version:'{version}'" not in (panel/'jsx/host.jsx').read_text(encoding='utf-8-sig'):raise ValueError('JSX version differs')
    bundle_host(panel)
    subprocess.run(['node',str(ROOT/'tests/es3-parse.cjs'),str(panel/'jsx/host.bundle.jsx')],check=True)
    subprocess.run(['node',str(ROOT/'tests/cep-startup.cjs')],check=True)
    subprocess.run(['node',str(ROOT/'tests/update-paths.cjs')],check=True)
    for js in sorted(panel.rglob('*.js')):
        subprocess.run(['node','--check',str(js)],check=True,capture_output=True)
    files={p.relative_to(panel).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(panel.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'}
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    package={f'{bundle}/{name}':(panel/name).read_bytes() for name in files}
    package['update-manifest.json']=(json.dumps({'format':'montazhopa-update','schemaVersion':1,'bundleId':bundle,'version':version,'files':files},indent=2)+'\n').encode()
    for name in ['INSTALL_WINDOWS.cmd','INSTALL_WINDOWS.ps1','INSTALL_MAC.command','SETUP_LOCAL_TOOLS_WINDOWS.cmd','SETUP_LOCAL_TOOLS_MAC.command','START_HERE_RU.md','GITHUB_RU.md','VALIDATION.md','LOCAL_TOOLS_RU.md','THIRD_PARTY_NOTICES.md','CHANGELOG.md','FEATURES.md','LICENSE','version.json','tools/setup_local.py','docs/ITERATION_1_RU.md','docs/ALTO_4_0_CHANGELOG.md','docs/ALTO_4_0_BRAND.md','docs/ALTO_4_0_QA.md','docs/ALTO_4_0_MASTER_PLAN_RU.md','docs/ALTO_4_0_RELEASE_RU.md']:
        package[name]=(ROOT/name).read_bytes()
    package['docs/ALTO_4_0_WORKFLOW_RU.md']=(ROOT/'docs/ALTO_4_0_WORKFLOW_RU.md').read_bytes()
    package['checksums.sha256']=''.join(f'{digest}  {bundle}/{name}\n' for name,digest in files.items()).encode()
    out=dist/('Montazhopa_'+version+'.zip')
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,data in sorted(package.items()):
            entry=zipfile.ZipInfo('Montazhopa_'+version+'/'+name,date_time=(2026,10,18,9,0,0))
            entry.compress_type=zipfile.ZIP_DEFLATED
            entry.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.command') else 0o644))<<16
            archive.writestr(entry,data)
    with zipfile.ZipFile(out) as z:
        if z.testzip():raise ValueError('Corrupt release archive')
    digest=hashlib.sha256(out.read_bytes()).hexdigest()
    out.with_suffix('.zip.sha256').write_text(digest+'  '+out.name+'\n',encoding='utf-8')
    print(json.dumps({'version':version,'archive':str(out),'bytes':out.stat().st_size,'runtime_files':len(files),'sha256':digest}))
    return out
if __name__=='__main__':build()
