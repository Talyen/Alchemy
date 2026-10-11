"""Independently transcribe excerpts to investigate lyric/recording mismatches."""
import subprocess

import imageio_ffmpeg
import numpy as np
import stable_whisper
import torch

torch.set_num_threads(4)
raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', 'public/Music/The Blight Treant.mp3', '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'])
audio = np.frombuffer(raw, dtype=np.float32).copy()
model = stable_whisper.load_model('small.en', device='cpu')
for start, end in [(0, 40), (145, 190), (225, 360)]:
    print(f'Excerpt {start}-{end}s; output timestamps are relative to excerpt')
    result = model.transcribe(audio[int(start*16000):int(end*16000)], language='en', fp16=False, verbose=True, condition_on_previous_text=False)
    result.save_as_json(f'reports/boss-lyrics/transcript-{start}.json')
