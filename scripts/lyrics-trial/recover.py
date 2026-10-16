"""Recover selected passages with contextual vocal-stem alignment, preserving other timings."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import imageio_ffmpeg
import numpy as np
import stable_whisper
import torch

from snapshot import merge_recovery, normalized


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boss', required=True)
    parser.add_argument('--vocals', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--plan', type=Path, default=Path(__file__).with_name('recovery-regions.json'))
    parser.add_argument('--evidence', required=True, type=Path)
    args = parser.parse_args()
    plan_bytes = args.plan.read_bytes()
    plan = json.loads(plan_bytes)[args.boss]
    original = Path(plan['audio'])
    source = Path(f'src/lib/audio/lyrics/{args.boss}.json')
    lyrics = Path(f'scripts/lyrics-trial/{args.boss}.txt')
    snapshot = json.loads(source.read_text())
    original_line_count = len(snapshot['lines'])
    stem = json.loads(args.vocals.with_suffix('.json').read_text())
    audio_hash, stem_hash = digest(original), digest(args.vocals)
    if audio_hash != snapshot['audioSha256'] or stem['audioSha256'] != audio_hash:
        raise ValueError('Recording mismatch; preserve the existing timing snapshot')
    if digest(lyrics) != snapshot['lyricsSha256']:
        raise ValueError('Lyric sheet changed; review source wording before recovery')
    if stem['stemSha256'] != stem_hash or stem['start'] != 0 or stem['model'] != 'htdemucs':
        raise ValueError('Vocal stem provenance mismatch or cropped timeline')
    raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(args.vocals), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'])
    audio = np.frombuffer(raw, dtype=np.float32).copy()
    if abs(len(audio)/16000-snapshot['audioDuration']) > .002:
        raise ValueError('Vocal stem does not preserve the original recording duration')
    sheet = {tuple(normalized(line)) for line in lyrics.read_text().splitlines() if line.strip()}
    torch.set_num_threads(2)
    model = stable_whisper.load_model('small.en', device='cpu')
    evidence = []
    recovered = 0
    for region in plan['regions']:
        if not 0 <= region['start'] < region['end'] <= snapshot['audioDuration']:
            raise ValueError('Invalid recovery search window')
        if not region['apply'] or len(region['apply']) != len(set(region['apply'])):
            raise ValueError('Recovery must select distinct source phrases')
        if any(tuple(normalized(line)) not in sheet for line in region['lines']):
            raise ValueError('Recovery context must use supplied lyric phrases')
        clip = audio[int(region['start']*16000):int(region['end']*16000)]
        aligned = model.align_words(
            clip, [{'start': 0, 'end': len(clip)/16000, 'text': ' '.join(region['lines'])}],
            language='en', inplace=False, regroup=False, suppress_silence=False,
            dynamic_heads=region.get('dynamicHeads'), verbose=None,
        ).to_dict()
        words = [word for segment in aligned['segments'] for word in segment['words']]
        expected = ' '.join(region['lines']).split()
        if len(words) != len(expected) or any(normalized(word['word']) != normalized(text) for word, text in zip(words, expected)):
            raise ValueError('Alignment changed source word boundaries or spelling')
        lines, position = [], 0
        for text in region['lines']:
            count = len(text.split())
            selected = words[position:position+count]
            lines.append({'text': text, 'timings': [round(float(word[key])+region['start'], 3) for word in selected for key in ('start', 'end')]})
            position += count
        additions = [lines[index] for index in region['apply']]
        snapshot = merge_recovery(snapshot, region, additions)
        evidence.append({'region': region, 'contextAlignment': lines, 'applied': additions})
        recovered += len(additions)
        print(region['id'], additions, flush=True)
    present = {tuple(normalized(line['text'])) for line in snapshot['lines']}
    missing = list(dict.fromkeys(line for line in lyrics.read_text().splitlines() if line.strip() and tuple(normalized(line)) not in present))
    added = len(snapshot['lines'])-original_line_count
    snapshot['coverage'].update({'alignedPhrases': len(snapshot['lines']), 'recoveredPhrases': added, 'realignedPhrases': recovered-added, 'undetectedWrittenPhrases': len(missing)})
    snapshot['undetectedWrittenPhrases'] = missing
    snapshot['recovery'] = {
        'regionsSha256': hashlib.sha256(plan_bytes).hexdigest(), 'stemSha256': stem_hash,
        'separationModel': 'htdemucs', 'alignmentModel': 'small.en',
        'method': 'bounded contextual vocal-stem alignment; no manual word timestamps',
    }
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps({'audioSha256': audio_hash, 'recovery': snapshot['recovery'], 'regions': evidence}, indent=2, ensure_ascii=False)+'\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False)+'\n')


if __name__ == '__main__':
    main()
