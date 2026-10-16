"""Export validated lyric phrases without inventing or repairing word timings."""
import json
import math


def write_snapshot(data, destination, allow_incomplete=False):
    snapshot = dict(data['provenance'])
    snapshot.pop('seconds')
    snapshot['coverage'] = dict(data['coverage'])
    snapshot['lines'] = []
    rejected = []
    previous_end = 0
    for segment in data['segments']:
        text, timings = [], []
        invalid = None
        phrase_end = previous_end
        for word in segment['words']:
            spelling = word['word'].strip()
            start, end = word['start'], word['end']
            if len(spelling.split()) != 1 or not math.isfinite(start) or not math.isfinite(end) or start < phrase_end or end <= start or end > snapshot['audioDuration']:
                invalid = f'Invalid word interval; review alignment before export: {word}'
                break
            text.append(spelling)
            timings.extend([start, end])
            phrase_end = end
        if invalid or not text:
            if not allow_incomplete:
                raise ValueError(invalid or 'Cannot export an empty lyric phrase')
            rejected.append(segment['text'].strip())
            continue
        previous_end = phrase_end
        snapshot['lines'].append({'text': ' '.join(text), 'timings': timings})
    if not snapshot['lines']:
        raise ValueError('No performed phrases detected')
    snapshot['coverage']['rejectedTimingPhrases'] = len(rejected)
    if rejected:
        snapshot['rejectedTimingPhrases'] = rejected
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False)+'\n')
