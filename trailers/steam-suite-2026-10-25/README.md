# Steam trailer production suite

Production project: `output/trailers/alchemy-directors-cut-2026-10-25` in the
original workspace. It contains independent current-main capture bundles,
editable JSON timelines, separate PNG overlays and closing graphics, original
music, native sound cues, PCM mixes, reusable encoded shots, final MP4s and review
evidence. Protected prototype footage is linked, never duplicated or modified.

The five treatments are **Every Card Counts**, **A Run Through Alchemy**,
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
  --timeline 01-every-card-counts --revision v2
python3 scripts/edit.py review --project /absolute/path/to/project \
  --timeline 01-every-card-counts --revision v2
```

Run capture, rendering and full decode review inside the bounded shared host
lane documented in [TRAILERS](../../Docs/TRAILERS.md). The Python finishing tool
needs Pillow, NumPy and FFmpeg/ffprobe; `countess_review.py` also uses SciPy for
independent audio-clock correlation. The prepared project carries its Inter
font. Captures and finals are offline sampled 60 fps, not live performance
benchmarks. Full decode, codec/frame assertions, boundary images and loudness
measurements do not establish subjective creative quality or listening approval.
Read the output project's final creative review before selecting a store trailer.

The captured Wizard turn takes damage after its offensive sequence, so the
initial “Perfect Turn” working title was replaced with “Every Card Counts.”
`combat-stories.json` adds complete Knight and Druid turns with enemy responses.
The five short 4K detail takes keep menu reframing crisp; the Armory crop stays
wide enough to retain its heading and equipped slot. Canary review caught missing
color primaries after zoom composition; the finisher now applies explicit frame
color parameters and the canonical renderer's H.264 metadata bitstream filter.

English titles are external base-video recipe data, separate from shipped UI
translations. Additional language versions can use separate timelines/overlays.
No source gameplay, game wording or locale catalog is changed.

## Directed Countess revision

V1 is retained as a baseline. `countess-directed-v2.json` stages three deliberate
turns from song time zero, placing the third turn's Shield Bash near the final
chorus lyric. The attack and its real consequence replace a neutral closing
deal. No health, damage, deck or game rules are overridden.

`capture-session.mjs` reuses the canonical capture owner. It pins native video
buffers to frame zero before sampling, records per-second health/lyric evidence,
and can replay the same inputs while recording only specified native 4K windows.
`countess-windows-v2-a.json` and `-b.json` bound those detail batches; each replay
stops after its last required window. No full 4K performance is duplicated.
The runner reserves an estimated 18 GiB disk floor. Incomplete selected captures
stay diagnostic; they are never accepted by full-master recovery.

```sh
node trailers/steam-suite-2026-10-25/capture-session.mjs \
  --recipe trailers/steam-suite-2026-10-25/countess-directed-v2.json \
  --bundle /absolute/project/sources/countess-v2-main
node trailers/steam-suite-2026-10-25/capture-session.mjs \
  --recipe trailers/steam-suite-2026-10-25/countess-details-v2.json \
  --windows trailers/steam-suite-2026-10-25/countess-windows-v2-a.json \
  --bundle /absolute/project/sources/countess-v2-details-a
```

Use a separate bounded host lease for each command. Repeat the selected command
with window batch B and a fresh `countess-v2-details-b` directory. Before editing,
compare each replay's health and native lyric samples to the main take. Detail
receipts carry their exact song offsets, native dimensions, frame counts and
source-window provenance. The custom finisher can then alternate vocal closeups,
decision inserts and full tactical context without replacing native lyrics.

`review_assets.py` makes separate 720p30 chat copies under 20 MB, contact sheets
from full-resolution exports, and actual-frame posters. It verifies the proxy's
AAC packets match the master. Delivery compression never changes master FPS.

Valve's [current trailer guidance](https://partner.steamgames.com/doc/store/trailer)
specifies delivery up to 1920×1080, supports 60 fps and prefers H.264/AAC. The
editorial brief follows its gameplay-first and silent-comprehension guidance:
retain HUD context, avoid opening logo holds, keep complete decisions and
consequences, use sparse titles and close with a clear invitation. Files are
local review masters; approved review copies are saved privately in ChatGPT
Library. Nothing is published.

## Current music-video direction

All earlier full films are historical drafts. The active review candidate is
`06-countess-music-video-opening-v1.mp4`, a 10.683-second opening excerpt from
song time zero, with locked crops, no corner captions, current game fixes and
the legal catalog build documented in `sources/director-state-v1/`.
It shows a real Block / Spiked Shield / Shield Bash interaction and short actual
purchase, construction and equipment reveals. The first vocal starts at 20.68s,
so this instrumental opening does not establish lyric-closeup quality.

`music_map.py` saves measured accents, a tempo guide and authoritative native
word/phrase anchors. `catalog-audit.mjs` audits unique playable full-game IDs and
copies selected unchanged catalog art; `stats_panels.py` makes large numeric
recap options. Their counts are full-game claims, not demo claims.

New edits enforce current battle visuals, the Countess's own native song clock,
no other boss under that track, no corner titles and locked camera positions.
Static reframes use fixed even-pixel crops, rather than an animated zoom.
`sfxMode: tails` retains native sound tails across visual cuts. Capture receipts
retain actual end-save checkpoints for a separately validated continuation.

The first longer opening attempt rejected an Anvil input after End Turn; its
diagnostic footage is preserved. The shorter fresh canary passes every directed
input. Second-turn presentation timing still needs focused validation before a
long performance is recorded. Do not reuse the failed master as accepted media.
