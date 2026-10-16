"""Protect reviewed snapshots from failed alignment and account for omissions."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from snapshot import merge_recovery, write_snapshot


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
    def test_context_edge_does_not_erase_the_previous_identical_lyric(self):
        original = {
            'audioDuration': 150, 'coverage': {'rejectedTimingPhrases': 1},
            'rejectedTimingPhrases': ['singe through hide.'],
            'lines': [{'text': 'singe through hide.', 'timings': [134.38, 135.02, 135.02, 135.18, 135.18, 135.84]}],
        }
        new = {'text': 'singe through hide.', 'timings': [140.04, 140.72, 140.72, 140.86, 140.86, 142.02]}
        result = merge_recovery(original, {'start': 135.8, 'end': 142.04}, [new])
        self.assertEqual(result['lines'], original['lines']+[new])
        self.assertEqual(result['coverage']['rejectedTimingPhrases'], 0)

    def test_one_recovery_cannot_consume_two_performed_repeats(self):
        original = {
            'audioDuration': 10, 'coverage': {},
            'lines': [{'text': 'Forge…', 'timings': [1, 2]}, {'text': 'Forge…', 'timings': [2, 3]}],
        }
        with self.assertRaises(ValueError):
            merge_recovery(original, {'start': 0, 'end': 4}, [{'text': 'Forge…', 'timings': [1.5, 2.5]}])

    def test_recovery_preserves_other_occurrences_and_does_not_claim_their_rejections(self):
        original = {
            'audioDuration': 10, 'coverage': {'rejectedTimingPhrases': 1},
            'rejectedTimingPhrases': ['Forge…'],
            'lines': [
                {'text': 'Forge…', 'timings': [1, 2]},
                {'text': 'Forge…', 'timings': [7, 8]},
            ],
        }
        region = {'start': 0, 'end': 3}
        result = merge_recovery(original, region, [{'text': 'Forge…', 'timings': [1.1, 2.1]}])
        self.assertEqual(result['lines'], [
            {'text': 'Forge…', 'timings': [1.1, 2.1]},
            {'text': 'Forge…', 'timings': [7, 8]},
        ])
        self.assertEqual(result['coverage']['rejectedTimingPhrases'], 1)
        self.assertEqual(original['lines'][0]['timings'], [1, 2])
        result = merge_recovery(result, {'start': 3, 'end': 6}, [{'text': 'Forge…', 'timings': [4, 5]}])
        self.assertNotIn('rejectedTimingPhrases', result)
        self.assertEqual(result['coverage']['rejectedTimingPhrases'], 0)

    def test_recovery_rejects_overlap_with_an_unselected_neighbor(self):
        original = {
            'audioDuration': 10, 'coverage': {},
            'lines': [{'text': 'Other line', 'timings': [1, 2, 2, 3]}],
        }
        with self.assertRaises(ValueError):
            merge_recovery(original, {'start': 0, 'end': 4}, [{'text': 'Recovered', 'timings': [2, 4]}])
        self.assertEqual(original['lines'], [{'text': 'Other line', 'timings': [1, 2, 2, 3]}])

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
