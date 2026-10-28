#!/usr/bin/env python3
"""Create clearly labeled chat proxies under 20 MB without changing masters."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


parser = argparse.ArgumentParser()
parser.add_argument("--project", type=Path, required=True)
parser.add_argument("--timeline", required=True)
parser.add_argument("--revision", default="v1")
parser.add_argument("--poster-time", type=float)
parser.add_argument("--height", type=int, choices=[720,1080], default=720)
parser.add_argument("--fps", type=int, choices=[30,60], default=30)
args = parser.parse_args()
project = args.project.resolve()
spec = importlib.util.spec_from_file_location("edit", project / "scripts/edit.py")
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)
edit.PROJECT = project
film = project / "finals" / f"{args.timeline}-{args.revision}.mp4"
receipt = edit.read(film.with_suffix(".json"))
folder = project / "review" / film.stem
assert edit.read(folder / "technical.json")["passed"]
assert edit.digest(film) == receipt["sha256"]
metadata = edit.probe(film)
duration = float(metadata["format"]["duration"])
audio = next(s for s in metadata["streams"] if s["codec_type"] == "audio")
rate = min(10000000 if args.height==1080 else 2600000, int(((18_000_000 * 8 / duration) - int(audio["bit_rate"])) * .93 // 1000) * 1000)
width = args.height*16//9
proxy = folder / f"alchemy-{args.timeline}-{args.revision}-chat-{args.height}p{args.fps}.mp4"
if not proxy.exists():
    edit.ff(["-i", film, "-vf", f"scale={width}:{args.height}:flags=lanczos,fps={args.fps}", "-c:v", "libx264", "-profile:v", "high", "-preset", "fast", "-b:v", rate, "-maxrate", round(rate*1.4), "-bufsize", round(rate*2.8), "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1", "-threads", 2, "-c:a", "copy", "-t", duration, "-movflags", "+faststart", proxy])
assert proxy.stat().st_size < 20_000_000, "Preserve oversized proxy; create a lower-rate revision"
pm = edit.probe(proxy, True)
pv = next(s for s in pm["streams"] if s["codec_type"] == "video")
assert (pv["width"], pv["height"], pv["r_frame_rate"], pv["codec_name"]) == (width,args.height,f"{args.fps}/1","h264")
assert abs(float(pm["format"]["duration"]) - duration) <= .034

def aac_hash(path):
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-c:a", "copy", "-f", "adts", "pipe:1"])
    return hashlib.sha256(data).hexdigest()

master_audio_hash, proxy_audio_hash = aac_hash(film), aac_hash(proxy)
assert master_audio_hash == proxy_audio_hash, "Chat proxy audio packets differ from the master"
times = [.6]
for shot in receipt["resolvedShots"]:
    times.append(shot["from"] + min(2.8, (shot["to"]-shot["from"])/2))
    if shot["to"]-shot["from"] >= 12:
        times.append(shot["to"]-2.4)
times = sorted(set(round(t,3) for t in times))
if len(times) > 12:
    times = [times[round(i*(len(times)-1)/11)] for i in range(12)]
sheet = Image.new("RGB", (1920, ((len(times)+2)//3)*400), "#0a0d10")
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype(str(project / "graphics/Inter.woff2"), 23)
for i,t in enumerate(times):
    frame = folder / f"native-{t:07.3f}.jpg"
    if not frame.exists():
        edit.ff(["-ss",t,"-i",film,"-frames:v",1,"-q:v",2,frame])
    im = Image.open(frame).convert("RGB")
    im.thumbnail((640,360),Image.Resampling.LANCZOS)
    x,y=i%3*640,i//3*400
    sheet.paste(im,(x,y));d.text((x+12,y+368),f"{t:.3f}s",font=font,fill="#ead2a4")
sheet_path = folder / f"{args.timeline}-{args.revision}-contact-sheet.jpg"
sheet.save(sheet_path,quality=92)
posters = project / "posters"
posters.mkdir(exist_ok=True)
poster = posters / f"{film.stem}.png"
poster_time = args.poster_time if args.poster_time is not None else min(6.45, receipt["resolvedShots"][0]["to"]-.7)
if not poster.exists():
    edit.ff(["-ss",poster_time,"-i",film,"-frames:v",1,poster])
record = {"master":str(film.relative_to(project)),"masterSha256":receipt["sha256"],"chatPreview":str(proxy.relative_to(project)),"previewSha256":edit.digest(proxy),"previewBytes":proxy.stat().st_size,"previewPurpose":f"Chat delivery only; {args.height}p{args.fps}, master remains native1080p60","masterDuration":duration,"previewDuration":float(pm["format"]["duration"]),"audioPacketsIdentical":True,"aacAdtsSha256":master_audio_hash,"contactSheet":str(sheet_path.relative_to(project)),"poster":str(poster.relative_to(project)),"posterTime":poster_time,"frameReviewTimes":times,"listeningApproval":False}
edit.write(folder / "chat-review-assets.json",record)
print(json.dumps(record,indent=2))
