# Alchemy: cinematic gameplay trailer, first cut

## Creative brief

Make the viewer want to build a strategy and test it against Alchemy's bosses.
The first image is a real card battle, with the hand and HUD visible. The film
then follows a small player story: choose a hero, shape a deck, make risky choices,
invest in the next run, and face a succession of stronger opponents. End on the
Blood Countess and the Alchemy logo. This first cut is for review.

The executable edit is [alchemy-cinematic.json](./alchemy-cinematic.json).
It owns take IDs, durations, dimensions, frame rates, music offsets and camera
paths. Use [the plan command](../Docs/TRAILERS.md#cinematic-feature-compilation)
for its current capture inventory and resolved timeline. Retain the entire source
bundle, including unused takes; editing the shot list must not overwrite a master
or earlier export.

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
- Each input is a real mouse event. Inspect each card long enough to read it before
  playing, then retreat above the hand; the recipe owns exact dwell times. No visible cursor, accidental hand sweeps,
  injected damage, invented cards, speed changes, or altered combat rules.
- Current main's Balanced floating combat text is captured as rendered: icon and
  number, independent lanes, normal pop/rise/fade, and native reaction names.
  The recorder synchronizes native animation time; it does not rewrite the game.
- Use the Blood Countess music at the recipe’s offset. Keep it continuous across menu
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

## Story beats and coverage

The recipe’s ordered shots implement these editorial purposes:

- **Hook:** Countess combat identifies the game immediately. Show inspection,
  accepted play and its damage outcome with the hand and HUD readable.
- **Identity and deck:** hero selection, drafting and Collection establish player
  choice; the Wizard battle pays off that setup before the first shop.
- **Decisions and breathing space:** shopping, Potion preparation, Campfire and
  Corruption alternate investment, relief and risk. The first short dissolve
  changes mood rather than obscuring an action.
- **The next run:** Labyrinth and modes lead into Armory, Talents, Homestead and
  Companion bonds. Modest menu camera moves keep the feature’s control and
  consequence visible. The second dissolve joins the Homestead beats.
- **Escalation:** Treant, Seraph and Titan build toward a longer Countess finale.
  Keep clear damage and sound accents before each cut; avoid identical shot
  intervals purely to demonstrate an effect.
- **Invitation:** the existing logo and Wishlist on Steam end the cut without an
  invented release date or unsupported claim.

Capture independent alternate takes for hero, Bestiary, Trinket, Unique,
Campaign-destination and Potion-shop coverage. The recipe’s `clips` list is the
complete inventory; `timeline.shots` from the plan identifies the selected takes.
Unused coverage remains available for alternate cuts.

[Scene staging](../tests/trailers/scenarios.ts) owns exact checkpoint resources,
progression, discoveries and inventory. Armory equips an available item, shops
purchase generated offers, and Homestead builds at production costs through
normal controls. Staged checkpoints represent valid situations, not a continuous
earned playthrough. No player save is opened or modified; Labyrinth uses its
existing legal fixture. Keep that distinction explicit when reviewing footage.

## Capture and revision workflow

Use [cinematic capture](../Docs/TRAILERS.md#cinematic-feature-compilation) for
`trailers/alchemy-cinematic.json` and [capture/revision commands](../Docs/TRAILERS.md#capture-once-revise-the-edit)
for resource leases, partial libraries, verified chunks and retained masters.
For a revised cut, copy the recipe and change shot order, trims, camera paths or
transitions. Keep the source takes pinned; new gameplay inputs or starting
situations require a new take. Review this cut against the gates below.

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
