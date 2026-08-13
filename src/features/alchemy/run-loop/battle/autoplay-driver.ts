// Headless autoplay loop: play the first playable hand card, wait, retry on reject.
import { canPlayCard, isPlayerDefeated, type BattleState, type CardPlayOptions } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

const AUTOPLAY_CARD_PLAY_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function findFirstPlayableHandCard(state: BattleState): { card: BattleCard; index: number } | null {
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (canPlayCard(state, card, index, AUTOPLAY_CARD_PLAY_OPTIONS)) {
      return { card, index };
    }
  }
  return null;
}

export function isAutoplayBattleOver(state: BattleState): boolean {
  return state.enemyHealth <= 0 || isPlayerDefeated(state);
}

export interface DriveAutoplayDeps {
  signal: AbortSignal;
  isEnabled: () => boolean;
  isBlocked: () => boolean;
  findPlayableCard: () => { card: BattleCard; index: number } | null;
  playCard: (card: BattleCard, index: number) => boolean;
  delayMs: number;
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

    if (!deps.playCard(playable.card, playable.index)) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
      continue;
    }

    while (!deps.signal.aborted && deps.isEnabled() && deps.isBlocked()) {
      await waitForAutoplayRetry(deps.delayMs, deps.signal);
    }
  }
}
