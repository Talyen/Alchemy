"""Extract a vocal stem locally, preserving the recording's timeline."""
import argparse
from pathlib import Path
import subprocess
import time

import imageio_ffmpeg
import numpy as np
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', default='cpu', choices=['cpu', 'mps'])
args = parser.parse_args()
torch.set_num_threads(4)
started = time.monotonic()
raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', 'public/Music/The Blight Treant.mp3', '-f', 'f32le', '-ac', '2', '-ar', '44100', '-'])
audio = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy().reshape(-1, 2).T)
model = get_model('htdemucs')
model.eval()
ref = audio.mean(0)
mean, std = ref.mean(), ref.std()
with torch.no_grad():
    stems = apply_model(model, ((audio-mean)/std)[None], device=args.device, shifts=0, split=True, overlap=0.25, progress=True)[0]*std+mean
vocals = stems[model.sources.index('vocals')].mean(0).numpy()
output = Path('reports/boss-lyrics/vocals.wav')
output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-v', 'error', '-f', 'f32le', '-ac', '1', '-ar', '44100', '-i', '-', str(output)], input=vocals.astype(np.float32).tobytes(), check=True)
print(f'Vocal separation: {time.monotonic()-started:.2f}s')
