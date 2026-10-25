# Steam trailer production suite

Production project: `output/trailers/alchemy-directors-cut-2026-10-25` in the
original workspace. It contains independent current-main capture bundles,
editable JSON timelines, separate PNG overlays and closing graphics, original
music, native sound cues, PCM mixes, reusable encoded shots, final MP4s and review
evidence. Protected prototype footage is linked, never duplicated or modified.

The five treatments are **The Perfect Turn**, **A Run Through Alchemy**,
**A Home Worth Fighting For**, **The Boss Gauntlet**, and **One More Heartbeat**.
The Countess performance starts at song time zero, keeps the game's native
lyrics, and runs through the first full chorus. Other footage has native lyrics
disabled and can be reordered under a different music bed. Valid independent
checkpoints illustrate the game's systems; these edits do not claim to show an
uninterrupted progression run.

The `capture-*.json` files in the output project preserve capture instructions.
Use the repository's existing `npm run trailer -- capture` owner. Each capture
uses an isolated headless Chromium profile, current local main, release feature
flags and the production input path. No player save or normal browser is opened.
The native hidden pointer moves through the existing corridor above the hand;
inspection, card identity, accepted plays, sound and lyric samples are retained.

`plan.py` creates the initial paper edits. Change the output project's timeline
JSONs directly for further editing. `edit.py` renders bounded reusable shots,
mixes original music and recorded native sound, measures and normalizes loudness
in two passes, then creates 1080p60 H.264 High / Rec.709 MP4s with stereo 48 kHz
AAC. Every cut preserves source speed. Native lyric clock mismatches fail before
rendering. Existing final filenames cannot be overwritten; use a new revision.

```sh
python3 scripts/edit.py graphics --project /absolute/path/to/project
python3 scripts/edit.py render --project /absolute/path/to/project \
  --timeline 01-the-perfect-turn --revision v2
python3 scripts/edit.py review --project /absolute/path/to/project \
  --timeline 01-the-perfect-turn --revision v2
```

Run capture, rendering and full decode review inside the bounded shared host
lane documented in [TRAILERS](../../Docs/TRAILERS.md). The Python finishing tool
needs Pillow, NumPy and FFmpeg/ffprobe; the prepared project carries its Inter
font. Captures and finals are offline sampled 60 fps, not live performance
benchmarks. Full decode, codec/frame assertions, boundary images and loudness
measurements do not establish subjective creative quality or listening approval.
Read the output project's final creative review before selecting a store trailer.

English titles are external base-video recipe data, separate from shipped UI
translations. Additional language versions can use separate timelines/overlays.
No source gameplay, game wording or locale catalog is changed.

Valve's [current trailer guidance](https://partner.steamgames.com/doc/store/trailer)
specifies delivery up to 1920×1080, supports 60 fps and prefers H.264/AAC. The
editorial brief follows its gameplay-first and silent-comprehension guidance:
retain HUD context, avoid opening logo holds, keep complete decisions and
consequences, use sparse titles and close with a clear invitation. Files are
local review deliverables; nothing is published or uploaded.
