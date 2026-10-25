# Automated gameplay trailers

The trailer pipeline stages real gameplay in an isolated Chromium profile, captures
frames offline, and renders a directed edit with Remotion and FFmpeg. No player
save, normal browser profile, desktop window or full video editor is required.
Local commands do not upload or publish videos.

## Setup and first trailer

Install the repository dependencies, then the separate, pinned media tools:

```sh
npm run trailer -- setup
npm run trailer -- doctor
npm run trailer -- plan --recipe trailers/boss-spotlight.json
```

Install FFmpeg with libx264 and AAC encoding plus ffprobe on the capture machine
(`brew install ffmpeg` on macOS). Install the repository's Playwright Chromium
with `npx playwright install chromium` if it is missing. On Linux use the
appropriate Playwright system dependencies too. `ALCHEMY_TRAILER_FFMPEG` and
`ALCHEMY_TRAILER_FFPROBE` can select explicit executable paths.

On the shared Mac, media production uses the bounded host lane from
`/Users/ryanmcintire/Developer/.coordination/README.md`. For example:

```sh
python3 /Users/ryanmcintire/Developer/.coordination/heavy_lane.py \
  --owner <thread-id> --wait 30 --timeout 900 -- \
  npm run trailer -- capture --recipe trailers/boss-spotlight.json --bundle output/trailers/my-capture

python3 /Users/ryanmcintire/Developer/.coordination/heavy_lane.py \
  --owner <thread-id> --wait 30 --timeout 900 -- \
  npm run trailer -- render --bundle output/trailers/my-capture
```

Use separate capture and render leases on the shared Mac: the full lossless 4K
recipe can take longer than one 15-minute lease when both phases are combined.
`make` combines the phases for a dedicated runner or shorter review recipe.

`--draft` captures at device scale 1 and renders at half the delivery dimensions.
Frame rate, actions, music positions and edit timing stay identical. Drafts are
explicitly identified in the receipts. A draft is not production-quality evidence.
The same commands work on a dedicated Linux/macOS capture machine without the
shared Mac lane wrapper. Rendering uses one worker. Directed compilations decode exact lossless source
frames on demand through a private local frame server with a 64 MiB memory cache.
They retain native source resolution without expanding the full edit to temporary
PNG files. Successful exports remove their remaining temporary composition files.

The manual **Gameplay trailer production** GitHub Actions workflow provisions an
Ubuntu runner and stores the complete result as a private workflow artifact for
30 days. It runs only on explicit dispatch, never on pushes or PRs. Its offline
capture does not need a real-time GPU recording rate; review platform rendering
before accepting that runner as a visual baseline. Nothing publishes to Steam or
social media. The workflow can later be moved to a dedicated GPU runner.

## Cinematic feature compilation

[The directing script](../trailers/alchemy-cinematic-direction.md) explains the
research, shot-by-shot paper cut, 28 separate 4.5-second takes, capture truth rules,
and revision workflow for [the cinematic recipe](../trailers/alchemy-cinematic.json).
The first cut mixes real battle with heroes, drafting, cards, shops, brewing,
Campfires, Corruption, Labyrinth, modes, Armory, Talents, Homestead and Companions.
Source takes are 4K60; Steam delivery is 1080p60. Camera paths and transitions are
applied during composition, leaving the independent masters unchanged.

Capture a few takes per resource lease with `capture --clips id,id --bundle <path>`.
Repeat against the same source and recipe to build the library incrementally;
completed takes are validated and reused. Omit `--clips` to capture the remaining
takes. Partial bundles can render an edit using only their available clips.
`capture.json` records whether all planned takes are present. Existing exports
require a new `--label`, so revisions never overwrite an earlier cut.

Battle takes normally synchronize their own native lyrics. Set a take's
`lyrics: false` for neutral coverage or a different boss under the shared music
bed. This makes those takes freely reorderable. A synchronized take must be
recaptured when its final music position changes. No trailer lyric overlay is used.

The capture-only runtime synchronizes newly created WAAPI animations and Motion's
explicit start times with the gameplay clock. This prevents opacity from finishing
on the compositor's wall clock while gameplay is paused. Per-frame combat feedback
samples record opacity, scale and travel for review. No production animation,
combat text, game rule or playback timing is changed. Recording serves the game
with release feature flags, so development spawn controls are absent.

## Blood Countess battle prototype

`trailers/blood-countess-battle.json` records exactly 60 seconds of battle at the
normal full-screen framing. It uses her current five idle animations, her own
music starting at the first verse, the native battle lyric display, and natural
card inspections and plays. There are no cuts, camera moves or end card. The
pointer travels above the hand over 0.3 seconds, enters the selected card
vertically and pauses for roughly 1.3 seconds (50% faster decisions than the
original prototype). It anchors focus on the inspected card, clicks without
moving to another card, then leaves the hand immediately before cards reflow
beneath it. Its appearance is hidden while hover feedback
remains visible. Enemy responses retain normal timing.

