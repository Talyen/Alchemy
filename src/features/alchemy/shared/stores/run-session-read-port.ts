// Imperative capability reads for event-time handlers and persistence bridges.
// These contracts intentionally expose one lifetime at a time and contain no
// command methods, so callers cannot accidentally mutate the aggregate while
// reading it.
import type { ActiveRunProgressFields, PermanentProgressFields } from "./run-state-init";
import { readGameplayState } from "./gameplay-state-store";
import type { RunDomainBattleState, RunDomainDataState, RunSessionFields } from "./run-domain-types";

export type ActiveRunReadView = ActiveRunProgressFields & Pick<RunDomainDataState, "initialized">;
export type RunProfileReadView = PermanentProgressFields;
export type RunSessionReadView = RunSessionFields;
export type BattleReadView = RunDomainBattleState;

export type { DisplayOverrides } from "./run-domain-types";

export function readActiveRun(): ActiveRunReadView {
  const state = readGameplayState();
  return { ...state.run.activeRun, initialized: state.run.initialized };
}

export function readRunProfile(): RunProfileReadView {
  return { ...readGameplayState().runProfile };
}

export function readRunSession(): RunSessionReadView {
  return { ...readGameplayState().session };
}

export function readBattle(): BattleReadView {
  return { ...readGameplayState().battle };
}

export function readRunInitialized(): boolean {
  return readGameplayState().run.initialized;
}

export function readHasActiveRun(): boolean {
  return readGameplayState().session.hasActiveRun;
}
