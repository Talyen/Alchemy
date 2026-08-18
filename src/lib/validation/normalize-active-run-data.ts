// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// Content-system field isolation mirrors the encode-time guards in run-resume-codec.
// Scalar defaults and contentSystemType are owned by the Zod schema (.catch / .default).
import type { ContentSystemId } from "@/lib/content-systems/types";

function normalizeActiveCombat(
  data: Record<string, unknown>,
  contentSystemType: ContentSystemId,
): Record<string, unknown> | null {
  if (!data.activeCombat) return null;
  const combat = data.activeCombat as Record<string, unknown>;
  if (contentSystemType !== "labyrinth") {
    return { ...combat, activeLabyrinthModifiers: [], activeLabyrinthRewardModifiers: [] };
  }
  return {
    ...combat,
    activeLabyrinthModifiers: combat.activeLabyrinthModifiers ?? [],
    activeLabyrinthRewardModifiers: combat.activeLabyrinthRewardModifiers ?? [],
  };
}

export function normalizeActiveRunData<T extends Record<string, unknown>>(
  data: T,
): T & {
  runPlayerHealth: number;
  labyrinthMap: unknown;
  labyrinthPendingNode: unknown;
  wildwoodDraft: unknown;
  starterDraftChoices: unknown;
  activeCombat: unknown;
} {
  const contentSystemType = data.contentSystemType as ContentSystemId;
  const runMaxHealth = data.runMaxHealth as number;
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, runMaxHealth);
  const runMetaMaxHealth =
    typeof data.runMetaMaxHealth === "number" && data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : runMaxHealth;

  return {
    ...data,
    runPlayerHealth,
    runMetaMaxHealth,
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft: contentSystemType === "wildwood" ? data.wildwoodDraft : null,
    starterDraftChoices: contentSystemType === "wildwood" ? null : (data.starterDraftChoices ?? null),
    activeCombat: normalizeActiveCombat(data, contentSystemType),
  };
}