The Knight inspects and plays available cards in this authored priority:
Anvil, Plate Mail, Sunder, Spiked Shield, Block, Shield Bash, Bash. This places
Forge and permanent Armor before attacks, armor removal before later damage,
and Block generation before Shield Bash. Four cards are played per full turn
when available. This is a directed starter-deck sequence, not a general combat AI.
Each play must match the inspected hand identity after at least one second of
inspection; recording fails if that condition or card acceptance is missing.
This continuous Mac prototype captures native 1920×1080 at 60 fps, matching Steam
delivery without upscaling. Set capture scale to 2 for a 4K source on a production
worker with a longer recording window. Lyrics stay inside the boss portrait.

```sh
npm run trailer -- capture --recipe trailers/blood-countess-battle.json --bundle output/trailers/countess
npm run trailer -- render --bundle output/trailers/countess
```

Use separate bounded host-lane leases on the shared Mac, as above. This continuous
shot encodes directly from the sampled master without a second browser composition
or temporary PNG cache. Directed compilations still use Remotion.

## Capture once, revise the edit

```sh
npm run trailer -- capture --recipe trailers/boss-spotlight.json --bundle output/trailers/my-capture
npm run trailer -- render --bundle output/trailers/my-capture
npm run trailer -- render --bundle output/trailers/my-capture --recipe trailers/my-edit.json --label tighter-cut
npm run trailer -- render --bundle output/trailers/my-capture --format vertical
npm run trailer -- inspect --bundle output/trailers/my-capture
```

Wrap capture/render in the host lane on the shared Mac, as above. Existing files
are never overwritten. Use `--label` for another export of the same format; use a
fresh bundle for changed capture instructions. If capture is interrupted after a
master finishes, use this command under a host-lane lease:

```sh
npm run trailer -- recover --bundle <directory>
```

Capture writes provenance at startup
and journals its actual inputs, native UI samples and sound cues before media
indexing. Recovery validates complete frame/packet counts and finalizes that
journal. For older bundles lacking a journal, it can reconstruct a clearly labeled
trace from the retained starting save; the original master stays untouched, and
health-text pixels must match its retained opening/middle/ending PNGs exactly.
Incomplete media or a mismatched replay fails recovery.

A render validates clip hashes, capture instructions, source frame rate and soundtrack identity before reuse.
Native lyrics are part of the captured battle: changing a clip's position against
the music requires recapture. Separate clip IDs allow the same staged encounter
to be captured at different music positions in a montage.
The complete bundle is portable: music, lyrics, logo, font, sound cues, raw clips,
resolved recipe, source identity, receipts and review stills travel together.
Keep the whole bundle outside Git. The default `output/trailers/` destination is outside diagnostic age pruning and
ordinary cleanup. Task finishing preserves these files in its integration evidence
bundle; copy retained production masters somewhere durable for long-term storage.

## Direction recipe

[`trailers/boss-spotlight.json`](../trailers/boss-spotlight.json) is the working example.
The strict schema is owned by `scripts/trailers/model.mjs`; `plan` prints the
resolved timeline and fails invalid inputs before launching a browser.

- **Capture:** logical viewport, device scale and 30 or 60 samples per second.
  Default 1920×1080 at scale 2 captures 3840×2160 without changing the game's
  logical layout. Captures retain lossless H.264 4:4:4 at CRF 0 with every frame
  independently seekable. This avoids quality loss and long-GOP seek costs
  before the final delivery encode.
- **Clips:** named boss, menu, heroes, Collection, Homestead, Armory, Options or
  checkpoint scenes, seed, hero, duration and timed inputs. Boss staging uses
  production starting cards and a production boss destination; there are no
  invented cards, forced damage or changes to combat rules. For developed builds,
  select `scene: "checkpoint"` and a `checkpoint` path containing a current-format
  save. Checkpoints must match the captured source revision's save format.
- **Inputs:** `play-card` chooses the first visible enabled card; `click` and
  `hover` use one exact role/name, test ID or CSS selector, plus optional index.
  `move-away` clears hover. Missing, disabled, covered or inert targets fail the
  capture. All inputs use real pointer events. `moveDuration` (default 0.3 seconds)
  moves the hidden pointer smoothly before its action time. Hand targets use stable
  slot geometry so fan rotation and hover lift do not select the adjacent card.
  Automatic `play-card` prefers the inspected card if playable, then the first
  playable card. Captures
  require the played hand identity to leave or enter its transfer animation.
  Missing acknowledgments fail rather than recording a rejected click as a play.
  A hover target can use `cardPriority: ["Anvil", "Sunder", "Bash"]` to inspect
  the first currently playable card in that list. The following untargeted
  `play-card` prefers the inspected card. Recipes using ordered inspection
  require a one-second dwell on the same hand identity before clicking.
  Pointer paths travel above the fan to avoid incidental hovers, and card plays
  anchor focus on the intended card for its native mouse click, then immediately
  clear the pointer from the reflowing hand. Receipts include paths
  and every sampled change in the hovered hand identity.
  Inputs do not dispatch state mutations. Times are relative to the staged clip,
  in seconds.
