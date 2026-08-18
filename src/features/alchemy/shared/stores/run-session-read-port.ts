// Imperative capability reads for event-time handlers and persistence bridges.
// These contracts intentionally expose one lifetime at a time and contain no
// command methods, so callers cannot accidentally mutate the aggregate while
// reading it.
//
// Returned objects are shallow snapshots. Nested fields (shop state, battleState,
// reward piles, etc.) are the committed aggregate's own references — treat them
// as read-only and never assign into them. Do not structuredClone on this hot path.
import type { PermanentProgressFields } from "./run-state-init";
import { pickActiveRunView, type ActiveRunReadView } from "./run-state-init";
import { readGameplayState } from "./gameplay-state-store";
import type { RunDomainBattleState, RunSessionFields } from "./run-domain-types";
import { getRunPhase, type RunPhase, type Screen } from "@/lib/routing";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { ParkedRunsMap } from "./parked-runs";

export type { ActiveRunReadView } from "./run-state-init";
export type RunProfileReadView = Readonly<PermanentProgressFields>;
export type RunSessionReadView = Readonly<RunSessionFields>;
export type BattleReadView = Readonly<RunDomainBattleState>;

export type { DisplayOverrides } from "./run-domain-types";

export function readActiveRun(): ActiveRunReadView {
  return pickActiveRunView(readGameplayState().run);
}

export function readRunProfile(): RunProfileReadView {
  return { ...readGameplayState().runProfile };
}

export function readRunSession(): RunSessionReadView {
  return { ...readGameplayState().session };
}

export function readShopFirstPurchaseUsed(
  shop: "shopState" | "alchemistState" | "trinketShopState" | "equipmentShopState",
): boolean {
  return readGameplayState().session[shop].firstPurchaseUsed;
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

export function readParkedRuns(): ParkedRunsMap {
  return { ...readGameplayState().run.parkedRuns };
}

export function readRunRecency(): ContentSystemId[] {
  return [...readGameplayState().run.runRecency];
}

export function readActiveRunScreen(): Screen {
  return readGameplayState().run.navigation.screen;
}

export function readRunPhase(): RunPhase {
  const state = readGameplayState();
  return getRunPhase(state.run.navigation.screen, state.battle.hasActiveBattle);
}
