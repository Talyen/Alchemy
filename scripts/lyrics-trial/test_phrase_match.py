"""Regression checks for performed repeats, omissions, and instrumental gaps."""
import unittest

from phrase_match import match_phrases


def heard(text, start=0):
    return [{'word': word, 'start': start+i*.4, 'end': start+i*.4+.3} for i, word in enumerate(text.split())]


class PhraseMatchingTests(unittest.TestCase):
    def test_repeats_follow_recording_and_omitted_intro_is_not_forced(self):
        phrases = ['Unheard introductory words here', 'Set the match', 'light the pyre']
        words = heard('Set the match light the pyre Set the match')
        matches, unmatched = match_phrases(phrases, words)
        self.assertEqual([m['text'] for m in matches], [phrases[1], phrases[2], phrases[1]])
        self.assertEqual(unmatched, [])

    def test_instrumental_gap_cannot_stretch_a_phrase(self):
        words = heard('it grows')+heard('a second scar', 20)
        matches, unmatched = match_phrases(['it grows a second scar'], words)
        self.assertEqual(matches, [])
        self.assertEqual(unmatched, words)

    def test_unrelated_asr_is_reported_and_canonical_spelling_survives(self):
        words = heard('Let the blind fungus char nonsense unrelated speech')
        matches, unmatched = match_phrases(['Let the blight-fungus char.'], words)
        self.assertEqual([m['text'] for m in matches], ['Let the blight-fungus char.'])
        self.assertEqual([w['word'] for w in unmatched], ['nonsense', 'unrelated', 'speech'])


if __name__ == '__main__':
    unittest.main()
