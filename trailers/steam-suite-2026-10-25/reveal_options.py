#!/usr/bin/env python3
"""Matched, intro-only reveal comparisons. No new gameplay capture or body edits."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--revision', default='v1')
args = parser.parse_args()
p = args.project.resolve()
rev = args.revision
out = p / 'review' / f'09-countess-reveal-options-{rev}'
assets = p / 'graphics/transitions' / f'09-countess-reveals-{rev}'
out.mkdir(parents=True, exist_ok=True)
assets.mkdir(parents=True, exist_ok=True)
W, H, FPS, N = 1920, 1080, 60, 204
duration, reveal = N / FPS, .42
source = p / 'sources/menu-story-capture-v2/clips/menu-story.mp4'
receipt = json.loads((source.parent / 'menu-story.json').read_text())
sha = lambda file: hashlib.sha256(Path(file).read_bytes()).hexdigest()
assert sha(source) == receipt['sha256']
if list(out.glob('*.mp4')):
    raise RuntimeError('Preserve existing comparison; choose a new revision')


def ff(argv, capture=False):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-xerror', '-n', *map(str, argv)], capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode()[-5000:])
    return r.stdout if capture else None


def probe(file):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(file)]))


# Common PCM/music/SFX excerpt; one shared AAC encode and one common review tail.
audio = p / 'audio' / f'09-countess-reveals-{rev}.m4a'
ff(['-i', p / 'audio/08-countess-menu-story-v1.wav', '-t', duration,
    '-af', f'afade=t=out:st={duration-.06}:d=0.06', '-c:a', 'aac', '-b:a', '192k',
    '-ar', 48000, '-ac', 2, '-movflags', '+faststart', audio])

xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
rng = np.random.default_rng(173)
noise = np.zeros((H, W), np.float32)
for size, weight in [((8, 5), .55), ((24, 14), .30), ((60, 34), .15)]:
    layer = Image.fromarray(rng.integers(0, 256, (size[1], size[0]), dtype=np.uint8)).resize((W, H), Image.Resampling.BICUBIC)
    noise += np.asarray(layer, dtype=np.float32) / 255 * weight
radius = np.sqrt(((xx - .5) / .62) ** 2 + ((yy - .4) / .8) ** 2)
threshold = .68 * radius + .32 * noise
threshold = .08 + .84 * (threshold - threshold.min()) / (threshold.max() - threshold.min())
Image.fromarray(np.rint(threshold * 255).astype(np.uint8)).save(assets / 'ink-threshold-map.png')


def smooth(q):
    return q * q * (3 - 2 * q)


def treatment(rgb, frame, kind):
    progress = min(1., frame / FPS / reveal)
    if progress >= 1:
        return rgb, np.ones((H, W), np.float32)
    if kind == 'A':
        alpha = np.full((H, W), progress, np.float32)
        gain = 0
    elif kind == 'B':
        edge = -.12 + smooth(progress) * 1.24
        alpha = np.broadcast_to(smooth(np.clip((edge - xx + .12) / .24, 0, 1)), (H, W))
        sheen = np.exp(-((xx - edge) / .07) ** 2) * np.sin(np.pi * progress) * .075
        gain = sheen[:, :, None] * np.mean(rgb, axis=2, keepdims=True) / 255 * np.array([1., .82, .48], np.float32)
    else:
        alpha = smooth(np.clip((smooth(progress) - threshold + .06) / .12, 0, 1))
        gain = 0
    result = np.rint(np.clip(rgb.astype(np.float32) * alpha[:, :, None] + gain * 255, 0, 255)).astype(np.uint8)
    return result, alpha


common = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-maxrate', '20M', '-bufsize', '40M',
          '-g', '120', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
          '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1', '-threads', '2']
variants = []
for kind, name in [('A', 'clean-fade'), ('B', 'soft-light-sweep'), ('C', 'ink-reveal')]:
    target = out / f'alchemy-reveal-{kind}-{name}-{rev}-1080p60.mp4'
    decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(source), '-an',
                                '-vf', 'scale=1920:1080:flags=lanczos,format=rgb24', '-frames:v', str(N),
                                '-filter_threads', '1', '-threads', '1', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    encoder = subprocess.Popen(['ffmpeg', '-hide_banner', '-v', 'error', '-xerror', '-n',
                                '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', '1920x1080',
                                '-framerate', '60', '-i', '-', '-i', str(audio), '-map', '0:v', '-map', '1:a',
                                '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                                '-frames:v', str(N), '-t', str(duration), *common, '-c:a', 'copy',
                                '-movflags', '+faststart', str(target)], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    tail = hashlib.sha256()
    masks = []
    try:
        for frame in range(N):
            raw = decoder.stdout.read(W * H * 3)
            if len(raw) != W * H * 3:
                raise RuntimeError('Incomplete source frame')
            rgb = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
            result, alpha = treatment(rgb, frame, kind)
            if frame >= 26:
                tail.update(result.tobytes())
            if frame <= 26:
                masks.append(np.rint(alpha * 255).astype(np.uint8))
            encoder.stdin.write(result.tobytes())
        encoder.stdin.close()
        assert decoder.wait() == 0, decoder.stderr.read().decode()
        assert encoder.wait() == 0, encoder.stderr.read().decode()
    finally:
        for child in [decoder, encoder]:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=10)
    np.savez_compressed(assets / f'{kind}-alpha-masks.npz', alpha=np.stack(masks), fps=FPS)
    meta = probe(target)
    video = next(s for s in meta['streams'] if s['codec_type'] == 'video')
    assert (video['width'], video['height'], video['r_frame_rate'], int(video['nb_read_frames'])) == (W, H, '60/1', N)
    assert target.stat().st_size < 20_000_000
    ff(['-i', target, '-f', 'null', '-'])
    adts = ff(['-i', target, '-vn', '-c:a', 'copy', '-f', 'adts', '-'], True)
    variants.append({'option': kind, 'name': name, 'file': str(target.relative_to(p)), 'bytes': target.stat().st_size,
                     'sha256': sha(target), 'postRevealInputHash': tail.hexdigest(),
                     'audioPacketsHash': hashlib.sha256(adts).hexdigest(), 'metadata': meta})
    print(f'{kind} {name}: ready ({target.stat().st_size} bytes)', flush=True)
assert len({v['postRevealInputHash'] for v in variants}) == 1
assert len({v['audioPacketsHash'] for v in variants}) == 1

# Labels are review wrapper graphics, absent from the individual cinematic samples.
header = Image.new('RGBA', (1920, 480), (0, 0, 0, 0))
draw = ImageDraw.Draw(header)
font = ImageFont.truetype(str(p / 'graphics/Inter.woff2'), 30)
for i, label in enumerate(['A  CLEAN FADE', 'B  SOFT LIGHT SWEEP', 'C  INK REVEAL']):
    draw.text((i * 640 + 320, 42), label, anchor='mm', font=font, fill='#ead7b7')
header_file = assets / 'comparison-labels.png'
header.save(header_file)
comparison = out / f'alchemy-reveal-ABC-comparison-{rev}.mp4'
inputs = [item for v in variants for item in ['-i', p / v['file']]]
ff([*inputs, '-loop', '1', '-framerate', 60, '-i', header_file, '-filter_complex_threads', 1,
    '-filter_complex', '[0:v]scale=640:360:flags=lanczos[a];[1:v]scale=640:360:flags=lanczos[b];[2:v]scale=640:360:flags=lanczos[c];[a][b][c]hstack=inputs=3,pad=1920:480:0:96:color=0x10100f[panel];[panel][3:v]overlay=0:0:shortest=1,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v]',
    '-map', '[v]', '-map', '0:a', '-frames:v', N, '-t', duration, *common, '-c:a', 'copy', '-movflags', '+faststart', comparison])
ff(['-i', comparison, '-f', 'null', '-'])

sheet = Image.new('RGB', (1600, 3 * 265), '#10100f')
draw = ImageDraw.Draw(sheet)
small = ImageFont.truetype(str(p / 'graphics/Inter.woff2'), 20)
for row, v in enumerate(variants):
    for col, time in enumerate([.1, .2, .3, .45]):
        file = out / f'{v["option"]}-{time:.2f}.png'
        ff(['-ss', time, '-i', p / v['file'], '-frames:v', 1, file])
        im = Image.open(file).convert('RGB').resize((400, 225), Image.Resampling.LANCZOS)
        sheet.paste(im, (col * 400, row * 265))
        draw.text((col * 400 + 10, row * 265 + 232), f'{v["option"]} · {time:.2f}s', font=small, fill='#ead7b7')
contact = out / f'reveal-ABC-contact-{rev}.jpg'
sheet.save(contact, quality=94)
record = {'scope': 'Intro reveal preference test; not a Steam final or a new full trailer',
          'duration': duration, 'frames': N, 'fps': FPS, 'revealSeconds': reveal,
          'nativeSource': str(source.relative_to(p)), 'sourceSha256': receipt['sha256'],
          'nativeSongRange': [18.68, 18.68 + duration], 'commonAudio': str(audio.relative_to(p)),
          'reviewOnlyTailFadeSeconds': .06, 'nativeContinueAt': .7,
          'onlyRevealChanges': True, 'postRevealFramesIdenticalBeforeEncode': True,
          'audioPacketsIdentical': True, 'variants': variants, 'comparison': str(comparison.relative_to(p)),
          'comparisonDimensions': [1920, 480], 'comparisonLabelsOutsideGameView': True,
          'contact': str(contact.relative_to(p)), 'editableAlphaMasks': str(assets.relative_to(p)),
          'unchangedBody': 'Original12.17secondA candidate/camera stays intact; these3.4secondexcerpts stopbeforeitsactionzoom.',
          'listeningApproval': False}
(out / 'technical.json').write_text(json.dumps(record, indent=2) + '\n')
(assets / 'recipe.json').write_text(json.dumps({'duration': reveal, 'seed': 173, 'lightSweep': {'featherWidth': .24, 'sheenSigma': .07, 'maxSheenGain': .075}, 'ink': {'threshold': 'ink-threshold-map.png', 'softness': .12, 'fixedNoise': True}, 'source': record['nativeSource']}, indent=2) + '\n')
print(json.dumps({'variants': [{k: v[k] for k in ['option', 'file', 'bytes']} for v in variants], 'comparison': record['comparison'], 'contact': record['contact']}, indent=2), flush=True)
