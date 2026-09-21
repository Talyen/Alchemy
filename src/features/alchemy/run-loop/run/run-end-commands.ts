import {
  abandonRun,
  applyRunDefeatTeardown,
  clearBattlePresentationUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { finalizeRunXP, setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { awardRunEndMaterials } from "./run-materials";

const settlement = { awardRunEndMaterials, finalizeRunXP };
export function clearCombatState(draft: GameplayDraft): void {
  setHasActiveBattle(draft, false);
}
export function completeRunVictory(): void {
  finalizeRunEndSession(settlement);
}
export function completeRunDefeat(): void {
  applyRunDefeatTeardown({ ...settlement, clearCombatState, clearCombatPresentation: clearBattlePresentationUi });
}
export function abandonCurrentRun(): boolean {
  return abandonRun(settlement);
}