- **Shots:** clip, source `in`, output duration and optional speed. `framing`
  accepts `steam`, `vertical` and `square` camera paths. Each path has `from` and
  `to`, with normalized focus `x`/`y` and `zoom` from 1–4. Smooth easing connects
  the endpoints; bounds prevent black edges. Zoom 2 can use a 4K source at 1080p
  without upscaling. Greater zoom depends on the source art's detail.
- **Transitions:** incoming `cut`, `dissolve` or `wipe`; duration is in seconds.
  Dissolves/wipes overlap the preceding shot and shorten the total timeline by
  that amount. The first shot cannot overlap. `plan` reports exact frame starts.
- **Music:** a registered boss track, source offset, gain and fades. Offsets refer
  to the original recording, including Iron Bear's opening; the game's playback
  skip is not added a second time. Lyric snapshots must match the track's SHA-256.
  `lyrics: true` records the game's own lyric display at its fixed battle position,
  near the bottom inside the boss portrait. Lyrics never appear on menus or as a trailer overlay.
  The isolated audio clock follows the final soundtrack position while the actual
  audio is mixed later. Each battle must match the soundtrack boss and play at
  normal speed. Reusing one clip at conflicting music times fails admission;
  use separate clip IDs and recapture for those positions. Instrumental gaps and
  word highlighting come from the existing game component.
- **End card:** duration and text; duration 0 omits it for battle-only prototypes. Text is recipe data, separate from shipped UI
  translations; choose localized wording in a separate recipe when needed.

The original audio-host guard is preserved. The isolated capture page uses the
existing test player-host adapter and records Audio play/pause requests without
sounding them. Sound-effect files, offsets, gain, stop times and cue timestamps are
then mixed against the edited timeline. Normal gameplay audio is unchanged.

## Quality and verification

The renderer samples JavaScript timers/rAF, CSS/Web Animations and video positions
on a controlled clock. It captures each frame before advancing. This is offline
presentation sampling, not a claim that the Mac sustains 4K60 in real time or a
bit-identical recording of a live player's rendering. Review new animation types
and unfamiliar embedded media before adding them to approved trailer recipes.
No snapshot uses disabled/reduced animations. Reproducible inputs do not guarantee
bit-identical pixels across different browser, OS, font or GPU versions; the bundle
records its source and browser version. Sound and frame clocks must agree;
misaligned cues fail capture instead of silently producing a music-only edit.

For each capture, the browser raster density is pinned and checked; every PNG's
actual pixel dimensions must match the requested source before encoding. The
encoder cannot resize a screenshot to conceal a mismatch. Frame count, encoded
dimensions and frame rate are also checked with ffprobe. Intra-only sources use
container frame counts and independent packet counts, avoiding a second full 4K
decode during capture finalization. Export performs the full decode and fails on
media decoding errors.
Receipts retain the actual performed input labels, bounds, pointer travel and card
acceptance times, native lyric positions, idle-video playback samples, sound cues, source
hash, browser version and beginning/middle/end frame hashes. A failed capture
retains its diagnostics and partial output but cannot be rendered as successful.
Each final export is checked for H.264, 4:2:0, exact dimensions/frame count/rate,
AAC stereo and 48 kHz audio. Opening, gameplay and end-card stills are rendered
alongside it. Watch and listen to the full final video: file checks cannot prove
readable framing, useful action, lyric accuracy or audible synchronization.

| Delivery             | Dimensions                   | Target                                               |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| Steam                | 1920×1080, 16:9              | 60 fps by default, H.264 High, approximately 20 Mbps |
| Vertical social edit | 1080×1920                    | Same source timing, independently directed framing   |
| Square social edit   | 1080×1080                    | Same source timing, independently directed framing   |
| Audio                | AAC stereo, 48 kHz, 320 kbps | Mix target -14 LUFS, -1 dBTP; listen before approval |
| Color                | SDR Rec.709, 8-bit 4:2:0     | Correct conversion/tagging through Remotion          |

The encoding bitrate and loudness values are production choices, not platform
mandates. [Valve's current specification](https://partner.steamgames.com/doc/store/trailer)
recommends uploads up to 1920×1080 at 30/29.97 or 60/59.94 fps, high bitrate
(5,000+ Kbps), H.264 and AAC, and 16:9. Its example preset uses 20 Mbps video.
4K capture is for reframing and retained source quality; Steam delivery stays 1080p.
The first Steam trailer should communicate recognizable gameplay quickly with
the HUD visible and work with sound muted. Steam generates its own six-second
microtrailer from six moments in the first listed video.

Use the same tools and recipes on another machine for production; no Mac-only
capture API is required. Provisioning a cloud account, dispatching CI, uploading
or publishing assets is a separate operation. Broad repository checks remain
CI-owned under [Contributing](../CONTRIBUTING.md).
