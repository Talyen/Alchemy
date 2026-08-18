// Headless autoplay loop: play the first playable hand card, wait, retry on reject.
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";

export { findFirstPlayableHandCard } from "./playable-hand";

function isAutoplayBattleOver(state: BattleState): boolean {
  return state.enemyHealth <= 0 || isPlayerDefeated(state);
}

/** Shared idle gate for autoplay and auto-end-turn (menu is autoplay-only). */
export function isBattlePlaybackBlocked(options: {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: Set<string>;
  cardPlayInProgress: boolean;
}): boolean {
  if (!options.hasActiveBattle || options.screen !== "battle") return true;
  if (options.cardPlayInProgress || options.cardTransferInProgress) return true;
  if (options.hiddenHandCardKeys.size > 0) return true;
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
}

async function waitForAutoplayRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  if (delayMs <= 0) {
    await Promise.resolve();
    return;
  }
  await new Promise<void>((resolve) => {
    const handle = { timer: undefined as ReturnType<typeof setTimeout> | undefined };
    const onAbort = () => {
      if (handle.timer !== undefined) clearTimeout(handle.timer);
      resolve();
    };
    handle.timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function driveAutoplay(deps: DriveAutoplayDeps): Promise<void> {
  while (!deps.signal.aborted && deps.isEnabled()) {
    if (deps.isBlocked()) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
      continue;
    }

    const playable = deps.findPlayableCard();
    if (!playable) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
      continue;
    }

    const playStartedAt = performance.now();
    if (!deps.playCard(playable.card, playable.index)) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
      continue;
    }

    while (!deps.signal.aborted && deps.isEnabled() && deps.isBlocked()) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
    }

    const remainingMs = resolveGameDelay(deps.postPlayDelayMs) - (performance.now() - playStartedAt);
    await waitForAutoplayRetry(remainingMs, deps.signal);
  }
}
