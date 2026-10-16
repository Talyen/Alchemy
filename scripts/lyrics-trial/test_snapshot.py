"""Protect reviewed snapshots from failed alignment and account for omissions."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from snapshot import write_snapshot


def alignment():
    return {
        'provenance': {'audioSha256': 'recording', 'audioDuration': 10, 'seconds': 1},
        'coverage': {'detectedPhrases': 3},
        'segments': [
            {'text': 'First', 'words': [{'word': ' First', 'start': 0, 'end': 1}]},
            {'text': 'Missing word', 'words': [
                {'word': ' Missing', 'start': 1, 'end': 2},
                {'word': ' word', 'start': 2, 'end': 2},
            ]},
            {'text': 'Last', 'words': [{'word': ' Last', 'start': 3, 'end': 4}]},
        ],
    }


class SnapshotTests(unittest.TestCase):
    def test_failed_alignment_preserves_existing_snapshot(self):
        with TemporaryDirectory() as directory:
            output = Path(directory)/'snapshot.json'
            output.write_text('previously reviewed snapshot')
            with self.assertRaises(ValueError):
                write_snapshot(alignment(), output)
            self.assertEqual(output.read_text(), 'previously reviewed snapshot')

    def test_incomplete_export_accounts_for_the_entire_rejected_phrase(self):
        with TemporaryDirectory() as directory:
            output = Path(directory)/'snapshot.json'
            write_snapshot(alignment(), output, allow_incomplete=True)
            snapshot = json.loads(output.read_text())
            self.assertEqual(snapshot['lines'], [
                {'text': 'First', 'timings': [0, 1]},
                {'text': 'Last', 'timings': [3, 4]},
            ])
            self.assertEqual(snapshot['rejectedTimingPhrases'], ['Missing word'])
            self.assertEqual(snapshot['coverage']['rejectedTimingPhrases'], 1)
            self.assertEqual(snapshot['audioSha256'], 'recording')


if __name__ == '__main__':
    unittest.main()
