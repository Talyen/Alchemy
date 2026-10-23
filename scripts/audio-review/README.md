# Sound desk

Standalone current/proposed audio auditions. [Audio](../../Docs/AUDIO.md) owns
runtime registration and playback; [asset preparation](../../Docs/WORKFLOWS-ASSETS.md#add-or-replace-sound)
owns installed media. Choices and previews do not change either.

## Prepare and reopen

```sh
npm run audio:review -- --serve
npm run audio:review -- --serve-only
npm run audio:review -- --check
```

Open [localhost:4317](http://127.0.0.1:4317/); stop the server with Ctrl+C.
`--serve` regenerates, while `--serve-only` reopens the last snapshot. Regenerate
after mapping or catalog changes. `--check` validates coverage, selected paths and
hashes without writing previews. Use `--library '/full/path/to/Sounds'` to relocate
the library and `--port 4318` when the port is occupied. Keep the port when
reopening to retain browser-local choices. Snapshots under ignored
`reports/audio-review/` follow [transient cleanup](../README.md#cleanup-clean--explicit-reset-prunetransient--expiry).

The server exposes only board files and prepared media, not the library or
repository. If the installed encoder lacks its binary, restore it with
`node node_modules/ffmpeg-static/install.js`.

## Review and export

The Remaining queue shows one undecided mapping; Chosen revisits decisions.

1. Listen to Current, Recommended or an Alternative; listening does not select it.
2. Choose this, Keep current or No sound saves and advances. Skip leaves it undecided.
3. Undo last choice restores the preceding decision and notes.
4. Export before sharing choices or changing browser/port.

Keys 1, 2–5 and 0 keep current, select candidates and choose silence; arrows navigate.
Typing controls ignore these shortcuts. Advancing never plays automatically.
More controls contains preview levels, filters, repeats and automatic advance.
Current sequences omit silent/unused registrations; Your choices labels the
recommendation used for undecided rows.

```sh
npm run audio:review -- --choices '/full/path/to/export.json'
```

Import merges into an ignored snapshot retained by regeneration. Valid browser
choices take precedence. Unknown mapping/candidate IDs reject the entire import;
only choice IDs, notes and review state are imported. Source metadata comes from
the manifest, and the supplied export is never modified.

Auditions stop on replacement, filtering, page hiding or Stop all. Sequences do
not trigger gameplay. Playback/autoplay failures leave the board usable with a
visible error.

## Battle replacement auditions

```sh
npm run audio:review -- --battle-focus --serve --port 4318
```

Focused files and browser choices are separate under `reports/audio-review/battle-focus/`.
Reopen with `--battle-focus --serve-only`; import with `--battle-focus --choices <file>`.
Companion choices also apply to summon cards; enemy abilities use their card cue.
Will-o'-Wisp's Companion row owns its shared decision in the focused queue.

## Identity and evidence

[Curated mappings](../../Docs/design/audio-review/mappings.json) own candidates,
excerpts, assignments and rationales; [approved choices](../../Docs/design/audio-review/approved-choices.json)
own installed selections. The command entry is `scripts/audio-review.mjs`;
`core.mjs`, `media.mjs` and `server.mjs` in this directory own validation,
conversion and serving. Generated mappings/report files retain source evidence
and provenance; code occurrences alone do not prove execution or licensing.

Every card/Companion needs a focal assignment and battle/UI/stinger registrations
need review rows. Generation decodes both preview levels before publishing and
checks source/output hashes on cache hits. Identical recordings/excerpts share a
conversion while retaining provenance; duration comes from PCM bytes. Missing or
undecodable selected media fails; unselected stale paths are reported separately.
Without `reference/catalog.csv`, selected masters/hashes remain required and
inferred pack/recording names are labeled as such. Malformed catalogs and
conflicting source identities still fail.

Matched levels preserve dynamics at 48 kHz stereo 16-bit PCM; gain/excerpt settings
belong to [media.mjs](./media.mjs), separately from production OGG/MP3 preparation.
Original-level previews apply no gain. Unattributed sources remain unverified
shipping selections. Listen before approving a take, trim, layer or loop seam.
