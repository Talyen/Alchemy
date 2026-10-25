#!/usr/bin/env python3
"""Editable, bounded offline finishing for the Alchemy Steam trailer suite.

No game code or player data is changed. Capture remains owned by `npm run trailer`.
The project JSON is the edit decision list; source clips, overlays, PCM mixes,
render segments and delivery files stay separate. Existing files are immutable.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont
import numpy as np


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n")


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(args, capture=False):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(" ".join(map(str, args[:8])) + "\n" + result.stderr[-6000:])
    return result.stdout + result.stderr if capture else None


def ff(args, capture=False):
    return run(["ffmpeg", "-hide_banner", "-loglevel", "info" if capture else "error", "-xerror", "-n", *map(str, args)], capture)


def probe(path, frames=False):
    return json.loads(run(["ffprobe", "-v", "error", *(["-count_frames"] if frames else []), "-show_streams", "-show_format", "-of", "json", str(path)], True))


def font(size):
    # The source font is copied during setup so a portable project needs no OS font.
    return ImageFont.truetype(str(PROJECT / "graphics/Inter.woff2"), size)


def graphics():
    target = PROJECT / "graphics"
    target.mkdir(exist_ok=True)
    woff = target / "Inter.woff2"
    if not woff.exists():
        # FreeType reads the game's own WOFF2 directly; no OS font dependency.
        shutil.copy2(PROJECT / "sources/protected-library/assets/Inter.woff2", woff)
    logo_file = target / "logo.webp"
    if not logo_file.exists():
        shutil.copy2(PROJECT / "sources/protected-library/assets/logo.webp", logo_file)
    for color, name in [("#e8c281", "gold"), ("#cb7b8b", "blood")]:
        bg = Image.new("RGB", (1920, 1080))
        yy, xx = np.mgrid[0:1080, 0:1920]
        glow = np.exp(-(((xx - 960) / 620) ** 2 + ((yy - 480) / 470) ** 2))
        base = np.zeros((1080, 1920, 3), dtype=np.uint8)
        for c, (a, b) in enumerate(zip((5, 8, 10), (25, 23, 22) if name == "gold" else (35, 15, 22))):
            base[:, :, c] = a + glow * b
        bg = Image.fromarray(base).convert("RGBA")
        logo = Image.open(logo_file).convert("RGBA")
        logo.thumbnail((900, 620), Image.Resampling.LANCZOS)
        bg.alpha_composite(logo, ((1920 - logo.width) // 2, 100))
        draw = ImageDraw.Draw(bg)
        draw.line((770, 775, 1150, 775), fill=color, width=2)
        draw.text((960, 840), "WISHLIST ON STEAM", font=font(43), anchor="mm", fill="#f4dfb6", stroke_width=0)
        draw.text((960, 920), "A fantasy roguelite deckbuilder", font=font(25), anchor="mm", fill="#b5afa3")
        bg.convert("RGB").save(target / f"end-{name}.png")
    titles = {}
    for timeline in (PROJECT / "timelines").glob("*.json"):
        for shot in read(timeline)["shots"]:
            if shot.get("title"):
                titles[shot["title"]] = shot.get("accent", "gold")
    for text, accent in titles.items():
        name = hashlib.sha256(text.encode()).hexdigest()[:12] + ".png"
        im = Image.new("RGBA", (1920, 1080))
        d = ImageDraw.Draw(im)
        color = "#e8c281" if accent == "gold" else "#db9ba7"
        d.line((96, 88, 150, 88), fill=color, width=3)
        # Titles live in the empty upper margin, above art and below no controls.
        d.text((96, 112), text, font=font(36), fill="#f4e9d1", stroke_width=1, stroke_fill="#080b0de0")
        im.save(target / name)


def sources():
    catalog = {}
    for bundle in ["protected-library", "canary", "countess-performance", "current-selects", "detail-selects", "wizard-turn"]:
        location = PROJECT / "sources" / bundle
        if not (location / "capture.json").exists():
            continue
        capture = read(location / "capture.json")
        for key, clip in capture["clips"].items():
            catalog[f"{bundle}/{key}"] = {
                "path": str(location / "clips" / clip["file"]),
                "bundle": str(location), "receipt": clip,
                "source": capture["source"], "duration": clip["frameCount"] / clip["settings"]["fps"],
            }
    return catalog


def audio(timeline, catalog, revision):
    out = PROJECT / "audio" / f"{timeline['id']}-{revision}"
    normalized = out.with_suffix(".wav")
    if normalized.exists():
        return normalized
    raw = out.with_suffix(".mix.wav")
    duration = sum(s["duration"] for s in timeline["shots"])
    args = ["-ss", timeline["music"].get("in", 0), "-i", PROJECT / timeline["music"]["file"]]
    filters = [f"[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={duration},asetpts=PTS-STARTPTS,volume=0.8,afade=t=in:d=0.05,afade=t=out:st={duration-timeline['music'].get('fade',2.0)}:d={timeline['music'].get('fade',2.0)}[m]"]
    events = []
    cursor = 0
    for shot in timeline["shots"]:
        if shot.get("source"):
            clip = catalog[shot["source"]]
            for cue in clip["receipt"]["sounds"]:
                start = max(cue["at"], shot.get("in", 0))
                end = min(cue["end"], shot.get("in", 0) + shot["duration"])
                if end - start < .005 or cue["volume"] <= 0:
                    continue
                events.append({"file": str(Path(clip["bundle"]) / cue["file"]), "offset": cue.get("offset", 0) + start - cue["at"], "duration": end-start, "at": cursor + start-shot.get("in", 0), "volume": cue["volume"] * timeline.get("sfx", .55)})
        cursor += shot["duration"]
    for i, cue in enumerate(events, 1):
        args += ["-ss", cue["offset"], "-i", cue["file"]]
        filters += [f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={cue['duration']},asetpts=PTS-STARTPTS,volume={cue['volume']},afade=t=out:st={max(0,cue['duration']-.012)}:d=0.012,adelay={round(cue['at']*48000)}S:all=1[s{i}]"]
    labels = "[m]" + "".join(f"[s{i}]" for i in range(1, len(events)+1))
    filters += [f"{labels}amix=inputs={len(events)+1}:duration=first:normalize=0,atrim=duration={duration}[a]"]
    if not raw.exists():
        ff([*args, "-filter_complex_threads", 1, "-filter_complex", ";".join(filters), "-map", "[a]", "-c:a", "pcm_f32le", raw])
    measured_log = ff(["-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], True)
    measurement = json.loads(measured_log[measured_log.rfind("{"):measured_log.rfind("}")+1])
    norm = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={measurement['input_i']}:measured_TP={measurement['input_tp']}:measured_LRA={measurement['input_lra']}:measured_thresh={measurement['input_thresh']}:offset={measurement['target_offset']}:linear=true:print_format=json"
    ff(["-i", raw, "-af", norm, "-ar", 48000, "-ac", 2, "-c:a", "pcm_s24le", normalized])
    write(out.with_suffix(".json"), {"music": timeline["music"], "duration": duration, "nativeSoundEvents": events, "firstPass": measurement, "target": {"LUFS": -14, "dBTP": -1.5}})
    return normalized


def render(timeline, revision):
    catalog = sources()
    segments = PROJECT / "segments" / f"{timeline['id']}-{revision}"
    segments.mkdir(parents=True, exist_ok=True)
    output = PROJECT / "finals" / f"{timeline['id']}-{revision}.mp4"
    if output.exists():
        raise RuntimeError(f"Retain {output.name}; use a new revision")
    used = {s["source"] for s in timeline["shots"] if s.get("source")}
    for key in used:
        if digest(catalog[key]["path"]) != catalog[key]["receipt"]["sha256"]:
            raise RuntimeError(f"Source master differs from its capture receipt: {key}")
    image_paths = [PROJECT / "graphics" / f"end-{s.get('accent','gold')}.png" for s in timeline["shots"] if s.get("end")]
    image_paths += [PROJECT / "graphics" / (hashlib.sha256(s["title"].encode()).hexdigest()[:12] + ".png") for s in timeline["shots"] if s.get("title")]
    identity = {
        "timeline": timeline, "editor": digest(__file__),
        "sources": {key: catalog[key]["receipt"] for key in sorted(used)},
        "music": digest(PROJECT / timeline["music"]["file"]),
        "graphics": {str(p.relative_to(PROJECT)): digest(p) for p in image_paths},
    }
    key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    admission = segments / "identity.json"
    if admission.exists() and read(admission)["key"] != key:
        raise RuntimeError("Retained segments belong to a different edit; choose a new revision")
    if not admission.exists():
        write(admission, {"key": key, "inputs": identity})
    cursor = 0
    editorial = []
    for i, shot in enumerate(timeline["shots"]):
        part = segments / f"{i:03}.mp4"
        frames = round(shot["duration"] * 60)
        args = []
        if shot.get("end"):
            source = PROJECT / "graphics" / f"end-{shot.get('accent','gold')}.png"
            args += ["-loop", 1, "-framerate", 60, "-i", source]
        else:
            source = catalog[shot["source"]]
            if shot.get("in", 0) + shot["duration"] > source["duration"] + .00001:
                raise RuntimeError(f"Shot {i} exceeds retained source")
            if source["receipt"].get("nativeMusic"):
                expected = source["receipt"]["nativeMusic"]["offset"] + shot.get("in", 0)
                actual = timeline["music"].get("in", 0) + cursor
                if abs(expected - actual) > 1/60:
                    raise RuntimeError(f"Shot {i} lyric clock mismatch: {expected} != {actual}")
            args += ["-ss", shot.get("in", 0), "-i", source["path"]]
        filters = ["[0:v]setpts=PTS-STARTPTS"]
        z0, z1 = shot.get("zoom", [1, 1])
        cx, cy = shot.get("focus", [.5, .5])
        if z0 != 1 or z1 != 1:
            z = f"{z0}+({z1-z0})*on/{max(1,frames-1)}"
            filters[0] += f",zoompan=z='{z}':x='max(0,min(iw-iw/zoom,iw*{cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*{cy}-ih/zoom/2))':d=1:s=1920x1080:fps=60"
        else:
            filters[0] += ",scale=1920:1080:flags=lanczos"
        filters[0] += ",setsar=1,format=yuv420p[v]"
        last = "v"
        if shot.get("title"):
            title = PROJECT / "graphics" / (hashlib.sha256(shot["title"].encode()).hexdigest()[:12] + ".png")
            args += ["-loop", 1, "-framerate", 60, "-i", title]
            hold = min(shot["duration"], shot.get("titleDuration", 3.3))
            filters += [f"[1:v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st={max(.3,hold-.35)}:d=0.35:alpha=1[t]", "[v][t]overlay=0:0:shortest=1[o]"]
            last = "o"
        if shot.get("end"):
            filters += [f"[{last}]fade=t=out:st={shot['duration']-.6}:d=0.6[e]"]
            last = "e"
        if not part.exists():
            ff([*args, "-filter_complex_threads", 1, "-filter_complex", ";".join(filters), "-map", f"[{last}]", "-an", "-frames:v", frames, "-r", 60, "-c:v", "libx264", "-preset", "fast", "-profile:v", "high", "-level:v", "4.2", "-b:v", "20M", "-maxrate", "24M", "-bufsize", "40M", "-g", 120, "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-threads", 2, part])
            write(part.with_suffix(".json"), {"sha256": digest(part), "identity": key})
        part_receipt = part.with_suffix(".json")
        if not part_receipt.exists() or read(part_receipt) != {"sha256": digest(part), "identity": key}:
            raise RuntimeError(f"Unverified retained segment {i}; preserve it and choose a new revision")
        m = probe(part)
        video = next(x for x in m["streams"] if x["codec_type"] == "video")
        if int(video["nb_frames"]) != frames:
            raise RuntimeError(f"Segment {i} frame count mismatch")
        editorial.append({"from": cursor, "to": cursor+shot["duration"], **shot})
        cursor += shot["duration"]
        print(f"{timeline['id']}: shot {i+1}/{len(timeline['shots'])} ready", flush=True)
    pcm = audio(timeline, catalog, revision)
    concat = segments / "concat.txt"
    concat.write_text("".join(f"file '{str((segments/f'{i:03}.mp4').resolve())}'\n" for i in range(len(timeline["shots"]))))
    ff(["-f", "concat", "-safe", 0, "-i", concat, "-i", pcm, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", 48000, "-ac", 2, "-t", cursor, "-movflags", "+faststart", output])
    write(output.with_suffix(".json"), {"sha256": digest(output), "timeline": timeline, "resolvedShots": editorial, "sourceRevisions": {k: v["source"] for k,v in catalog.items() if k in {s.get('source') for s in timeline['shots']}}, "sampling": "Offline sampled 60 fps, not a live performance benchmark", "audio": str(pcm.relative_to(PROJECT))})
    print(f"Final: {output}", flush=True)


def review(file):
    metadata = probe(file, True)
    video = next(x for x in metadata["streams"] if x["codec_type"] == "video")
    sound = next(x for x in metadata["streams"] if x["codec_type"] == "audio")
    receipt = read(file.with_suffix(".json"))
    expected = round(sum(s["duration"] for s in receipt["timeline"]["shots"]) * 60)
    assert (video["width"],video["height"],video["r_frame_rate"],video["codec_name"],video["pix_fmt"],video["profile"],int(video["nb_read_frames"])) == (1920,1080,"60/1","h264","yuv420p","High",expected)
    assert (sound["codec_name"],sound["sample_rate"],sound["channels"]) == ("aac","48000",2)
    assert all(video[x] == "bt709" for x in ["color_space","color_primaries","color_transfer"])
    out = PROJECT / "review" / file.stem
    out.mkdir(exist_ok=True)
    log = ff(["-i",file,"-af","ebur128=peak=true","-f","null","-"], True)
    (out / "audio-measurement.txt").write_text(log[-1400:])
    # Full sequential decode above; review stills include every edit boundary.
    times = sorted(set([0,.5,*[max(0,s['from']-.017) for s in receipt['resolvedShots']],*[s['from'] for s in receipt['resolvedShots']],*[s['from']+min(2.0,(s['to']-s['from'])/2) for s in receipt['resolvedShots']]]))
    sheet = Image.new("RGB", (1280, math.ceil(len(times)/3)*260), "#0b0e10")
    d = ImageDraw.Draw(sheet)
    for i,t in enumerate(times):
        png = out / f"frame-{t:07.3f}.png"
        if not png.exists():
            ff(["-ss",t,"-i",file,"-frames:v",1,"-vf","scale=420:-1",png])
        im = Image.open(png)
        x,y = (i%3)*426,(i//3)*260
        sheet.paste(im,(x,y));d.text((x+8,y+238),f"{t:.3f}s", fill="white")
    sheet.save(out / "boundaries.jpg")
    write(out / "technical.json", {"passed":True,"frames":expected,"metadata":metadata,"fullDecode":True,"reviewTimes":times})
    print(out, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["graphics","render","review"])
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--timeline")
    parser.add_argument("--revision", default="v1")
    args = parser.parse_args()
    PROJECT = args.project.resolve()
    if args.command == "graphics":
        graphics()
    elif args.command == "render":
        render(read(PROJECT / "timelines" / f"{args.timeline}.json"), args.revision)
    else:
        review(PROJECT / "finals" / f"{args.timeline}-{args.revision}.mp4")
