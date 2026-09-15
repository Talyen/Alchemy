import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { battleSnapshot, endPlayerTurn } from "@/lib/battle";
import { playTurnFrames } from "@/features/alchemy/run-loop/battle/enemy-phase";
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

    expect(presentation.showCombatTexts).toHaveBeenCalledWith(frame.turn.combatTexts);
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
});
