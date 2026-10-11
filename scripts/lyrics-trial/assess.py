"""Report suspect word timings without repairing or inventing timestamps."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('alignment', type=Path)
parser.add_argument('--audio', type=Path, default=Path('public/music/The Blight Treant.mp3'))
args = parser.parse_args()
data = json.loads(args.alignment.read_text())
words = [word for segment in data['segments'] for word in segment['words']]
issues = []
for segment in data['segments']:
    for before, after in zip(segment['words'], segment['words'][1:]):
        if after['start'] - before['end'] > 4:
            issues.append({'line': segment['text'], 'start': before['end'], 'end': after['start'], 'reasons': ['gap over four seconds inside a lyric line']})
previous_end = 0
for word in words:
    start, end = word['start'], word['end']
    reasons = []
    if end <= start:
        reasons.append('zero duration')
    if end-start > 5:
        reasons.append('longer than five seconds; review held note or instrumental gap')
    if start < previous_end-0.02:
        reasons.append('overlapping previous word')
    if start < 0 or end > data['provenance']['audioDuration']:
        reasons.append('outside recording')
    if reasons:
        issues.append({'word': word['word'], 'start': start, 'end': end, 'reasons': reasons})
    previous_end = end
print(json.dumps({'words': len(words), 'lines': len(data['segments']), 'issues': issues, 'provenance': data['provenance']}, indent=2))
if hashlib.sha256(args.audio.read_bytes()).hexdigest() != data['provenance']['audioSha256']:
    raise SystemExit('Recording hash mismatch')
