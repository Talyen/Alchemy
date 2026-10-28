#!/usr/bin/env python3
"""Make a bounded private review proxy and check exported Countess A/V clocks."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import correlate


parser = argparse.ArgumentParser()
parser.add_argument("--project", type=Path, required=True)
parser.add_argument("--revision", default="v1")
args = parser.parse_args()
project = args.project.resolve()
spec = importlib.util.spec_from_file_location("edit", project / "scripts/edit.py")
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)
edit.PROJECT = project
film = project / "finals" / f"05-countess-one-more-heartbeat-{args.revision}.mp4"
edit.review(film)
folder = project / "review" / film.stem
proxy = folder / f"alchemy-countess-review-{args.revision}-720p60.mp4"
if not proxy.exists():
    edit.ff(["-i", film, "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-profile:v", "high", "-preset", "fast", "-b:v", "3M", "-maxrate", "4M", "-bufsize", "8M", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-threads", 2, "-c:a", "copy", "-movflags", "+faststart", proxy])

times = [.6, 3.45, 20.9, 24.0, 43.9, 56.0, 62.4, 70.3, 81.3, 82.2, 88.48, 90.3]
sheet = Image.new("RGB", (1920, 4*400), "#0a0d10")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype(str(project / "graphics/Inter.woff2"), 23)
for i, t in enumerate(times):
    frame = folder / f"native-{t:06.2f}.png"
    if not frame.exists():
        edit.ff(["-ss", t, "-i", film, "-frames:v", 1, frame])
    im = Image.open(frame).convert("RGB")
    im.thumbnail((640, 360), Image.Resampling.LANCZOS)
    x, y = i % 3 * 640, i // 3 * 400
    sheet.paste(im, (x, y))
    draw.text((x+14, y+368), f"{t:05.2f}s / song {t:05.2f}s", font=font, fill="#ead2a4")
sheet.save(folder / "countess-contact-sheet.jpg", quality=92)

# Comparing independently decoded exported audio to the original song finds
# encoder/filter drift. It cannot replace listening to the performance.
def samples(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-f", "f32le", "-ar", "12000", "-ac", "1", "pipe:1"])
    return np.frombuffer(raw, dtype=np.float32)

original, exported = samples(project / "audio/countess.mp3"), samples(film)
rate, pad, windows = 12000, 1800, []
for t in [2, 21, 44, 57, 77]:
    start, size = t*rate, 4*rate
    a = original[start:start+size].astype(np.float64)
    b = exported[start-pad:start+size+pad].astype(np.float64)
    scores = correlate(b, a, mode="valid", method="fft")
    index = int(np.argmax(scores))
    match = b[index:index+size]
    coefficient = float(np.dot(match, a) / (np.linalg.norm(match)*np.linalg.norm(a)))
    windows.append({"songTime":t, "windowSeconds":4, "exportLagMs":(index-pad)/rate*1000, "correlation":coefficient})
assert all(abs(w["exportLagMs"]) < 2 and w["correlation"] > .85 for w in windows), windows
report = {"final":film.name,"finalSha256":edit.digest(film),"preview":proxy.name,"previewSha256":edit.digest(proxy),"previewBytes":proxy.stat().st_size,"previewAudio":"AAC stream copied from final, no second lossy audio encode","song":"The Blood Countess - Boss Track.mp3","songPath":"audio/countess.mp3","songSha256":edit.digest(project / "audio/countess.mp3"),"songOffset":0,"durationSeconds":92.5,"audioClockWindows":windows,"nativeLyricClockCheck":"../countess-lyric-clock-check.json","listeningApproval":False}
edit.write(folder / "preview-identity.json", report)
print(json.dumps({"preview":str(proxy),"previewBytes":proxy.stat().st_size,"audioClockWindows":windows},indent=2))
