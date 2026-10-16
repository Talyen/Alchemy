"""Detect performed phrases independently, then constrain word alignment to them."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time

import imageio_ffmpeg
import numpy as np
import stable_whisper
import torch

from phrase_match import match_phrases
from snapshot import write_snapshot


def decode(path):
    raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'])
    return np.frombuffer(raw, dtype=np.float32).copy()


def suspect(segment):
    words = segment['words']
    return any(w['end'] <= w['start'] or w['end']-w['start'] > 2.5 for w in words)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path, default=Path('public/Music/The Blight Treant.mp3'))
    parser.add_argument('--lyrics', type=Path, default=Path('scripts/lyrics-trial/blight-treant.txt'))
    parser.add_argument('--model', default='small.en')
    parser.add_argument('--retry-model', default='medium.en')
    parser.add_argument('--output-dir', type=Path, default=Path('reports/boss-lyrics'))
    parser.add_argument('--snapshot', type=Path, help='Export validated compact runtime timings; still requires listening review')
    parser.add_argument('--allow-incomplete', action='store_true', help='Explicitly omit and record entire phrases whose timing validation fails')
    args = parser.parse_args()
    torch.set_num_threads(4)
    started = time.monotonic()
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    lyrics_text = args.lyrics.read_text()
    lyrics_hash = hashlib.sha256(args.lyrics.read_bytes()).hexdigest()
    audio = decode(args.audio)
    audio_hash = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    model = stable_whisper.load_model(args.model, device='cpu')
    cache = output/'transcript-full.json'
    cached = json.loads(cache.read_text()) if cache.exists() else {}
    if cached.get('audioSha256') == audio_hash and cached.get('model', 'small.en') == args.model:
        transcript = cached
    else:
        transcript = model.transcribe(audio, language='en', fp16=False, verbose=True, condition_on_previous_text=False, word_timestamps=True, temperature=0).to_dict()
        transcript['audioSha256'] = audio_hash
        transcript['model'] = args.model
        cache.write_text(json.dumps(transcript, indent=2)+'\n')
    phrases = list(dict.fromkeys(line.strip() for line in lyrics_text.splitlines() if line.strip()))
    detected = [w for s in transcript['segments'] for w in s['words']]
    matches, unmatched = match_phrases(phrases, detected)
    # Retry clusters of unrecognized speech, not isolated function words.
    groups = []
    for word in unmatched:
        if not groups or word['start']-groups[-1][-1]['end'] > 2:
            groups.append([])
        groups[-1].append(word)
    regions = [(max(0, g[0]['start']-2), min(len(audio)/16000, g[-1]['end']+2)) for g in groups if len(g) >= 3]
    larger = model if args.model == args.retry_model else None
    transcript_retries = []
    if regions:
        print(f'Retrying {len(regions)} unmatched speech regions with {args.retry_model}', flush=True)
        if larger is None:
            larger = stable_whisper.load_model(args.retry_model, device='cpu')
        for start, end in regions:
            key = output/f'transcript-retry-{args.retry_model}-{start:.2f}-{end:.2f}.json'
            if key.exists() and json.loads(key.read_text()).get('audioSha256') == audio_hash:
                retry = json.loads(key.read_text())
            else:
                retry = larger.transcribe(audio[int(start*16000):int(end*16000)], language='en', fp16=False, verbose=True, condition_on_previous_text=False, word_timestamps=True, temperature=0).to_dict()
                retry['audioSha256'] = audio_hash
                key.write_text(json.dumps(retry, indent=2)+'\n')
            retry_words = [dict(w, start=w['start']+start, end=w['end']+start) for seg in retry['segments'] for w in seg['words']]
            trial_words = sorted([w for w in detected if w['end'] <= start or w['start'] >= end]+retry_words, key=lambda w: w['start'])
            trial_matches, trial_unmatched = match_phrases(phrases, trial_words)
            # Only accept recovered coverage when match confidence also holds.
            old_coverage = sum(len(m['text'].split())*m['confidence'] for m in matches)
            new_coverage = sum(len(m['text'].split())*m['confidence'] for m in trial_matches)
            accepted = bool(new_coverage > old_coverage)
            transcript_retries.append({'start': start, 'end': end, 'accepted': accepted, 'beforeCoverageScore': old_coverage, 'afterCoverageScore': new_coverage})
            if accepted:
                detected, matches, unmatched = trial_words, trial_matches, trial_unmatched
    anchors = [{'start': max(0, m['start']-.12), 'end': min(len(audio)/16000, m['end']+.12), 'text': m['text']} for m in matches]
    # Keep independently detected phrase boundaries from bleeding into neighbours.
    for left, right in zip(anchors, anchors[1:]):
        if left['end'] > right['start']:
            midpoint = (left['end']+right['start'])/2
            left['end'] = right['start'] = midpoint
    result = model.align_words(audio, anchors, language='en', inplace=False, regroup=False, suppress_silence=False, verbose=True)
    data = result.to_dict()
    retry_indices = [i for i, s in enumerate(data['segments']) if suspect(s) or matches[i]['confidence'] < .8]
    print(f'{len(matches)} detected phrases, {len(unmatched)} unmatched ASR words; retrying {len(retry_indices)} phrases with {args.retry_model}', flush=True)
    retries = []
    if retry_indices:
        del model
        if larger is None:
            larger = stable_whisper.load_model(args.retry_model, device='cpu')
        for i in retry_indices:
            retry = larger.align_words(audio, [anchors[i]], language='en', inplace=False, regroup=False, suppress_silence=False, verbose=True).to_dict()['segments'][0]
            before = data['segments'][i]
            def penalty(segment):
                return sum(10 if w['end'] <= w['start'] else max(0, w['end']-w['start']-2.5) for w in segment['words'])
            accepted = bool(penalty(retry) < penalty(before))
            retries.append({'index': i, 'accepted': accepted, 'beforePenalty': float(penalty(before)), 'afterPenalty': float(penalty(retry))})
            if accepted:
                data['segments'][i] = retry
    data['coverage'] = {'detectedPhrases': len(matches), 'unmatchedAsrWords': len(unmatched), 'undetectedWrittenPhrases': sum(p not in {m['text'] for m in matches} for p in phrases)}
    method = 'independent ASR phrase matching with repeats/omissions; bounded word alignment; no manual timestamps'
    data['provenance'] = {'audioSha256': audio_hash, 'lyricsSha256': lyrics_hash, 'audioDuration': len(audio)/16000, 'model': f'{args.model}; {args.retry_model} for suspect phrases', 'seconds': round(time.monotonic()-started, 2), 'method': method}
    (output/'alignment-phrases.json').write_text(json.dumps(data, indent=2)+'\n')
    (output/'phrase-evidence.json').write_text(json.dumps({'matches': matches, 'unmatchedAsrWords': unmatched, 'undetectedWrittenPhrases': [p for p in phrases if p not in {m['text'] for m in matches}], 'retries': retries, 'transcriptRetries': transcript_retries}, indent=2)+'\n')
    if args.snapshot:
        write_snapshot(data, args.snapshot, args.allow_incomplete)
    print(json.dumps(data['provenance'], indent=2), flush=True)


if __name__ == '__main__':
    main()
