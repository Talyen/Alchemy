import { chooseDiscoveryIndex } from "./case-selection.mjs";
import type { JourneyCase } from "./journey-types";

/** One cursor spans card and Wish decisions; replay must never silently choose a fallback. */
export function createCombatChoices(journeyCase: JourneyCase) {
  const expected = journeyCase.recordedActions?.filter(
    (action) => action.name.startsWith("play:") || action.name.startsWith("wish:"),
  );
  const seen = new Set<string>();
  let decision = 0;
  return {
    choose(names: string[], preferred = names[0]): number {
      if (!names.length) throw new Error("Combat choice has no legal candidates");
      const recorded = expected?.[decision];
      let index: number;
      if (expected) {
        index = names.indexOf(recorded?.name ?? "");
        if (index < 0) throw new Error(`Replay combat choice unavailable: ${recorded?.name ?? "no further actions"}`);
      } else if (journeyCase.exploratory) {
        const unseen = names.map((name, index) => ({ name, index })).filter(({ name }) => !seen.has(name));
        const candidates = unseen.length ? unseen : names.map((name, index) => ({ name, index }));
        index = candidates[chooseDiscoveryIndex(journeyCase.seed, `combat:${decision}`, candidates.length)]!.index;
      } else {
        index = Math.max(0, names.indexOf(preferred ?? ""));
      }
      seen.add(names[index]!);
      decision++;
      return index;
    },
    finish() {
      if (expected && decision !== expected.length) throw new Error("Replay combat ended before its recorded choices");
    },
  };
}
