"""Montazhopa's small process adapter; no OpenCut server or downloader."""
import os
import shutil

def resolve_tool(env, fallback):
    value = os.environ.get(env) or shutil.which(fallback)
    if not value:
        raise RuntimeError(f'{fallback} not found. Set its path in Montazhopa > Local tools.')
    return value

def get_ffmpeg_path():
    return resolve_tool('MZ_FFMPEG', 'ffmpeg')

def get_ffprobe_path():
    return resolve_tool('MZ_FFPROBE', 'ffprobe')

def _schedule_temp_cleanup(path):
    try:
        os.unlink(path)
    except OSError:
        pass
