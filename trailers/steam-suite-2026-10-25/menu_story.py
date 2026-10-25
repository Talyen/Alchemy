#!/usr/bin/env python3
"""Native Continue opening; one live frame per output frame and one action-led camera move."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import correlate, correlation_lags

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--capture', default='menu-story-capture-v1')
parser.add_argument('--revision', default='v1')
args = parser.parse_args()
p = args.project.resolve()
spec = importlib.util.spec_from_file_location('edit', p / 'scripts/edit.py')
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)
edit.PROJECT = p
frames = 730
duration = frames / 60
song_in = 18.68
id = '08-countess-menu-story'
rev = args.revision
review = p / 'review' / f'{id}-{rev}'
review.mkdir(parents=True, exist_ok=True)
out = p / 'finals' / f'{id}-{rev}.mp4'
if out.exists():
    raise RuntimeError('Preserve existing candidate; choose a new revision')
catalog = edit.sources()
key = args.capture + '/menu-story'
clip = catalog[key]
source = Path(clip['path'])
receipt = clip['receipt']
assert edit.digest(source) == receipt['sha256']
assert abs(receipt['nativeMusic']['offset'] - song_in) < 1e-6
assert clip['source']['visualFixes']['combatTextBaseSize'] == 38.4
assert clip['source']['visualFixes']['earthElementalBattleMirroring']
assert any('half your Block' in (text or '') for sample in receipt['presentation'] for text in sample.get('visibleTooltips', []))
assert not any('ATTACK POWER' in (text or '').upper() for sample in receipt['presentation'] for text in sample.get('visibleTooltips', []))
assert receipt['presentation'][0]['battle'] is False
assert all(sample['battle'] for sample in receipt['presentation'] if sample['at'] >= 2)


def smooth(q):
    return q ** 3 * (10 - 15 * q + 6 * q ** 2)


def progress(frame):
    return min(smooth(np.clip((frame - 428) / 21, 0, 1)), smooth(np.clip((503 - frame) / 20, 0, 1)))


def camera_filter(offset=0):
    # perspective counts output frames from one; the edit and proof use zero.
    n = f'(on-1+{offset})'
    up = f'clip(({n}-428)/21,0,1)'
    down = f'clip((503-{n})/20,0,1)'
    s = lambda q: f'(({q})^3*(10-15*({q})+6*({q})^2))'
    a = f'min({s(up)},{s(down)})'
    z = f'(1+0.2*({a}))'
    center = f'(0.5+0.05*({a}))'
    left = f'W*(0.5-{z}*{center})'
    top = f'H*(0.5-{z}*{center})'
    right = f'({left}+W*{z})'
    bottom = f'({top}+H*{z})'
    return f"perspective=x0='{left}':y0='{top}':x1='{right}':y1='{top}':x2='{left}':y2='{bottom}':x3='{right}':y3='{bottom}':sense=destination:eval=frame:interpolation=cubic"


# Render an actual subpixel edge through the same transform. No video/frame dump.
test = review / 'camera-edge-source.png'
im = Image.new('RGB', (2560, 1440), 'black')
ImageDraw.Draw(im).rectangle((1000, 0, 1002, 1439), fill='white')
im.save(test)
cmd = ['ffmpeg', '-v', 'error', '-xerror', '-loop', '1', '-framerate', '60', '-i', str(test),
       '-vf', camera_filter(420) + ',scale=1920:1080:flags=lanczos,format=gray',
       '-frames:v', '90', '-threads', '2', '-filter_threads', '1', '-f', 'rawvideo', '-']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
centroids = []
for i in range(90):
    raw = proc.stdout.read(1920 * 1080)
    if len(raw) != 1920 * 1080:
        raise RuntimeError('Incomplete camera proof frame')
    row = np.frombuffer(raw, np.uint8).reshape(1080, 1920)[540].astype(float)
    centroids.append(float(np.sum(row * np.arange(1920)) / np.sum(row)))
stderr = proc.stderr.read().decode()
assert proc.wait() == 0, stderr
ideal = np.array([((1001 / 2560 - (.5 + .05 * progress(i + 420))) * (1 + .2 * progress(i + 420)) + .5) * 1920 for i in range(90)])
measured = np.array(centroids)
error = (measured - measured[0]) - (ideal - ideal[0])
assert float(np.max(np.abs(error))) < .4, f'Camera motion differs from continuous transform: {np.max(np.abs(error))}'
proof = {'frames': 90, 'maxMotionErrorPixels': float(np.max(np.abs(error))),
         'measuredEdgeCentroids': centroids, 'plannedEdgeCentroids': ideal.tolist(),
         'singleLiveFramePerOutput': True, 'integerCropOrZoompan': False,
         'filter': 'perspective cubic at native1440p, then Lanczos1080p',
         'scope': 'Spatial sampling proof; not subjective motion approval.'}
edit.write(review / 'camera-proof.json', proof)

timeline = {'id': id, 'fps': 60, 'duration': duration,
            'source': key, 'music': {'file': 'audio/countess.mp3', 'in': song_in, 'fade': .12},
            'sfx': .42, 'sfxMode': 'tails',
            'shots': [{'source': key, 'in': 0, 'duration': duration}],
            'intro': {'kind': 'clean fade over native main menu', 'fadeIn': [0, .42], 'continueAt': .7},
            'camera': {'default': 'full native battlefield', 'focusAction': 'Shield Bash inspection',
                       'zoom': 1.2, 'focus': [.55, .55], 'ease': 'quintic smootherstep',
                       'inFrames': [428, 449], 'holdFrames': [449, 483], 'outFrames': [483, 503],
                       'returnedToFullAt': 503 / 60, 'crossDissolves': False},
            'scope': 'Short direction test; three complete opening lyric lines. Not a finished full trailer.',
            'listeningApproval': False}
edit.write(p / 'timelines' / f'{id}-{rev}.json', timeline)
pcm = edit.audio(timeline, catalog, rev)
vf = camera_filter() + ',scale=1920:1080:flags=lanczos:out_color_matrix=bt709,setsar=1,fade=t=in:st=0:d=0.42,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709'
common = ['-r', 60, '-c:v', 'libx264', '-preset', 'fast', '-profile:v', 'high', '-level:v', '4.2', '-g', 120,
          '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
          '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1', '-threads', 2]
edit.ff(['-i', source, '-i', pcm, '-filter_threads', 1, '-vf', vf, '-map', '0:v', '-map', '1:a',
         '-frames:v', frames, '-t', duration, *common, '-b:v', '20M', '-maxrate', '24M', '-bufsize', '40M',
         '-c:a', 'aac', '-b:a', '192k', '-ar', 48000, '-ac', 2, '-movflags', '+faststart', out])
preview = review / f'alchemy-countess-menu-story-{rev}-A-chat-1080p60.mp4'
edit.ff(['-i', out, '-map', '0:v', '-map', '0:a', *common, '-b:v', '9M', '-maxrate', '12M', '-bufsize', '18M',
         '-c:a', 'copy', '-movflags', '+faststart', preview])
meta = edit.probe(out, True)
v = next(x for x in meta['streams'] if x['codec_type'] == 'video')
a = next(x for x in meta['streams'] if x['codec_type'] == 'audio')
assert (v['width'], v['height'], v['r_frame_rate'], int(v['nb_read_frames'])) == (1920, 1080, '60/1', frames)
assert (a['codec_name'], a['sample_rate'], a['channels']) == ('aac', '48000', 2)
assert preview.stat().st_size < 20_000_000
audio_bytes = lambda file: subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-vn', '-c:a', 'copy', '-f', 'adts', '-'])
assert hashlib.sha256(audio_bytes(out)).digest() == hashlib.sha256(audio_bytes(preview)).digest()
log = edit.ff(['-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], True)
(review / 'audio-measurement.txt').write_text(log[-1700:])

def mono(file, start=0):
    return np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(start), '-i', str(file),
                                                 '-t', str(duration), '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-']), np.float32)

reference = mono(p / 'audio/countess.mp3', song_in)
mixed = mono(out)
sync = []
for first, last in [(.2, 1.6), (4.8, 6), (9, 10.5)]:
    start, end = round(first * 8000), round(last * 8000)
    x, y = mixed[start:end], reference[start:end]
    cc = correlate(x - x.mean(), y - y.mean(), mode='full', method='fft')
    lags = correlation_lags(len(x), len(y), mode='full')
    allowed = np.abs(lags) <= 800
    lag = int(lags[allowed][np.argmax(cc[allowed])])
    assert abs(lag / 8000) <= 1 / 60
    sync.append({'window': [first, last], 'audioLagSeconds': lag / 8000})

times = [.25, .65, 1.2, 2.1, 3.8, 4.65, 6.4, 7.7, 8.7, 9.8, 11.45, 12.05]
sheet = Image.new('RGB', (1600, 780), '#0c0a09')
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype(str(p / 'graphics/Inter.woff2'), 17)
for i, t in enumerate(times):
    file = review / f'frame-{t:.3f}.png'
    edit.ff(['-ss', t, '-i', out, '-frames:v', 1, file])
    im = Image.open(file).convert('RGB').resize((400, 225), Image.Resampling.LANCZOS)
    x, y = (i % 4) * 400, (i // 4) * 260
    sheet.paste(im, (x, y))
    d.text((x + 10, y + 231), f'{t:.2f}s / song{song_in+t:.2f}s', font=font, fill='#ead7b7')
contact = review / f'countess-menu-story-{rev}-contact.jpg'
sheet.save(contact, quality=93)
record = {'master': str(out.relative_to(p)), 'sha256': edit.digest(out), 'preview': str(preview.relative_to(p)),
          'previewBytes': preview.stat().st_size, 'previewSha256': edit.digest(preview), 'contact': str(contact.relative_to(p)),
          'frames': frames, 'duration': duration, 'songRange': [song_in, song_in+duration], 'metadata': meta,
          'source': clip['source'], 'sourceSha256': receipt['sha256'], 'cameraProof': proof,
          'audioSync': sync, 'previewAudioPacketsIdentical': True, 'fullDecode': True,
          'timeline': timeline, 'listeningApproval': False}
edit.write(out.with_suffix('.json'), record)
edit.write(review / 'technical.json', record)
print(json.dumps({k: record[k] for k in ['master', 'preview', 'previewBytes', 'contact', 'duration', 'songRange', 'audioSync']}, indent=2), flush=True)
