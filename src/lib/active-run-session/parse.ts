// Runtime validation before hydration (returns ActiveRunData | null).
// Save-file legacy fixes during load use normalizeActiveRunData in @/lib/validation.
import { hydrateCard, type BattleCard } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { ActiveRunDataSchema } from "@/lib/validation";

import type { ActiveRunData } from "./types";

export function parseActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as Record<string, unknown>;

  if (Array.isArray(candidate.runDeck)) {
    candidate.runDeck = candidate.runDeck.map((card) => {
      if (card && typeof card === "object" && !("title" in card)) {
        return { title: "", art: "", ...card };
      }
      return card;
    });
  }

  const result = ActiveRunDataSchema.safeParse(activeRun);
  if (!result.success) {
    return null;
  }

  const data = result.data;

  return {
    ...data,
    contentSystemType: data.contentSystemType,
    runDeck: data.runDeck.map((card) => hydrateCard(card as BattleCard)),
    wildwoodDraft: data.wildwoodDraft
      ? {
          ...data.wildwoodDraft,
          draftChoices: data.wildwoodDraft.draftChoices.map((card) => hydrateCard(card as BattleCard)),
        }
      : null,
    labyrinthMap: data.labyrinthMap as LabyrinthMap | null,
  } as ActiveRunData;
}
