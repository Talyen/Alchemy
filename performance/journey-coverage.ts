import type { JourneyAction } from "./journey-types";

/** Completed UI actions are evidence of plays, not proof that every declared effect triggered. */
export function summarizeMeasuredCoverage(actions: readonly JourneyAction[]) {
  const labels = (prefix: string) =>
    [...new Set(actions.filter((a) => a.name.startsWith(prefix)).map((a) => a.name.slice(prefix.length)))].sort();
  return {
    playedCardLabels: labels("play:"),
    wishChoiceLabels: labels("wish:"),
    cardPlays: actions.filter((a) => a.name.startsWith("play:")).length,
    completedTransactions: actions
      .filter(
        ({ name }) =>
          name === "brew-potion" || name === "transmute" || name.startsWith("craft:") || name.startsWith("salvage:"),
      )
      .map(({ name }) => name),
    endTurnActions: actions.filter((a) => a.name === "end-turn").length,
  };
}
