import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { CharacterId } from "@/lib/game-data";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gameplayDraftRuntime, type GameplayDraft } from "../../session/gameplay-command";
import { createInitialActiveRunFields, type ActiveRunProgressFields } from "../../session/run-state-init";

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

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  draft.session.activity = { kind: "idle" };
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, snapshot.characterId, gameplayDraftRuntime(draft).generateRunSeed),
    ...snapshot,
    runMetaMaxHealth: snapshot.runMaxHealth,
  };
  draft.session.runEndMaterials = emptyInventory();
  draft.session.runEndCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndUnlockedCharacters = [];
  draft.session.runRecap = null;
  draft.session.runEndLabyrinthFloor = null;
}
