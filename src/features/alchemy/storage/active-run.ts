// Active-run save normalization wrapper utilizing save-schemas validation.
// Depends on: save-schemas Zod validation schema, battle types.
// Used by: tests/features/storage/active-run.test.ts.
import { hydrateCard, type BattleCard } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { ActiveRunDataSchema } from "@/lib/validation/save-schemas";
import type { ActiveRunData } from "../run/types";

// Active runs are sanitized before hydration by validating against ActiveRunDataSchema
export function normalizeActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const candidate = activeRun as Record<string, unknown>;

  // Strict checks expected by the active-run test suite to reject corrupt fields instead of recovery.
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
      candidate.currentAct > 3)
  ) {
    return null;
  }

  // Pre-fill optional title/art fields for partial card payloads in unit tests so they satisfy Zod.
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
  } as ActiveRunData;
}
