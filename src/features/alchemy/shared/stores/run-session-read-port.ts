// Imperative capability reads for event-time handlers and persistence bridges.
// These contracts intentionally expose one lifetime at a time.
import type { RunRngStream } from "@/lib/run-rng";
import {
  getActiveRunStoreView,
  getBattleStoreView,
  getRunProfileStoreView,
  getRunSessionStoreView,
  type ActiveRunStore,
  type BattleStoreView,
  type RunProfileStoreView,
  type RunSessionStore,
} from "./run-session-queries";
import { readGameplayState } from "./gameplay-state-store";

export type { ActiveRunStore, BattleStoreView, RunProfileStoreView, RunSessionStore };
export type { DisplayOverrides } from "./run-domain-types";

export function readActiveRun(): ActiveRunStore {
  return getActiveRunStoreView();
}

export function readRunProfile(): RunProfileStoreView {
  return getRunProfileStoreView();
}

export function readRunSession(): RunSessionStore {
  return getRunSessionStoreView();
}

export function readBattle(): BattleStoreView {
  return getBattleStoreView();
}

export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => readGameplayState().runActions.nextRunRandom(stream);
}

export function readRunInitialized(): boolean {
  return readGameplayState().run.initialized;
}

export function readHasActiveRun(): boolean {
  return readGameplayState().session.hasActiveRun;
}
