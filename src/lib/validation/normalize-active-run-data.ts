// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// For runtime hydration of unknown payloads, use parseActiveRun from @/lib/active-run-session.
// This is business logic (run initialization, legacy deck detection) that operates
// on raw Record<string, unknown> input before Zod schema parsing completes.
// Depends on: game-data, game-constants.
// Used by: save-schemas.ts (ActiveRunDataSchema.transform), tests.
import type { TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

function computeContentSystemType(data: Record<string, unknown>): ContentSystemId {
  const raw = data.contentSystemType;
  if (raw === "labyrinth" && !data.labyrinthMap) return "campaign";
  if (raw === "labyrinth" || raw === "wildwood" || raw === "campaign") return raw;
  return "campaign";
}

function normalizeRunDeck(data: Record<string, unknown>): unknown[] {
  return Array.isArray(data.runDeck) ? (data.runDeck as Array<{ id: string }>) : [];
}

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
  contentSystemType: ContentSystemId;
  runPlayerHealth: number;
  completedDestinations: string[];
  runDeck: unknown;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  labyrinthMap: unknown;
  labyrinthPendingNode: unknown;
  activeCombat: unknown;
} {
  const contentSystemType = computeContentSystemType(data);
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, data.runMaxHealth as number);
  const completedDestinations = Array.isArray(data.completedDestinations)
    ? (data.completedDestinations as string[])
    : [];

  return {
    ...data,
    contentSystemType,
    runPlayerHealth,
    completedDestinations,
    runDeck: normalizeRunDeck(data),
    runTalentXP: (data.runTalentXP as TalentXP | undefined) ?? {},
    runMaterialsEarned: (data.runMaterialsEarned as MaterialInventory | undefined) ?? emptyInventory(),
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft: contentSystemType === "wildwood" ? data.wildwoodDraft : null,
    activeCombat: normalizeActiveCombat(data, contentSystemType),
  };
}
