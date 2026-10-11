"""Offline experiment: align supplied sung lyrics to the shipped recording."""
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

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--audio', type=Path, default=Path('public/music/The Blight Treant.mp3'))
parser.add_argument('--lyrics', type=Path, default=Path('scripts/lyrics-trial/blight-treant.txt'))
parser.add_argument('--output', type=Path, default=Path('reports/boss-lyrics/alignment-mix.json'))
parser.add_argument('--model', default='small.en')
parser.add_argument('--reference-audio', type=Path, default=Path('public/music/The Blight Treant.mp3'))
args = parser.parse_args()
torch.set_num_threads(4)
started = time.monotonic()
raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(args.audio), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'])
audio = np.frombuffer(raw, dtype=np.float32).copy()
print(f'Aligning {len(audio)/16000:.1f}s with {args.model} on CPU', flush=True)
model = stable_whisper.load_model(args.model, device='cpu')
result = model.align(audio, args.lyrics.read_text(), language='en', original_split=True, suppress_silence=False, verbose=True)
if result is None:
    raise RuntimeError('Model returned no alignment')
data = result.to_dict()
data['provenance'] = {'audioSha256': hashlib.sha256(args.reference_audio.read_bytes()).hexdigest(), 'alignmentInputSha256': hashlib.sha256(args.audio.read_bytes()).hexdigest(), 'lyricsSha256': hashlib.sha256(args.lyrics.read_bytes()).hexdigest(), 'model': args.model, 'input': str(args.audio), 'seconds': round(time.monotonic()-started, 2), 'audioDuration': len(audio)/16000, 'method': 'stable-ts forced alignment; supplied lyrics; no manual timestamps'}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, indent=2)+'\n')
words = [w for s in data['segments'] for w in s['words']]
print(json.dumps({'words': len(words), 'zeroDuration': sum(int(w['end'] <= w['start']) for w in words), **data['provenance']}, indent=2), flush=True)
