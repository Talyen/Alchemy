"""Export validated lyric phrases without inventing or repairing word timings."""
import json
import math
from copy import deepcopy
from collections import Counter
import re


def normalized(text):
    return re.findall(r"[a-z]+", text.lower())


def validate_timeline(lines, duration):
    previous_end = 0
    for line in lines:
        timings = line['timings']
        if not line['text'].split() or len(timings) != len(line['text'].split())*2:
            raise ValueError('Lyric spelling and timing counts disagree')
        for start, end in zip(timings[::2], timings[1::2]):
            if not math.isfinite(start) or not math.isfinite(end) or start < previous_end or end <= start or end > duration:
                raise ValueError('Invalid or overlapping lyric word interval')
            previous_end = end


def merge_recovery(snapshot, region, lines):
    """Replace selected phrases in one search window, preserving other passages."""
    result = deepcopy(snapshot)
    validate_timeline(lines, snapshot['audioDuration'])
    if any(line['timings'][0] < region['start'] or line['timings'][-1] > region['end'] for line in lines):
        raise ValueError('Recovered phrase escaped its search window')
    removed = [old for old in result['lines'] if any(
        normalized(old['text']) == normalized(new['text'])
        and old['timings'][0] < new['timings'][-1] and old['timings'][-1] > new['timings'][0]
        for new in lines
    )]
    replaced = Counter(tuple(normalized(line['text'])) for line in removed)
    selected = Counter(tuple(normalized(line['text'])) for line in lines)
    if any(count > selected[identity] for identity, count in replaced.items()):
        raise ValueError('Recovery would remove additional performed phrase occurrences')
    kept = [line for line in result['lines'] if line not in removed]
    combined = sorted(kept+deepcopy(lines), key=lambda line: line['timings'][0])
    # Validate the combined result: a context word must not steal time from a
    # neighboring phrase that was not selected for replacement.
    validate_timeline(combined, snapshot['audioDuration'])
    result['lines'] = combined
    rejected = result.get('rejectedTimingPhrases', [])
    for line in lines:
        identity = tuple(normalized(line['text']))
        if replaced[identity]:
            replaced[identity] -= 1
            continue
        index = next((i for i, text in enumerate(rejected) if normalized(text) == normalized(line['text'])), None)
        if index is not None:
            rejected.pop(index)
    if rejected:
        result['rejectedTimingPhrases'] = rejected
    else:
        result.pop('rejectedTimingPhrases', None)
    result['coverage']['rejectedTimingPhrases'] = len(rejected)
    return result


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
