# Local boss karaoke experiment

This standalone experiment aligns the supplied Blight Treant lyrics to the
shipped recording. It does not enable lyrics in the game. Its placeholder layout
places lyrics centered between the combatants and the hand. Each word fills
with color between its inferred start and end; this is interpolation within a
word, not phoneme timing.

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
