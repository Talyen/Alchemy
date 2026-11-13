import { useEffect, useState } from "react";

import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import type { GearAffixTooltipEntry } from "@/lib/gear";

const CHANGE_MS = 420;
interface AffixRow {
  entry: GearAffixTooltipEntry;
  change?: "added" | "changed" | "removed" | "replaced";
  previous?: GearAffixTooltipEntry;
  slot: string;
  revision: number;
}

/** A mounted inspection owns its feedback; reopening it starts with the actual current item. */
export function useGearAffixFeedback(entries: GearAffixTooltipEntry[]) {
  const reducedMotion = useReducedMotionPreference();
  const disabled = reducedMotion && isAnimationDisabled();
  const signature = JSON.stringify(entries);
  const [snapshot, setSnapshot] = useState(() => ({
    signature,
    entries,
    revision: 0,
    rows: entries.map((entry, index): AffixRow => ({ entry, slot: `initial-${index}`, revision: 0 })),
  }));

  if (signature !== snapshot.signature) {
    const revision = snapshot.revision + 1;
    const current = new Map(entries.map((entry) => [entry.affixId, entry]));
    const previous = new Map(snapshot.entries.map((entry) => [entry.affixId, entry]));
    const additions = entries.filter((entry) => !previous.has(entry.affixId));
    const rows: AffixRow[] = disabled
      ? entries.map((entry, index) => ({ entry, slot: `reduced-${revision}-${index}`, revision }))
      : [
          // A reroll can reorder its payload. Keep surviving lines in their inspected
          // positions; affix order has no gameplay meaning. Discard obsolete exits.
          ...snapshot.rows
            .filter((row) => row.change !== "removed")
            .map((row): AffixRow => {
              const entry = current.get(row.entry.affixId);
              if (!entry) {
                const replacement = additions.shift();
                if (replacement)
                  return {
                    entry: replacement,
                    previous: row.entry,
                    slot: row.slot,
                    change: "replaced",
                    revision,
                  };
                return { entry: row.entry, slot: row.slot, change: "removed", revision };
              }
              const old = previous.get(entry.affixId)!;
              // Entry keys include catalog order, so they are not a visible change.
              const changed = old.name !== entry.name || old.text !== entry.text || old.value !== entry.value;
              return changed
                ? { entry, previous: row.entry, slot: row.slot, change: "changed", revision }
                : { ...row, entry };
            }),
          ...additions.map(
            (entry, index): AffixRow => ({ entry, slot: `added-${revision}-${index}`, change: "added", revision }),
          ),
        ];
    // Adjust during render so a removed row never flashes out before its exit begins.
    setSnapshot({ signature, entries, revision, rows });
  }

  useEffect(() => {
    if (!snapshot.rows.some((row) => row.change)) return;
    const revision = snapshot.revision;
    const timer = window.setTimeout(
      () =>
        setSnapshot((current) =>
          current.revision === revision
            ? {
                ...current,
                rows: current.rows
                  .filter((row) => row.change !== "removed")
                  .map(({ entry, revision, slot }) => ({ entry, revision, slot })),
              }
            : current,
        ),
      disabled ? 0 : reducedMotion ? 180 : CHANGE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [snapshot.revision, snapshot.rows, reducedMotion, disabled]);

  return disabled
    ? entries.map(
        (entry, index): AffixRow => ({
          entry,
          slot: `reduced-${snapshot.revision}-${index}`,
          revision: snapshot.revision,
        }),
      )
    : snapshot.rows;
}
