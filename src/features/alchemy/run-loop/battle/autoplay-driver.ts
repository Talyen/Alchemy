import { resolveGameDelay } from "@/lib/animation/game-timer";
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";

import { handHasHiddenCard, type HiddenHandCardKeys } from "./playable-hand";

export { findFirstPlayableHandCard } from "./playable-hand";

function isAutoplayBattleOver(state: BattleState): boolean {
  return state.enemyHealth <= 0 || isPlayerDefeated(state);
}

export function isBattlePlayInputBusy(options: {
  cardPlayInProgress: boolean;
  cardTransferInProgress: boolean;
}): boolean {
  return options.cardPlayInProgress || options.cardTransferInProgress;
}

export function isBattlePlaybackBlocked(options: {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardPlayInProgress: boolean;
}): boolean {
  if (!options.hasActiveBattle || options.screen !== "battle") return true;
  if (isBattlePlayInputBusy(options)) return true;
  if (handHasHiddenCard(options.battleState, options.hiddenHandCardKeys)) return true;
  if (options.battleState.turnPhase !== "player") return true;
  if (options.battleState.wishOptions) return true;
  if (isAutoplayBattleOver(options.battleState)) return true;
  return false;
}

export interface DriveAutoplayDeps {
  signal: AbortSignal;
  isEnabled: () => boolean;
  isBlocked: () => boolean;
  findPlayableCard: () => { card: BattleCard; index: number } | null;
  playCard: (card: BattleCard, index: number) => boolean;
  delayMs: number;
  postPlayDelayMs: number;
  wakeRef?: { current: (() => void) | null } | undefined;
}

async function waitForAutoplayRetry(
  delayMs: number,
  signal: AbortSignal,
  wakeRef?: { current: (() => void) | null } | undefined,
): Promise<void> {
  if (signal.aborted) return;
  if (delayMs <= 0) {
    await Promise.resolve();
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(handle);
      signal.removeEventListener("abort", onAbort);
      if (wakeRef?.current === finish) wakeRef.current = null;
      resolve();
    };
    const onAbort = finish;
    const handle = setTimeout(finish, delayMs);
    if (wakeRef) wakeRef.current = finish;
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function driveAutoplay(deps: DriveAutoplayDeps): Promise<void> {
  const retryDelayMs = resolveGameDelay(deps.delayMs);
  while (!deps.signal.aborted && deps.isEnabled()) {
    if (deps.isBlocked()) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
      continue;
    }

    const playable = deps.findPlayableCard();
    if (!playable) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
      continue;
    }

    const playStartedAt = performance.now();
    if (!deps.playCard(playable.card, playable.index)) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
      continue;
    }

    while (!deps.signal.aborted && deps.isEnabled() && deps.isBlocked()) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
    }

    const remainingMs = resolveGameDelay(deps.postPlayDelayMs) - (performance.now() - playStartedAt);
    await waitForAutoplayRetry(remainingMs, deps.signal, deps.wakeRef);
  }
}
