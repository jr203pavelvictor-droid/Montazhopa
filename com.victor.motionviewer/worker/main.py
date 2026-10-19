"""One JSON request on stdin, one JSON result on stdout. Local processes only."""
import sys
import json
import os
import math
import uuid
import importlib.util
from pathlib import Path

def finite(value, low, high):
    n = float(value)
    if not math.isfinite(n) or not low <= n <= high:
        raise ValueError(f'Value must be between {low} and {high}')
    return n

def media_path(value):
    p = Path(value).expanduser().resolve(strict=True)
    if not p.is_file():
        raise ValueError('Choose a media file')
    return str(p)

def output_path(suffix):
    root = Path(os.environ['MZ_DATA_DIR']) / 'exports'
    root.mkdir(parents=True, exist_ok=True)
    return str(root / ('MZ-' + uuid.uuid4().hex[:12] + suffix))

def clean_segments(values, duration):
    from opencut.core.silence import TimeSegment
    if not isinstance(values, list) or not values or len(values) > 10000:
        raise ValueError('Choose at least one interval, up to 10000')
    result = []
    for v in values:
        a = finite(v['start'], 0, duration)
        b = finite(v['end'], 0, duration)
        if b <= a:
            raise ValueError('Interval end must be after start')
        result.append(TimeSegment(a, b, 'speech'))
    result.sort(key=lambda s: s.start)
    if any(b.start < a.end - 0.001 for a, b in zip(result, result[1:])):
        raise ValueError('Intervals overlap')
    return result

def srt_text(segments):
    def stamp(t):
        ms = round(finite(t, 0, 864000) * 1000)
        h, ms = divmod(ms, 3600000)
        m, ms = divmod(ms, 60000)
        s, ms = divmod(ms, 1000)
        return f'{h:02}:{m:02}:{s:02},{ms:03}'
    blocks = []
    previous = 0
    for i, v in enumerate(segments):
        start, end = float(v['start']), float(v['end'])
        if end <= start or start < previous:
            raise ValueError('Invalid or overlapping subtitle intervals')
        previous = end
        text = str(v['text']).strip().replace('\r', '').replace('\x00', '')
        if len(text) > 4000:
            raise ValueError('Subtitle is too long')
        if text:
            blocks.append(f'{len(blocks)+1}\n{stamp(start)} --> {stamp(end)}\n{text}\n')
    return '\n'.join(blocks)

def handle(r):
    op = r.get('op')
    if op == 'doctor':
        import shutil
        from opencut.helpers import get_ffmpeg_path, get_ffprobe_path
        tools = {}
        for key, resolver in [('ffmpeg', get_ffmpeg_path), ('ffprobe', get_ffprobe_path)]:
            try:
                import subprocess
                p = resolver()
                v = subprocess.run([p, '-version'], capture_output=True, text=True, timeout=10)
                tools[key] = {'ok': v.returncode == 0, 'path': p}
            except Exception as e:
                tools[key] = {'ok': False, 'error': str(e)}
        return {'python': sys.version.split()[0], 'tools': tools,
                'asr': importlib.util.find_spec('faster_whisper') is not None}
    if op == 'srt':
        p = output_path('.srt')
        Path(p).write_text(srt_text(r['segments']), encoding='utf-8-sig')
        return {'path': p}
    if op == 'repeats':
        from opencut.core.repeat_detect import detect_repeated_takes
        return detect_repeated_takes(r['segments'], threshold=finite(r.get('threshold', .6), .1, 1))
    f = media_path(r['path'])
    if op == 'validate_source':
        expected = r['source']
        stat = Path(f).stat()
        if (expected.get('path') != f or expected.get('size') != stat.st_size
                or str(expected.get('mtime_ns')) != str(stat.st_mtime_ns)):
            raise ValueError('Source changed since analysis; analyze again')
        return {'valid': True}
    from opencut.utils.media import probe
    info = probe(f)
    if not info.has_audio:
        raise ValueError('The file has no audio stream')
    if op == 'preview_audio':
        import subprocess
        from opencut.helpers import get_ffmpeg_path
        p = output_path('.wav')
        try:
            subprocess.run([get_ffmpeg_path(), '-nostdin', '-v', 'error', '-i', f,
                            '-vn', '-c:a', 'pcm_s16le', p], check=True,
                           capture_output=True, timeout=600)
        except Exception:
            Path(p).unlink(missing_ok=True)
            raise
        return {'path': p}
    if op == 'silence':
        from opencut.core.silence import detect_speech
        from opencut.utils.config import SilenceConfig
        cfg = SilenceConfig(threshold_db=finite(r.get('threshold', -35), -90, -5),
                            min_duration=finite(r.get('minPause', .4), .05, 10),
                            padding_before=finite(r.get('paddingBefore', r.get('padding', .1)), 0, 1),
                            padding_after=finite(r.get('paddingAfter', r.get('padding', .1)), 0, 1))
        segments = detect_speech(f, config=cfg, file_duration=info.duration, method='energy')
        stat = Path(f).stat()
        return {'duration': info.duration, 'segments': [{'start': s.start, 'end': s.end} for s in segments],
                'source': {'path': f, 'size': stat.st_size, 'mtime_ns': str(stat.st_mtime_ns)}}
    if op == 'xml':
        expected = r.get('source')
        if expected:
            stat = Path(f).stat()
            if (expected.get('path') != f or expected.get('size') != stat.st_size
                    or str(expected.get('mtime_ns')) != str(stat.st_mtime_ns)):
                raise ValueError('Source changed since analysis; analyze again')
        from opencut.export.premiere import export_premiere_xml
        from opencut.utils.config import ExportConfig
        segments = clean_segments(r['segments'], info.duration)
        p = output_path('.xml')
        export_premiere_xml(f, segments, p, ExportConfig(sequence_name='MZ / ' + Path(f).stem))
        return {'path': p, 'duration': sum(s.duration for s in segments)}
    if op == 'transcribe':
        model = Path(r.get('model', '')).expanduser()
        if not model.is_dir() or not (model / 'model.bin').is_file():
            raise ValueError('Choose a local faster-whisper model folder containing model.bin')
        # Offline even if an upstream path accidentally tries a model lookup.
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
        from opencut.core.captions import _transcribe_faster_whisper, transcription_result_to_dict
        from opencut.core.audio import extract_audio_wav
        from opencut.utils.config import CaptionConfig
        language = r.get('language') or None
        if language not in (None, 'ru', 'ro', 'en'):
            raise ValueError('Supported language choices: auto, ru, ro, en')
        wav = extract_audio_wav(f)
        try:
            result = _transcribe_faster_whisper(wav, CaptionConfig(model=str(model.resolve()), language=language))
            return transcription_result_to_dict(result)
        finally:
            Path(wav).unlink(missing_ok=True)
    raise ValueError('Unknown worker operation')

if __name__ == '__main__':
    try:
        if sys.version_info < (3, 11):
            raise RuntimeError('Python 3.11 or newer is required')
        req = json.loads(sys.stdin.read(8 * 1024 * 1024))
        result = {'ok': True, 'result': handle(req)}
    except Exception as exc:
        result = {'ok': False, 'error': str(exc)}
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
