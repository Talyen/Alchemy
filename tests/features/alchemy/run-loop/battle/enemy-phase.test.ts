import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { battleSnapshot, endPlayerTurn } from "@/lib/battle";
import { playTurnFrames } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattlePresentationPort } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { patchBattleState } from "../../../../fixtures/battle";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

function makePresentation() {
  return {
    setDisplayedBattle: vi.fn(),
    showCombatTexts: vi.fn(),
    shakeEnemy: vi.fn(),
    shakePlayer: vi.fn(),
    telegraphAttack: vi.fn(),
    telegraphCast: vi.fn(),
    shakeCompanion: vi.fn(),
  } as unknown as BattlePresentationPort;
}

function makeHasteFrame() {
  const before = patchBattleState({ playerStatuses: { haste: 1 } });
  const turn = endPlayerTurn(before);
  if (turn.kind !== "haste") throw new Error("Expected a haste turn for the fixture");
  return { before: battleSnapshot(before), turn, companion: null } as const;
}

describe("playTurnFrames", () => {
  installImmediateRafForTests();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals haste frames without enemy presentation", async () => {
    const frame = makeHasteFrame();
    const presentation = makePresentation();
    const deps = makeDrawSequenceDeps({ isSessionActive: () => true });

    await playTurnFrames([frame], 3, deps, presentation);

    if (frame.turn.combatTexts.length === 0) {
      // Unified feedback helper skips empty text batches (the store no-ops on them anyway).
      expect(presentation.showCombatTexts).not.toHaveBeenCalled();
    } else {
      expect(presentation.showCombatTexts).toHaveBeenCalledWith(frame.turn.combatTexts);
    }
    expect(presentation.setDisplayedBattle).toHaveBeenCalledWith(frame.turn.state);
    expect(presentation.telegraphAttack).not.toHaveBeenCalled();
    expect(presentation.telegraphCast).not.toHaveBeenCalled();
  });

  it("stops immediately when the session is no longer active", async () => {
    const frame = makeHasteFrame();
    const presentation = makePresentation();
    const deps = makeDrawSequenceDeps({ isSessionActive: () => false });

    await playTurnFrames([frame], 3, deps, presentation);

    expect(presentation.showCombatTexts).not.toHaveBeenCalled();
    expect(presentation.setDisplayedBattle).not.toHaveBeenCalled();
    expect(deps.animateDrawnHand).not.toHaveBeenCalled();
  });

  it("never mutates the resolved frames it replays", async () => {
    const frame = makeHasteFrame();
    const frozen = [{ ...frame, before: Object.freeze(frame.before), turn: Object.freeze(frame.turn) }];
    await expect(
      playTurnFrames(frozen, 3, makeDrawSequenceDeps({ isSessionActive: () => true }), makePresentation()),
    ).resolves.toBeUndefined();
  });

  it("keeps card input locked while a skipped player turn is presented", async () => {
    const frame = makeHasteFrame();
    const skipped = { ...frame, turn: { ...frame.turn, playerTurnSkipped: true } };
    const onHandDrawn = vi.fn();
    const deps = makeDrawSequenceDeps({ isSessionActive: () => true });
    const presentation = makePresentation();

    await playTurnFrames([skipped], 3, deps, presentation, { onHandDrawn });
    expect(onHandDrawn).not.toHaveBeenCalled();
    await playTurnFrames([frame], 3, deps, presentation, { onHandDrawn });
    expect(onHandDrawn).toHaveBeenCalledTimes(1);
  });

  it("calls onHandDrawn to unblock card plays and delays companion attack by 0.5s", async () => {
    vi.useFakeTimers();
    try {
      const frame = makeHasteFrame();
      const companionTexts = [{ target: "enemy", kind: "damage", stat: "health", amount: 6 }] as const;
      const companionState = patchBattleState({ ...frame.turn.state, enemyHealth: 14 });
      const companionFrame = {
        ...frame,
        companion: {
          id: "hound",
          texts: [...companionTexts],
          state: battleSnapshot(companionState),
        },
      };
      const presentation = makePresentation();
      const deps = makeDrawSequenceDeps({ isSessionActive: () => true });
      const onHandDrawn = vi.fn();

      const playPromise = playTurnFrames([companionFrame], 3, deps, presentation, { onHandDrawn });
      await vi.advanceTimersByTimeAsync(0);

      // Hand draw completed, unblocking card play
      expect(onHandDrawn).toHaveBeenCalledTimes(1);
      // Companion attack has not triggered yet before 500ms
      expect(presentation.telegraphAttack).not.toHaveBeenCalled();

      // Advance by 500ms (0.5s)
      await vi.advanceTimersByTimeAsync(500);
      await playPromise;

      expect(presentation.setDisplayedBattle).toHaveBeenCalledWith(companionFrame.companion.state);
      expect(presentation.telegraphAttack).toHaveBeenCalledWith("companion");
      expect(presentation.shakeCompanion).toHaveBeenCalled();
      expect(presentation.showCombatTexts).toHaveBeenCalledWith(expect.arrayContaining([...companionTexts]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not overwrite displayedBattle if a card play began during companion delay", async () => {
    vi.useFakeTimers();
    try {
      const frame = makeHasteFrame();
      const companionTexts = [{ target: "enemy", kind: "damage", stat: "health", amount: 6 }] as const;
      const companionState = patchBattleState({ ...frame.turn.state, enemyHealth: 14 });
      const companionFrame = {
        ...frame,
        companion: {
          id: "hound",
          texts: [...companionTexts],
          state: battleSnapshot(companionState),
        },
      };
      const presentation = makePresentation();
      const deps = makeDrawSequenceDeps({ isSessionActive: () => true });
      let cardPlayInProgress = false;

      const playPromise = playTurnFrames([companionFrame], 3, deps, presentation, {
        onHandDrawn: () => {
          // Card play begins immediately after hand draw
          cardPlayInProgress = true;
        },
        isCardPlayInProgress: () => cardPlayInProgress,
      });

      await vi.advanceTimersByTimeAsync(500);
      await playPromise;

      // Companion sound, shake, lunge, and text still play
      expect(presentation.telegraphAttack).toHaveBeenCalledWith("companion");
      expect(presentation.shakeCompanion).toHaveBeenCalled();
      expect(presentation.showCombatTexts).toHaveBeenCalledWith(expect.arrayContaining([...companionTexts]));
      // But displayedBattle was not overwritten with stale companion.state
      expect(presentation.setDisplayedBattle).not.toHaveBeenCalledWith(companionFrame.companion.state);
    } finally {
      vi.useRealTimers();
    }
  });
});
