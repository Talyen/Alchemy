# Boss lyric alignment

This local tool produces review candidates for the checked-in boss timing snapshots.
[Audio](../../Docs/AUDIO.md#local-lyric-alignment-experiment) owns runtime synchronization;
[Battle UI](../../Docs/UI_BATTLE.md#boss-lyrics) owns placement and word highlighting.
A valid timing file still requires performed-lyric coverage and audible review
before replacing a runtime snapshot.

## Set up and compare

From the repository root, using Python 3.11, the managed launcher creates and
updates its own environment on first use and automatically owns it while running:

```sh
npm run lyrics:tool -- align.py
npm run lyrics:tool -- assess.py reports/boss-lyrics/alignment-mix.json
cp scripts/lyrics-trial/preview.html reports/boss-lyrics/index.html
python3.11 -m http.server 8768 --bind 127.0.0.1
```

Open [the preview](http://127.0.0.1:8768/reports/boss-lyrics/). It plays the original
recording through a blob so seeking works without HTTP range support. The selectors
compare songs and alignment inputs; seeking backward clears later words.
The managed environment lives in `.cache/alchemy-lyrics-venv`, separate from retained
evidence in `reports/boss-lyrics/`. It expires after 30 days without use when no
managed tool holds its inherited OS lock. Existing `.cache/lyrics/venv` environments
remain supported but are not automatically removed. Models/dependencies download on first use and cache locally. No audio or lyrics
are sent to a service. Environments, models, stems and evidence remain ignored;
requirements pin core packages, including matching Torch/Torchaudio, without a
complete transitive lockfile.

## Choose an alignment

- `align.py` aligns a supplied lyric sequence. `--audio`, `--lyrics` and `--output`
  select inputs/output. `blight-treant-performance.txt` is an unverified performed-order
  hypothesis; `blight-treant.txt` preserves the supplied original.
- `separate.py` produces full-length isolated vocals on the original timeline.
  Use those for alignment comparisons, retaining the original mix for listening.
- `transcribe-check.py` independently transcribes excerpts; its times are excerpt-relative.
- `phrase-align.py` detects performed phrase order before bounded word alignment.
  It permits repeats/omissions rather than stretching supplied lines over instrumental gaps.

```sh
npm run lyrics:tool -- separate.py
npm run lyrics:tool -- align.py --audio reports/boss-lyrics/vocals.wav --output reports/boss-lyrics/alignment-vocals.json
npm run lyrics:tool -- phrase-align.py
.cache/lyrics/venv/bin/python -m unittest discover -s scripts/lyrics-trial -p 'test_*.py'
```

[Phrase matching](./phrase_match.py) owns word/gap/confidence rules;
[phrase alignment](./phrase-align.py) owns bounded windows, deterministic transcription,
model retries and selection heuristics. `--model` selects initial transcription/alignment;
`--retry-model` selects retries; the retained Frostwarden/Iron Bear candidates use
`small.en` retries. Cache identity includes the recording hash and model.
`phrase-evidence.json` records matches, unmatched recognized speech, undetected written
phrases and accepted/rejected retries. Better structural scores do not establish
complete or accurate lyrics.

## Blood Countess import

Blood Countess's “One More Heartbeat” timings are imported from Trinket's
`MusicManifest/lyrics/boss_blood_countess.json` at commit `76cacf41a`, paired with
the unchanged shared `The Blood Countess - Boss Track.mp3` master. Its
`blood-countess.txt` sheet preserves the performed phrases from that snapshot;
the original authored sheet was unavailable. `importedFrom` retains the upstream
snapshot and lyric-sheet hashes, while `lyricsSha256` hashes the local sheet.
The preview's **Boss song** selector opens the imported snapshot directly.

## Export another boss

Use distinct evidence directories for Forge Golem, Frostwarden and Iron Bear:

```sh
npm run lyrics:tool -- phrase-align.py --audio 'public/Music/The Forge Golem.mp3' --lyrics scripts/lyrics-trial/forge-golem.txt --output-dir reports/boss-lyrics/forge-golem --snapshot reports/boss-lyrics/forge-golem/candidate.json
npm run lyrics:tool -- assess.py reports/boss-lyrics/forge-golem/alignment-phrases.json --audio 'public/Music/The Forge Golem.mp3'
```

Substitute each song's supplied sheet and original recording. Section/singer labels
and sound directions are excluded. Phrase matching requires evidence for content
words even in short phrases; repeated grammar alone cannot establish a match.
[Snapshot export](./snapshot.py) records media/lyric hashes, model, method, duration
and coverage. It rejects empty, non-finite, overlapping, zero-duration or out-of-bounds
word intervals. `--allow-incomplete` excludes the whole invalid phrase and records
it in `rejectedTimingPhrases`; raw evidence retains the rejected words. Preview the
exported snapshot to judge exactly what the game would display.

For non-Treant candidates, change only the snapshot fetch URL in the ignored
`reports/boss-lyrics/index.html` copy to `./forge-golem/candidate.json` (or the
matching candidate path), then select that boss. The unmodified preview reads
`src/lib/audio/lyrics/<boss>.json`, so selecting a boss alone does not review a
new export. Keep the original recording as playback audio.

Keep times relative to the original recording. Iron Bear's playback skip is
already represented by the media clock and must not receive a second offset.

## Targeted vocal recovery

[Recovery regions](./recovery-regions.json) own phrase search windows and neighboring
source lines, not word timestamps. Generate a full-length stem with its hash sidecar:

```sh
npm run lyrics:tool -- separate.py --audio 'public/Music/The Iron Bear.mp3' --output reports/boss-lyrics/iron-vocals.wav --device mps
npm run lyrics:tool -- recover.py --boss iron-bear --vocals reports/boss-lyrics/iron-vocals.wav --output reports/boss-lyrics/iron-recovered.json --evidence reports/boss-lyrics/iron-recovery-evidence.json
```

Use `--device cpu` without Apple GPU support; Frostwarden uses its own inputs/output.
[Recovery](./recover.py) verifies media/sheet/stem hashes and full duration, aligns
with neighboring context, and applies only selected lines. It rejects word-count
changes, invalid intervals, overlap with unselected neighbors or lost repeats.
Evidence retains the full context and distinguishes recovered from realigned lines.
Writing a candidate never installs it. Times come from the model plus original
media offset; no interpolation or forced minimum word duration repairs are allowed.

## Review and promote

1. Assess hash identity, word durations, overlaps, bounds and long internal gaps.
   The preview clears long gaps rather than holding words over instrumental breaks.
2. Listen against the original recording and compare performed words, repeats and
   omissions. Supplied sheets and forced alignment alone cannot confirm them.
3. Preserve unresolved passages as bounded `[growls]`, `[chants]` or `[vocalizing]`
   cues, leaving instrumental breaks blank. Runtime snapshots record authored cue
   bounds separately in `vocalCueMethod` and `coverage.vocalCuePassages`; reapply those
   rows after model regeneration. They are not recovered word timings.
4. Replace the checked-in snapshot only after coverage and synchronization review.
   Keep generated diagnostics with the candidate evidence rather than adding a
   narrative of recovered passages to this guide.

Tools: [stable-ts](https://github.com/jianfch/stable-ts),
[Whisper](https://github.com/openai/whisper), [Demucs](https://github.com/facebookresearch/demucs)
and [imageio-ffmpeg](https://github.com/imageio/imageio-ffmpeg).
