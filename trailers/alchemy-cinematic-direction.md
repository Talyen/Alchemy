# Alchemy: cinematic gameplay trailer, first cut

## Creative brief

Make the viewer want to build a strategy and test it against Alchemy's bosses.
The first image is a real card battle, with the hand and HUD visible. The film
then follows a small player story: choose a hero, shape a deck, make risky choices,
invest in the next run, and face a succession of stronger opponents. End on the
Blood Countess and the Alchemy logo. This is a 63.9-second first cut for review.

The executable edit is [alchemy-cinematic.json](./alchemy-cinematic.json).
Each of its 28 takes is an independent 4.5-second, 3840×2160, 60 fps lossless
master. The initial cut uses 19 of those takes; the other nine are alternate
coverage, not discarded footage. Delivery is 1920×1080 at 60 fps. Retain the
entire source bundle. Editing the shot list never overwrites a take or a prior
export. Capture is automated; no desktop capture or full video editor is used.

## Research translated into direction

- **Games:** Steam recommends showing recognizable gameplay immediately, keeping
  the HUD useful, and making the product understandable without sound. Accordingly,
  the opening retains both combatants, health and hand; there is no opening logo
  or lore card. [Steamworks: Trailers](https://partner.steamgames.com/doc/store/trailer).
- **Film:** Vary tension, give the viewer an intelligible premise, and build toward
  a payoff which the trailer teases rather than resolves. The relative quiet of
  a Campfire and Homestead gives the later boss montage more force. Use hard cuts
  on clear actions, with only two short dissolves at changes of mood.
  [Adobe: Making a movie trailer](https://www.adobe.com/creativecloud/video/discover/make-a-video-trailer.html).
- **TV promos and film campaigns:** Becci Jones describes beginning with the brief,
  selecting material and music, then shaping the trailer collaboratively. The
  subject and its unique appeal must carry the edit. Here the brief becomes a
  reusable shot library and a reviewable paper cut before production; the cut
  remains easy to reorder after feedback.
  [Cavendish interview with The Editpool's Becci Jones](https://www.cavendishmusic.com/interview-meet-trailer-editor-becci-jones-editpool/).
- **Game trailer craft:** Derek Lieu argues for clear accents and alternating peaks
  and valleys, and emphasizes that transitions connect story sections through
  sound and music. Each feature shot therefore has one subject, with combat
  punctuation between sections. Retain real card, purchase and impact sounds
  against a continuous music bed; avoid a different visual effect at every cut.
  [Rising action](https://www.derek-lieu.com/blog/2018/9/16/the-trailer-line-of-rising-action),
  [Transitions](https://www.derek-lieu.com/blog/2018/2/24/good-transitions-make-great-trailers).
- **Iteration:** Treat this as assembly → rough cut → fine cut → finishing. The
  first render is a directed prototype, not a promise of finished advertising.
  After viewing it, refine the exact music accents, readability, and best takes.
  [Derek Lieu's editing workflow](https://www.derek-lieu.com/blog/2022/10/24/basic-game-trailer-editing-workflow).

These are our creative applications of those sources, not universal timing rules.
Three-second shots suit this first cut; unfamiliar mechanics may need longer
holds after review. A soundtrack phrase is not automatically a drum beat: do not
claim beat-perfect editing before listening to the rendered mix.

## Picture and sound rules

- Capture whole gameplay frames; all cropping and camera paths belong to the
  composition recipe. Boss idle assets keep their production fit and proportions.
- Keep a full, locked combat frame for the opening and most boss actions. When
  moving on menus, use slow 1.0–1.17× pushes or small pans. Never crop the only
  evidence of a card's outcome, a critical control, or the hovered description.
- Each input is a real mouse event. Inspect a card for roughly 1.35 seconds before
  playing; then retreat above the hand. No visible cursor, accidental hand sweeps,
  injected damage, invented cards, speed changes, or altered combat rules.
- Current main's Balanced floating combat text is captured as rendered: icon and
  number, independent lanes, normal pop/rise/fade, and native reaction names.
  The recorder synchronizes native animation time; it does not rewrite the game.
- Use the Blood Countess music from 20.68 seconds. Keep it continuous across menu
  and battle cuts, with native game sounds providing punctuation. The first verse
  supplies the premise; the chorus supports the final sequence. Fade the closing
  musical tail rather than leaving an abrupt audio cut.
- Lyrics appear only through the real boss lyric component, inside the Countess
  portrait. Opening and final Countess takes are synchronized to their edit
  positions. Other bosses and neutral alternate takes have lyrics disabled,
  avoiding words belonging to a different boss or a different musical moment.
  Moving either synchronized take to a new music position requires recapturing
  that take. The rest of the library can be freely reordered and reframed.
- Use the existing logo only at the end, with “Wishlist on Steam.” No release date,
  awards, review scores, or unsupported marketing claims are invented.

## Directorial paper cut

Times below are output time, including transition overlaps. Every shot uses a
separate take. Source in/out points retain handles for fine cutting. Most camera
moves remain modest so the viewer sees the actual interface.

| Shot | Time (s)    | Take                   | Direction and purpose                                           | Camera / incoming transition         |
| ---- | ----------- | ---------------------- | --------------------------------------------------------------- | ------------------------------------ |
| 01   | 00.00–04.00 | `countess-hook`        | Hook: inspect Sunder, strike the Countess; readable full battle | Locked full frame; cut               |
| 02   | 04.00–07.00 | `heroes-roster`        | Choose an identity: roster and Knight inspection                | 1.00→1.12× slow push / pan; cut      |
| 03   | 07.00–10.00 | `draft-choice`         | Build the deck: inspect and select a real Wildwood offer        | 1.10→1.16× slow push / pan; cut      |
| 04   | 10.00–13.00 | `cards-library`        | Card variety: hold a readable inspection                        | 1.14→1.14× slow push / pan; cut      |
| 05   | 13.00–16.50 | `wizard-battle`        | Payoff: a different hero fights a real enemy                    | Locked full frame; cut               |
| 06   | 16.50–19.50 | `card-shop`            | Adapt: inspect and purchase a generated card                    | 1.00→1.12× slow push / pan; cut      |
| 07   | 19.50–22.70 | `potion-brewing`       | Craft: show the Brew / Mix / Distill choices                    | 1.10→1.17× slow push / pan; cut      |
| 08   | 22.50–25.50 | `campfire-rest`        | Breathing space: Campfire and its real services                 | 1.05→1.12× slow push / pan; dissolve |
| 09   | 25.50–28.50 | `corruption-risk`      | Risk: the Altar of Corruption                                   | 1.04→1.12× slow push / pan; cut      |
| 10   | 28.50–31.70 | `labyrinth-route`      | Choose your path: inspect a reachable chamber                   | 1.08→1.12× slow push / pan; cut      |
| 11   | 31.70–34.70 | `three-modes`          | Replayability: show the three mode choices                      | 1.02→1.10× slow push / pan; cut      |
| 12   | 34.70–37.90 | `armory-loadout`       | Prepare: inspect and equip a Longsword                          | 1.00→1.10× slow push / pan; cut      |
| 13   | 37.90–40.90 | `talents-block`        | Grow: the Block talent tree                                     | 1.00→1.13× slow push / pan; cut      |
| 14   | 40.90–44.10 | `homestead-build`      | Invest: build the Blacksmith through its purchase control       | 1.00→1.10× slow push / pan; cut      |
| 15   | 43.90–46.90 | `homestead-companions` | Bond: companion sanctuary and available companions              | 1.06→1.10× slow push / pan; dissolve |
| 16   | 46.90–49.90 | `treant-druid`         | Escalate: Druid against the Blight Treant                       | Locked full frame; cut               |
| 17   | 49.90–52.90 | `seraph-wizard`        | Escalate: Wizard against Seraph                                 | Locked full frame; cut               |
| 18   | 52.90–55.90 | `titan-knight`         | Escalate: Knight against the Stone Titan                        | Locked full frame; cut               |
| 19   | 55.90–59.90 | `countess-finale`      | Button: Countess, native lyrics and a final damage pop          | Locked full frame; cut               |
| End  | 59.90–63.90 | Logo                   | Alchemy / Wishlist on Steam                                     | Gentle logo settle                   |

The closing boss sequence uses three clean cuts, then a longer Countess hold.
Preserve the damage pop before cutting away; use the impact sound as the accent.
Do not cut every shot at an identical interval merely to demonstrate an effect.
The two dissolves are short changes of mood; the rest are hard cuts. Future fine
cuts can shorten the boss accents to 1–2 seconds if they remain legible.

## Separate coverage library

| Take ID                | Starting screen | Hero / opponent | Initial use        |
| ---------------------- | --------------- | --------------- | ------------------ |
| `countess-hook`        | boss            | blood-countess  | Selected           |
| `heroes-roster`        | heroes          | knight          | Selected           |
| `heroes-wizard`        | heroes          | knight          | Alternate coverage |
| `draft-choice`         | draft           | knight          | Selected           |
| `cards-library`        | collection      | knight          | Selected           |
| `bestiary-library`     | collection      | knight          | Alternate coverage |
| `trinkets-library`     | collection      | knight          | Alternate coverage |
| `uniques-library`      | collection      | knight          | Alternate coverage |
| `wizard-battle`        | combat          | wizard          | Selected           |
| `campaign-route`       | destination     | knight          | Alternate coverage |
| `card-shop`            | shop            | knight          | Selected           |
| `potion-brewing`       | alchemist       | knight          | Selected           |
| `potion-shop`          | alchemist       | knight          | Alternate coverage |
| `campfire-rest`        | campfire        | knight          | Selected           |
| `corruption-risk`      | corruption      | knight          | Selected           |
| `labyrinth-route`      | labyrinth       | knight          | Selected           |
| `three-modes`          | modes           | knight          | Selected           |
| `armory-loadout`       | armory          | knight          | Selected           |
| `armory-gear`          | armory          | knight          | Alternate coverage |
| `talents-overview`     | talents         | knight          | Alternate coverage |
| `talents-block`        | talents         | knight          | Selected           |
| `homestead-build`      | homestead       | knight          | Selected           |
| `homestead-farm`       | homestead       | knight          | Alternate coverage |
| `homestead-companions` | homestead       | knight          | Selected           |
| `treant-druid`         | boss            | blight-treant   | Selected           |
| `seraph-wizard`        | boss            | seraph          | Selected           |
| `titan-knight`         | boss            | stone-titan     | Selected           |
| `countess-finale`      | boss            | blood-countess  | Selected           |

The Armory take equips an actual available item through the production inventory
UI. The shop take purchases an actual generated offer. The Homestead take builds
through its purchase control and production material costs. Staged progression,
Gold, discoveries and inventory are explicitly authored checkpoints in an isolated
browser profile. The meta profile has 95 Gold; 24 Wood, 14 Stone, 18 Iron, 24 Food, 12 Herbs,
9 Hide and 4 Gems; a few earned buildings, farms and bonds; three basic gear
items; and partial discoveries. Shops start with 85 Gold. No 999-resource
fixtures or full-inventory debug profile appears in the footage.
They represent valid game situations rather than a continuous
claimed playthrough. No user's save is opened or modified. Labyrinth uses the
existing legal fixture map. Unused coverage is still retained for alternate cuts.

## Capture and revision workflow

Capture in bounded batches without changing the pinned recipe or source checkout:

```sh
npm run trailer -- capture --recipe trailers/alchemy-cinematic.json \
  --bundle /absolute/path/to/library --clips countess-hook,heroes-roster,draft-choice
# Repeat with other IDs. Omit --clips to capture all remaining takes.
```

On the shared Mac, put each capture/render command inside the documented host
resource lane. Completed, hashed takes are reused; incomplete masters are never
silently accepted. `capture.json` reports whether the entire library is complete.

Copy the recipe, change `shots` (order, trims, camera paths, transitions), then:

```sh
npm run trailer -- render --bundle /absolute/path/to/library \
  --recipe trailers/my-revised-cut.json --label cut-02
```

The renderer checks source hashes, dimensions and native lyric timing. Only clips
used by the edit are required, so a partial library can produce a small canary
before the full assembly. Exact source frames are decoded on demand through a
local frame server, retaining native resolution while bounding memory and avoiding
a multi-gigabyte temporary PNG expansion. Source masters and earlier exports stay
untouched. New gameplay inputs or new starting situations require a new take.

## Review gates

1. **Truth:** current main combat feedback is present; card plays are accepted;
   card/stat/health changes and sounds agree. Gameplay rules and production source
   are unchanged. Release feature flags hide development spawn controls.
2. **Comprehension:** first five seconds identify the game as a card battler;
   each feature shot has one readable subject; complete important input/outcome
   beats even when the camera moves. Watch once muted.
3. **Craft:** inspect every cut and both dissolves; no black boundary frames,
   clipped tooltips or frozen source frames. Watch the mix for musical phrasing,
   SFX balance and the final fade. Inspect the beginning and end of every take.
4. **Delivery:** confirm 1080p60, exact frame count/duration, H.264 High, Rec.709,
   AAC stereo at 48 kHz, and preserve the 4K60 lossless source library and receipts.

A sampled 60 fps export does not certify live 59+ fps performance on the Mac.
Hosted CI, packaged Electron behavior, and actual Steam transcoding remain
separate checks. Nothing here uploads or publishes the trailer.
