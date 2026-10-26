# Combat feedback lab

From the checkout root:

```sh
python3 -m http.server 4183 --bind 127.0.0.1
```

Open [the lab](http://127.0.0.1:4183/scripts/combat-feedback-lab/). Choose a reference
and candidate, then replay both or scrub the shared timeline. Candidate controls
apply immediately. Use **Use B as reference** to freeze a custom combination for
comparison with the next candidate. Settings persist in this browser; export and
import keep portable copies of both configurations.

The five presets include source-derived Alchemy and Trinket baselines plus three
proposals: Balanced, Quiet & readable, and Punchy & compact. Seven deterministic
sequences exercise single hits, Criticals, fast and spaced repeats, mixed outcomes,
reaction names, and crowded actions. Static feedback applies to both lanes.

Balanced now uses 32px text (down from 37.8px), independent paths, and queued
launches. Damage and healing share the center queue; benefits and setbacks use
the lower-left and lower-right queues. Names have a separate upper queue. Status
entries stay stationary and use a quieter pop. No incoming entry moves a previous
entry's path. The queue prefers clearance and an 80 ms stagger, but launches every
entry within 180 ms of arrival. New numeric paths compare projected footprints and use diagonal offsets with
vertical separation to avoid complete covering. Damage and healing prefer
opposite sides; corners and names use fixed rows.
Overlap is allowed when the deadline arrives. No queued or visible entry is evicted,
and each receives its full lifetime after launch. Queue delay, clearance, and fan
distance are adjustable.

Revision 3 keeps previous browser settings under their original storage keys
and starts a fresh comparison. Exported revision 1 and 2 settings can still be imported.
Legacy push modes remain available for comparison; each push now retains its own
transition progress rather than restarting all earlier pushes on every arrival.

This developer tool uses local artwork and fonts without a build or dependencies.
It does not change gameplay or saves. Timing/scale baselines were read from
Alchemy `ac4c10cd1` and Trinket `65c079a36`; they are snapshots, not imports of live
production renderers. Trinket points map to CSS pixels for this comparison. Rounded
system typography is an approximation. Portrait fitting, packing, region eviction,
and group pushes are representative, not pixel parity. Audio, portrait recoil,
and card flights are outside this tool. Validate a chosen treatment in the live
battle screen before claiming visual acceptance.

Trinket defines an emphasis typography tier, but its ordinary damage presenter
classifies damage as `directDamage` even when the Critical marker is set. The
baseline therefore keeps normal damage typography for Criticals; size and weight
remain adjustable for exploring alternatives.

Canonical Alchemy owners:

- [Numeric animation](../../src/features/alchemy/run-loop/battle/presentation/ui/combat-text.tsx)
- [Reaction names](../../src/features/alchemy/run-loop/battle/presentation/ui/reaction-text.tsx)
- [Merge policy](../../src/features/alchemy/run-loop/battle/combat-feedback-merge.ts)
- [Motion constants](../../src/lib/game-constants/ui-motion.ts)
- [Battle styles](../../src/styles/battle-scene.css)

The lab’s controls are developer-only, so they are not part of shipped localization.
