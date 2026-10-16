# Local boss karaoke experiment

This standalone experiment aligns supplied boss lyrics to their shipped
recordings. Phrase-bounded output supplies the Battle UI timing snapshots for
The Blight Treant, The Forge Golem, The Frostwarden and The Iron Bear; see
[Audio workflow](../../Docs/AUDIO.md#local-lyric-alignment-experiment).
Running this tool does not itself replace that checked-in snapshot. Its placeholder layout
places lyrics centered between the combatants and the hand. Words appear as
their inferred start times arrive, building the phrase as it is sung. Earlier
words remain dimmed until the phrase ends; only the currently sung word is
highlighted. The highlight switches between whole words without a fill or motion
animation. Seeking backward hides words that have not yet been sung.

## Run locally

From the repository root, with Python 3.11:

```sh
python3.11 -m venv reports/boss-lyrics/venv
reports/boss-lyrics/venv/bin/pip install -r scripts/lyrics-trial/requirements.txt
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/align.py
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/assess.py reports/boss-lyrics/alignment-mix.json
cp scripts/lyrics-trial/preview.html reports/boss-lyrics/index.html
python3.11 -m http.server 8768 --bind 127.0.0.1
```

Open `http://127.0.0.1:8768/reports/boss-lyrics/`. Use the lyric selector and Jump
button to compare sections. The preview loads the local recording into a blob
so seeking also works with a simple HTTP server that does not support ranges.

For comparison with isolated vocals:

```sh
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/separate.py
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/align.py --audio reports/boss-lyrics/vocals.wav --output reports/boss-lyrics/alignment-vocals.json
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/assess.py reports/boss-lyrics/alignment-vocals.json
```

Use the preview’s Alignment input selector to compare results. Keep the original
mixed recording as the playback audio. Separation
preserves its timeline. The optional `transcribe-check.py` independently
transcribes selected excerpts to investigate differences between the written
lyrics and the performed song; its timestamps are relative to each excerpt.

The alternative `blight-treant-performance.txt` is a hypothesis about the performed
lyric sequence, informed by independent automatic transcription: omit the two
introductory lines not detected in the recording, add the detected opening
repeats, and repeat the bridge and final chorus detected later in the song.
The supplied original remains in `blight-treant.txt`. This is a text-order
adjustment, not an automatic repeat-reconciliation algorithm or a verified
transcript. To compare it without manually entering any timestamps:

```sh
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/align.py --lyrics scripts/lyrics-trial/blight-treant-performance.txt --output reports/boss-lyrics/alignment-performance.json
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/assess.py reports/boss-lyrics/alignment-performance.json
```

## Automatic phrase detection trial

```sh
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/phrase-align.py
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/assess.py reports/boss-lyrics/alignment-phrases.json
reports/boss-lyrics/venv/bin/python -m unittest discover -s scripts/lyrics-trial -p 'test_*.py'
cp scripts/lyrics-trial/preview.html reports/boss-lyrics/index.html
```

Choose **Automatically detected phrases + model retry** in the preview.
This pass transcribes the full recording independently with `small.en`, matches
contiguous ASR words against distinct phrases from the original lyric sheet,
and permits repeated or omitted phrases in the performed order. The original
sheet supplies spelling. Matches cannot cross an ASR gap over two seconds.
Word alignment then runs inside each detected phrase window, with 120ms padding
clipped against adjacent windows. This prevents a lyric phrase from being
stretched across a long instrumental section.

Clusters of at least three unmatched ASR words are also transcribed again with
`medium.en`; a replacement is accepted only when the confidence-weighted matched
lyric coverage increases. This is an automatic selection heuristic and can still
choose an incorrect phrase.

Phrases with a match score below 0.8, zero-duration words, or words longer than
2.5 seconds are
retried with `medium.en`. A retry replaces the first result only when its
structural timing penalty improves. That selection is a heuristic, not an
independent confirmation of audible accuracy. No manual timestamps or uniform
word-spacing repairs are used. `phrase-evidence.json` records match scores,
recognized text, unmatched ASR words, undetected written phrases, and retry
outcomes. These omissions must be reviewed alongside timing quality; fewer
flagged words alone does not establish a better or complete transcription.
The cached full transcript is reused only for the same recording hash.

## Other boss songs

The supplied `forge-golem.txt`, `frostwarden.txt` and `iron-bear.txt` match the
lyric metadata embedded in their shipped MP3s. Section labels, singer labels
and sound directions are excluded. Forge Golem's held chants are split into
single-word phrases for alignment candidates so a long rest does not stretch
one phrase across them. The runtime snapshot captions these uncertain groups as
`[chants]` instead of asserting unreliable word timings.
The matcher permits a one-word phrase as well as longer lines.

Use separate output directories to retain each song's evidence and transcript
caches. For example:

```sh
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/phrase-align.py --audio 'public/Music/The Forge Golem.mp3' --lyrics scripts/lyrics-trial/forge-golem.txt --output-dir reports/boss-lyrics/forge-golem --snapshot src/lib/audio/lyrics/forge-golem.json
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/assess.py reports/boss-lyrics/forge-golem/alignment-phrases.json --audio 'public/Music/The Forge Golem.mp3'
```

Substitute `frostwarden` / `The Frostwarden` or `iron-bear` / `The Iron Bear`
for the other songs. Iron Bear's repeated calls and overlapping final chorus
use shorter phrase boundaries, with dashes attached to the preceding word so
punctuation is not treated as a separate sung word. `--model` changes both initial
transcription and bounded word alignment; transcript caches include model
identity. Transcription uses temperature zero to avoid repeated stochastic
fallback decoding of instrumental noise. Suspect phrases and unmatched speech
regions still retry with `medium.en` by default. Frostwarden and Iron Bear's
review candidates use `--retry-model small.en`; larger-model comparison did not
reliably recover their difficult vocals. When a phrase has only one content
word, matching requires evidence for that word: shared grammar cannot turn
repeated "I am the lion" detections into "I am the blade".

`--snapshot` exports compact word timings with the recording hash, lyric hash,
duration, model, method and coverage counts. It refuses empty phrases,
non-finite, overlapping, zero-duration or out-of-recording word intervals;
it does not repair words. For an explicitly incomplete review candidate,
`--allow-incomplete` excludes an entire invalid phrase and records its text in
`rejectedTimingPhrases` and its count in coverage. The raw alignment and evidence
retain the rejected words; the preview must use the exported snapshot to review
exactly what the Battle UI will display. Export validation does not establish audible
accuracy. Keep timestamps relative to the original recording; Iron Bear's
six-second playback skip is already reflected by the media clock.

After copying `preview.html` to `reports/boss-lyrics/index.html`, the **Boss song**
selector opens each new song's exported runtime snapshot alongside its original recording.
Treant retains its comparison of mix, vocals, performance and phrase alignments.

## Targeted vocal-stem recovery

The missing lines were present in the supplied sheets. Some detections failed;
others lost a whole phrase because a brief word such as "and" received zero
duration. Isolating vocals and aligning with the neighboring lyric as context
can recover these passages without changing the word-timing validity rules.

Generate a full-length stem with the original recording's timeline and a hash
sidecar, then run the targeted recovery plan:

```sh
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/separate.py --audio 'public/Music/The Iron Bear.mp3' --output reports/boss-lyrics/iron-vocals.wav --device mps
reports/boss-lyrics/venv/bin/python scripts/lyrics-trial/recover.py --boss iron-bear --vocals reports/boss-lyrics/iron-vocals.wav --output reports/boss-lyrics/iron-recovered.json --evidence reports/boss-lyrics/iron-recovery-evidence.json
```

Use `--device cpu` on hosts without Apple GPU support. Substitute
`The Frostwarden`, `frostwarden`, and distinct output filenames for that song.
The output is a review candidate; writing it does not replace the runtime file.
The original recording remains the listening reference.

`recovery-regions.json` owns phrase search windows and neighboring source lines,
not word timestamps. Each region selects which aligned lines to apply. Iron
Bear's chorus uses dynamic attention-head selection (`8,3`); the broader
context recovers the weak "and" instead of inventing a minimum duration.
Other phrases use the default alignment heads. All word times come from the
model and the original media offset; none are interpolated or manually repaired.

Recovery verifies the recording, sheet and stem hashes and refuses a cropped or
different-duration stem. It preserves unselected passages and other occurrences
of repeated lyrics. It rejects word-count changes, invalid intervals, overlap
with an unselected neighbor, and any replacement that would erase additional
performed repeats. The complete result is validated before writing the candidate.
Evidence retains the full context alignment, including lines not selected for
replacement. Snapshot metadata distinguishes newly recovered and realigned lines.

This recovers three Iron Bear chorus repeats and its second "singe through hide",
and Frostwarden's missing "What freezes you", "I walk through the long sleep"
and two "What burns me" calls. The latter also require realigning the adjoining
responses, which previously started during the call.

Remaining uncertainties include Iron Bear's growled "Break him" / "Burn him"
and "I won't kneel" / "I won't fold", its final "remember what you bleed" and
one backing vocal, Forge Golem's other chants, and Frostwarden's nonlexical
"Aaaah". Independent transcription and a CTC alignment comparison of separated
vocals did not provide reliable confirmation for these passages. The runtime
snapshots describe them with `[growls]`, `[chants]`, or `[vocalizing]`, preserving
clear adjoining words. These cue rows use manually bounded vocal passages and
are recorded separately in `vocalCueMethod` and `coverage.vocalCuePassages`;
they are not recovered words. Instrumental breaks stay blank. Reapply these
authored cue rows when regenerating a snapshot from model output. Neither forced
positive intervals nor a supplied sheet alone proves the performed words and
their timing. Audible qualification remains necessary; these model checks do not
establish a listening pass.

Dependencies and models download on first use. Subsequent runs use local caches;
no audio or lyrics are sent to a service. Models, environments, vocal stems,
logs, and preview copies stay outside Git in ignored reports or model caches.
The requirements pin the main processing dependencies, including matching Torch
and Torchaudio versions; they are not a complete transitive lockfile.

## Interpreting the output

Section labels and sound directions are excluded from the lyric input. No word
timestamps are manually authored, interpolated to repair model failures, or
silently dropped. Inspection reports zero-duration words, suspiciously long
words, overlaps, bounds errors, and long gaps within lines. These are screening
heuristics, not proof of synchronization. The preview clears long gaps within a
line rather than holding text throughout an instrumental passage.

The generated provenance records the recording and lyric hashes, model, input,
and processing duration. A recording hash mismatch fails inspection. The supplied
lyric order must match the actual performance, including repeats; a forced
aligner cannot reliably recover missing or extra verses just from a lyric sheet.
Do not promote these experimental timings into shipping content without checking
both performance coverage and audible word synchronization.

Tools: [stable-ts](https://github.com/jianfch/stable-ts),
[Whisper](https://github.com/openai/whisper),
[Demucs](https://github.com/facebookresearch/demucs), and
[imageio-ffmpeg](https://github.com/imageio/imageio-ffmpeg).
