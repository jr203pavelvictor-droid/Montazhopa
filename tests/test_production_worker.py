import tempfile
import unittest
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

WORKER = Path(__file__).resolve().parent.parent / 'com.victor.motionviewer' / 'worker'
sys.path.insert(0, str(WORKER))
from main import handle
from opencut.core.silence import TimeSegment


class ProductionWorkerTests(unittest.TestCase):
    def test_silence_keeps_separate_speech_padding_and_source_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            media = Path(folder) / 'speech.wav'
            media.write_bytes(b'fixture for adapter validation')
            captured = []

            def detect(path, config, **kwargs):
                captured.append((config.padding_before, config.padding_after))
                return [TimeSegment(.2, 1.8, 'speech')]

            with patch('opencut.utils.media.probe', return_value=SimpleNamespace(has_audio=True, duration=2)), \
                    patch('opencut.core.silence.detect_speech', side_effect=detect):
                result = handle({'op': 'silence', 'path': str(media), 'paddingBefore': .07,
                                 'paddingAfter': .31, 'threshold': -35, 'minPause': .4})
            self.assertEqual(captured, [(.07, .31)])
            self.assertIsInstance(result['source']['mtime_ns'], str)
            self.assertTrue(handle({'op': 'validate_source', 'path': str(media),
                                    'source': result['source']})['valid'])
            media.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'Source changed'):
                handle({'op': 'validate_source', 'path': str(media), 'source': result['source']})


if __name__ == '__main__':
    unittest.main()
