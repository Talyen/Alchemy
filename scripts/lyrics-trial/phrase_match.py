"""Conservative phrase matching; ASR supplies time, lyric sheet supplies spelling."""
from difflib import SequenceMatcher
import re

FUNCTION_WORDS = frozenset('a an the i am is are we you it to of and in on my your me what'.split())


def tokens(text):
    return re.findall(r"[a-z]+", text.lower())


def match_phrases(phrases, words, threshold=.67):
    stream = []
    for index, word in enumerate(words):
        for token in tokens(word['word']):
            stream.append((token, index))
    candidates = {}
    for text in phrases:
        target = tokens(text)
        if not target:
            continue
        content = [token for token in target if token not in FUNCTION_WORDS]
        for start in range(len(stream)):
            for length in range(max(min(2, len(target)), round(len(target)*.8)), int(len(target)*1.35)+2):
                end = start+length
                if end > len(stream):
                    break
                selected = [words[stream[k][1]] for k in range(start, end)]
                if any(b['start']-a['end'] > 2 for a, b in zip(selected, selected[1:])):
                    continue
                heard = [v[0] for v in stream[start:end]]
                # Shared grammar alone cannot identify the only content word:
                # "I am the lion" previously matched "I am the blade" repeatedly.
                if len(content) == 1 and not any(SequenceMatcher(None, content[0], token, autojunk=False).ratio() >= .6 for token in heard):
                    continue
                token_score = SequenceMatcher(None, target, heard, autojunk=False).ratio()
                spelling_score = SequenceMatcher(None, ' '.join(target), ' '.join(heard), autojunk=False).ratio()
                score = max(token_score, spelling_score*.95)
                if score < threshold:
                    continue
                # Reward coverage, but penalize weak matches enough that an exact
                # short phrase wins over a longer phrase with a missing clause.
                weight = length*(score-.5)**2
                key = (start, end)
                if key not in candidates or weight > candidates[key][0]:
                    candidates[key] = (weight, text, score)
    best = [0.]*(len(stream)+1)
    choices = [None]*(len(stream)+1)
    by_end = {}
    for (start, end), value in candidates.items():
        by_end.setdefault(end, []).append((start, value))
    for end in range(1, len(stream)+1):
        best[end] = best[end-1]
        for start, value in by_end.get(end, []):
            if best[start]+value[0] > best[end]:
                best[end] = best[start]+value[0]
                choices[end] = (start, value)
    matches = []
    used = set()
    cursor = len(stream)
    while cursor:
        choice = choices[cursor]
        if choice is None:
            cursor -= 1
            continue
        start, (_, text, score) = choice
        indices = {stream[k][1] for k in range(start, cursor)}
        used.update(indices)
        matches.append({'text': text, 'start': words[min(indices)]['start'], 'end': words[max(indices)]['end'], 'confidence': round(score, 3), 'heard': ' '.join(words[k]['word'].strip() for k in sorted(indices))})
        cursor = start
    return list(reversed(matches)), [w for i, w in enumerate(words) if i not in used]
