// Imperative capability reads for event-time handlers and persistence bridges.
// These contracts intentionally expose one lifetime at a time.
import {
  getActiveRunReadView,
  getBattleReadView,
  getRunProfileReadView,
  getRunSessionReadView,
  type ActiveRunReadView,
  type BattleReadView,
  type RunProfileReadView,
  type RunSessionReadView,
} from "./run-session-queries";
import { readGameplayState } from "./gameplay-state-store";

export type { ActiveRunReadView, BattleReadView, RunProfileReadView, RunSessionReadView };
export type { DisplayOverrides } from "./run-domain-types";

export function readActiveRun(): ActiveRunReadView {
  return getActiveRunReadView();
}

export function readRunProfile(): RunProfileReadView {
  return getRunProfileReadView();
}

export function readRunSession(): RunSessionReadView {
  return getRunSessionReadView();
}

export function readBattle(): BattleReadView {
  return getBattleReadView();
}

export function readRunInitialized(): boolean {
  return readGameplayState().run.initialized;
}

export function readHasActiveRun(): boolean {
  return readGameplayState().session.hasActiveRun;
}
