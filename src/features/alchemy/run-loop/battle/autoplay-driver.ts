import { useCallback, type RefObject } from "react";
import type { AutoplayCardHandler, AutoplayWishHandler } from "./battle-context";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { isPlayerDefeated, type BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { isBattleInspectionOpen, useUiStore } from "../../shared/stores/ui-store";
import { useLatestRef } from "../../shared/ui/use-latest-ref";

import { handHasHiddenCard, type HiddenHandCardKeys } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

function isAutoplayBattleOver(state: BattleSnapshot): boolean {
  return state.enemyHealth <= 0 || isPlayerDefeated(state);
}

export function isBattlePlayInputBusy(options: {
  cardPlayInProgress: boolean;
  cardTransferInProgress: boolean;
}): boolean {
  return options.cardPlayInProgress || options.cardTransferInProgress;
}

interface PlaybackBlockedOptions {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardPlayInProgress: boolean;
  gameMenuOpen?: boolean;
  inspectionOpen?: boolean;
}

function isPlaybackBlockedCore(options: PlaybackBlockedOptions, wishMode: "excluded" | "required"): boolean {
  if (options.gameMenuOpen || options.inspectionOpen) return true;
  if (!options.hasActiveBattle || options.screen !== "battle") return true;
  if (isBattlePlayInputBusy(options)) return true;
  if (handHasHiddenCard(options.battleState, options.hiddenHandCardKeys)) return true;
  if (options.battleState.turnPhase !== "player") return true;
  if (wishMode === "excluded" ? options.battleState.wishOptions : !options.battleState.wishOptions) return true;
  if (isAutoplayBattleOver(options.battleState)) return true;
  return false;
}

export function isBattlePlaybackBlocked(options: PlaybackBlockedOptions): boolean {
  return isPlaybackBlockedCore(options, "excluded");
}

export interface DriveAutoplayDeps {
  signal: AbortSignal;
  isEnabled: () => boolean;
  isBlocked: () => boolean;
  findPlayableCard: () => { card: BattleCard; index: number } | null;
  playCard: AutoplayCardHandler;
  /** Wish auto-pick plumbing. Absent (or a blocked check) disables the Wish branch. */
  isWishBlocked?: () => boolean;
  findWishChoice?: () => BattleCard | null;
  playWish?: AutoplayWishHandler;
  delayMs: number;
  postPlayDelayMs: number;
  wakeRef?: { current: (() => void) | null } | undefined;
}

/**
 * Gate for Wish auto-picks: same inputs as the card gate except Wish options
 * must be present (instead of absent) for the branch to proceed. Hand
 * transfers, menus, inspection, phase, and battle-over still block.
 */
export function isWishPlaybackBlocked(options: PlaybackBlockedOptions): boolean {
  return isPlaybackBlockedCore(options, "required");
}

export interface PlaybackBlockedSource {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen?: boolean;
  isCardPlayInProgress?: (() => boolean) | undefined;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
}

/**
 * Shared "can anything act right now" gate for the autoplay loop and the
 * auto-end-turn timer. Both read the same inputs through this hook so the two
 * gates cannot drift apart; each caller adds its own final check (autoplay
 * finds a playable card, auto-end-turn requires none).
 *
 * Pass an explicit battle state when gating a just-committed snapshot that the
 * component has not re-rendered with yet (e.g. right after a card play);
 * otherwise the latest render state is used. Inspection and presentation state
 * are always read live, so tight loops observe toggles without waiting for a
 * re-render.
 */
function usePlaybackBlockedWithMode(
  source: PlaybackBlockedSource,
  wishMode: "excluded" | "required" = "excluded",
): (battleState?: BattleSnapshot) => boolean {
  const screenRef = useLatestRef(source.screen);
  const battleStateRef = useLatestRef(source.battleState);
  const hasActiveBattleRef = useLatestRef(source.hasActiveBattle);
  const gameMenuOpenRef = useLatestRef(source.gameMenuOpen ?? false);
  const isCardPlayInProgressRef = useLatestRef(source.isCardPlayInProgress);
  const predicate = wishMode === "excluded" ? isBattlePlaybackBlocked : isWishPlaybackBlocked;
  const isBlockedRef = useLatestRef((override?: BattleSnapshot) =>
    predicate({
      screen: screenRef.current,
      battleState: override ?? battleStateRef.current,
      hasActiveBattle: hasActiveBattleRef.current,
      cardTransferInProgress: source.presentationGateRef.current.cardTransferInProgress,
      hiddenHandCardKeys: source.presentationGateRef.current.hiddenHandCardKeys,
      cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
      gameMenuOpen: gameMenuOpenRef.current,
      inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
    }),
  );
  return useCallback((override?: BattleSnapshot) => isBlockedRef.current(override), [isBlockedRef]);
}

export const usePlaybackBlocked = usePlaybackBlockedWithMode;

/**
 * Wish-pick variant of the shared gate: same inputs, but Wish options must be
 * present (instead of absent) for autoplay to proceed. Lets the autoplay loop
 * resolve Wishes while the card gate and auto-end-turn timer stay parked.
 */
export function useWishPlaybackBlocked(source: PlaybackBlockedSource): (battleState?: BattleSnapshot) => boolean {
  return usePlaybackBlockedWithMode(source, "required");
}

async function waitForAutoplayRetry(
  delayMs: number,
  signal: AbortSignal,
  wakeRef?: { current: (() => void) | null },
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
  const isWishReady = () =>
    deps.isWishBlocked !== undefined &&
    deps.findWishChoice !== undefined &&
    deps.playWish !== undefined &&
    !deps.isWishBlocked();
  // After a successful play, wait for presentation to settle. The card gate
  // stays blocked while Wish options show, so break early when a Wish becomes
  // ready — otherwise the loop would stall behind this wait instead of
  // reaching the Wish branch above (e.g. after playing a Wish-granting card).
  const waitForPlayToSettle = async (playStartedAt: number): Promise<void> => {
    while (!deps.signal.aborted && deps.isEnabled() && deps.isBlocked() && !isWishReady()) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
    }
    const remainingMs = Math.max(0, resolveGameDelay(deps.postPlayDelayMs) - (performance.now() - playStartedAt));
    await waitForAutoplayRetry(remainingMs, deps.signal);
  };
  while (!deps.signal.aborted && deps.isEnabled()) {
    if (isWishReady()) {
      const wish = deps.findWishChoice?.() ?? null;
      if (!wish) {
        await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
        continue;
      }

      const playStartedAt = performance.now();
      if (
        !(await deps.playWish?.(wish, {
          signal: deps.signal,
          canCommit: () => !deps.signal.aborted && deps.isEnabled() && !deps.isWishBlocked?.(),
        }))
      ) {
        await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
        continue;
      }

      await waitForPlayToSettle(playStartedAt);
      continue;
    }

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
    if (
      !(await deps.playCard(playable.card, playable.index, {
        signal: deps.signal,
        canCommit: () => !deps.signal.aborted && deps.isEnabled() && !deps.isBlocked(),
      }))
    ) {
      await waitForAutoplayRetry(retryDelayMs, deps.signal, deps.wakeRef);
      continue;
    }

    await waitForPlayToSettle(playStartedAt);
  }
}
