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
