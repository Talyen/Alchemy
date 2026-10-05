import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { CharacterId } from "@/lib/game-data";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gameplayDraftRuntime, type GameplayDraft } from "../gameplay-command";
import { createInitialActiveRunFields, runFieldsFromSnapshot, type ActiveRunProgressFields } from "../run-state-init";
import { setHasActiveRun } from "./run-session";

// ── Run construction / teardown ──────────────────────────────────────────────

export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId, gameplayDraftRuntime(draft).generateRunSeed),
    runTalentXP: {},
  };
  draft.run.initialized = false;
}

export function initializeActiveRun(
  draft: GameplayDraft,
  activeRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): void {
  draft.run.activeRun = createInitialActiveRunFields(
    activeRun,
    fallbackCharacterId,
    gameplayDraftRuntime(draft).generateRunSeed,
  );
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
    runHistory: [],
    runHistoryPartial: false,
    runGoldEarned: 0,
  });
}

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndMaterials = emptyInventory();
  draft.session.runEndCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runRecap = null;
  draft.session.runEndLabyrinthFloor = null;
  setHasActiveRun(draft, snapshot.hasActiveRun);
}
