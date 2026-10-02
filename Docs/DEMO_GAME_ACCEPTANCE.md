# Demo game acceptance evidence

September 29, 2026; Alchemy 0.1.0; current checkout, including existing local
work. This record supports the [demo checklist](./STEAM_DEMO_CHECKLIST.md).
Steamworks, actual shared Cloud and public promotion remain separate gates.
Testing uses isolated profiles; normal player saves and live Steam are not used.

## Completed local checks

| Area                          | Evidence and practical limit                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real starters and progression | 45 headless Act 1 runs: five seeds, three runs each for Knight, Rogue and Ranger. Knight began from defaults; Rogue and Ranger used genuinely earned preceding profiles. All careers completed without hangs; victories/defeats ended within nine rooms. A separate fresh Knight minimalist sample added six runs, with five victories. These are automated strategies, not human win-rate predictions. |
| Unlocks and first card        | A separate browser journey starts with empty storage, plays real starter cards, and earns Knight → Rogue → Ranger through normal End Run. Talents and Homestead unlock without injected progression. Technical time to the opening hand is checked below three minutes; human reading time is excluded.                                                                                                 |
| Included encounters           | Headless journeys exercised shops, potions, Mystery, Corruption, Campfires, Wishes, rewards, equipment, crafting, Talents, buildings, research, farms and Companion Bonds. Browser checks separately cover Card/Gear shops and fresh-page Alchemist, Trinket Shop and Campfire restoration.                                                                                                             |
| Save boundaries               | Demo browser tests cover current saves, enemy-resolution continuation, unclaimed rewards, claimed-card restoration, future-save protection and malformed JSON recovery. Special visits preserve acknowledged purchases and allow departure after restoration.                                                                                                                                           |
| Quit and save failures        | In-game feedback/support links are intentionally omitted. Quit opens no browser. If local primary and recovery writes both fail, a visible warning appears; successful retry clears it. Successful recovery-slot writes do not falsely warn.                                                                                                                                                            |
| UI and input                  | Browser battle/inspection matrix: 1280×720 and 1280×800 at Game Size 80/100/120 and Tooltip Size 75/125. Seven live starter cards, End Turn, enemy inspection and deck inspection remain usable. Isolated Electron separately checks the demo footer and Options at minimum resolutions and size extremes. Screenshots were visually inspected after fades settled.                                     |
| Motion and production tooling | Real card-transfer and tooltip-motion journeys pass; reduced-motion inspection and consecutive keyboard plays settle normally. The temporary comparison feature was retired by its owning session during QA. Acceptance asserts its absence from production candidates.                                                                                                                                 |
| Audio behavior                | 149 focused audio/save-notice/report tests passed, including source availability, preload races, music lifecycle, volume bounds and background handling; a demo browser test observes SFX playback. Packaged music-byte validation remains covered. This does not certify subjective loudness on speakers/headphones.                                                                                   |
| Platform experience           | The user reports having tested Mac and Windows. Local isolated Electron tests additionally cover offline startup, native profile isolation, Options and Quit. This report does not convert browser input into physical Steam Input or Deck certification.                                                                                                                                               |

Raw playthroughs, journals, screenshots and timing attachments are ignored
artifacts under `reports/demo-acceptance/`. Durable assertions live in the demo
browser/Electron specs and focused unit tests. Re-run affected checks after
changing gameplay, persistence or layouts; this record is not permanent certification.

The UI matrix records requested Tooltip Size values, including 75%, which is
below the current 90% minimum. New candidate checks use the supported extremes
under [display sizing](./UI.md#display-sizing); the historical matrix does not
establish a supported 75% option.

## Measured local performance

Native Electron, macOS arm64, 1440×900, DPR 2, approximately 60 Hz. One measured
run per scenario; ordinary scenarios also warm up once. These advisory results
are not minimum-spec Windows or Deck guarantees.

| Scenario                              | Observation                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold startup / first Options visit    | 59.8 average FPS, p95 17.6 ms, no 100 ms stalls; all advisory bands green.                                                                                                                                                                          |
| Dense battle effects                  | 60.0 average FPS over 31.1 seconds, p95 17.5 ms, no 50 ms hitches or long tasks; all bands green.                                                                                                                                                   |
| Repeated Collection/Talents lifecycle | 60.0 average FPS over 61.2 seconds, p95 17.5 ms, no 50 ms hitches. Working set fell 318.7 MiB; JS heap rose 15.9 MiB, with 18 fewer DOM nodes and no extra image/canvas/audio elements. A finite soak is not proof against every long-session leak. |

Performance runs: `2026-09-29T20-03-46Z-electron`,
`2026-09-29T20-07-26Z-electron`, `2026-09-29T20-11-23Z-electron`.
After shared animation changes, `2026-09-29T21-07-13Z-electron` recorded one
366.7 ms draw gap while Windows packaging overlapped the run (no attributed
long task). The single quiet repeat, `2026-09-29T21-10-34Z-electron`, was all green:
p95 17.6 ms, 1% low 56.5 FPS and no 50 ms hitches/stalls. Both raw runs are retained;
the outlier is not evidence of a reproduced script bottleneck.

Use [performance procedures](./PERFORMANCE.md) for reproduction/comparison.

## Remaining human acceptance

Automated checks cannot establish that an unfamiliar person understands the
game or that the mix is comfortable on their audio device. Keep those checklist
rows open until actual feedback is recorded.

Run **`npm run demo:playtest`** for the production demo without Steamworks.
Progress uses `scratch/demo-playtest-profile`; normal profiles and Steam Cloud
are untouched. Clear Save Data in Options starts a fresh playtest. The launcher
ensures the checkout's Electron runtime is installed, validates committed
generated outputs, and builds the demo desktop renderer before opening it.
It does not regenerate authored assets; prepare changed sources through the
[asset workflow](./WORKFLOWS-ASSETS.md) first. Development-only comparison controls
remain absent.

1. Let someone unfamiliar with Alchemy begin without coaching. Note time to
   first card, whether they find Mana/Block, enemy inspection and End Turn, and
   whether rewards/destination choices and earned unlocks make sense.
2. Observe a first run and retry. Record confusing labels, missed controls,
   unexpected difficulty changes and whether an affordable upgrade is useful.
3. Listen to menu, normal combat, boss and reward sounds at defaults on speakers
   or headphones. Confirm comfortable loudness, understandable actions and no
   distracting overlap. Note device, changed volume settings and any problem.

Record the feedback here before checking these subjective rows. Steam listings,
minimum-spec claims, real overlay paths, controller layouts and Deck
suspend/resume are deferred to external release validation.
