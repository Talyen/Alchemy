// Validates and normalizes persisted active-run payloads before hydration.
import { hydrateCard, type BattleCard } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { ActiveRunDataSchema } from "@/lib/validation";
import { ACTS_PER_RUN } from "@/lib/game-constants";

import type { ActiveRunData } from "./types";

export function parseActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as Record<string, unknown>;

  if (
    "runGold" in candidate &&
    (typeof candidate.runGold !== "number" || !Number.isInteger(candidate.runGold) || candidate.runGold < 0)
  ) {
    return null;
  }

  if (
    "runPlayerHealth" in candidate &&
    "runMaxHealth" in candidate &&
    (typeof candidate.runPlayerHealth !== "number" ||
      typeof candidate.runMaxHealth !== "number" ||
      candidate.runPlayerHealth < 0 ||
      candidate.runMaxHealth <= 0 ||
      candidate.runPlayerHealth > candidate.runMaxHealth)
  ) {
    return null;
  }

  if (
    "currentAct" in candidate &&
    (typeof candidate.currentAct !== "number" ||
      !Number.isInteger(candidate.currentAct) ||
      candidate.currentAct < 1 ||
      candidate.currentAct > ACTS_PER_RUN)
  ) {
    return null;
  }

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
    contentSystemType: data.contentSystemType as ActiveRunData["contentSystemType"],
    runDeck: (data.runDeck as unknown as BattleCard[]).map(hydrateCard),
    labyrinthMap: data.labyrinthMap as LabyrinthMap | null,
  };
}
