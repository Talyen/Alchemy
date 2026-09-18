import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { emptyInventory } from "@/lib/homestead/inventory";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { GameplayDraft } from "../run-session-command";
import { createInitialActiveRunFields, runFieldsFromSnapshot, type ActiveRunProgressFields } from "../run-state-init";
import { setHasActiveRun } from "./run-session";

// ── Run construction / teardown ──────────────────────────────────────────────

export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId),
    runTalentXP: {},
  };
  draft.run.initialized = false;
}

export function initializeActiveRun(
  draft: GameplayDraft,
  activeRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): void {
  draft.run.activeRun = createInitialActiveRunFields(activeRun, fallbackCharacterId);
  draft.run.initialized = true;
}

export function initializeFromResumeSnapshot(draft: GameplayDraft, activeRun: ActiveRunProgressFields): void {
  draft.run.activeRun = activeRun;
  draft.run.initialized = true;
}

function hydrateFromSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  draft.session.activity = { kind: "idle" };
  Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), {
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runCurrenciesEarned: { ...EMPTY_CRAFTING_CURRENCIES },
    runObtainedItems: [],
  });
}

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndMaterials = emptyInventory();
  draft.session.runEndCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndLabyrinthFloor = null;
  setHasActiveRun(draft, snapshot.hasActiveRun);
}
