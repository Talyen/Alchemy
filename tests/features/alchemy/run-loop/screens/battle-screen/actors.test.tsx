import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { BattleActors } from "@/features/alchemy/run-loop/screens/battle-screen/actors";
import { ShakingArtPanel } from "@/features/alchemy/run-loop/battle/presentation/actor-vfx";

vi.mock("@/features/alchemy/run-loop/battle/presentation/actor-vfx", () => ({
  ShakingArtPanel: vi.fn(() => null),
  ShakingCompanionPanel: () => null,
  CombatTextRailSide: () => null,
}));

beforeEach(() => vi.clearAllMocks());

it.each([
  { playerHealth: 0, deathsDoorActive: false, dead: true },
  { playerHealth: 0, deathsDoorActive: true, dead: false },
  { playerHealth: 1, deathsDoorActive: false, dead: false },
])("player death presentation follows defeat: %j", ({ playerHealth, deathsDoorActive, dead }) => {
  render(
    <BattleActors
      view={{
        battleState: { ...defaultBattleState(), playerHealth, deathsDoorActive },
        characterId: "knight",
        heroArt: "/hero.webp",
        playerName: "Knight",
        aspectMode: "standard",
        stagePixelRatio: 1,
      }}
      feedback={{ playerStatusChips: [], enemyStatusChips: [], activeLabyrinthModifiers: [] }}
      refs={{
        handCardRefs: { current: {} },
        drawPileRef: { current: null },
        discardPileRef: { current: null },
        battleSceneRef: { current: null },
        playerPanelRef: { current: null },
        enemyPanelRef: { current: null },
      }}
    />,
  );
  expect(vi.mocked(ShakingArtPanel).mock.calls.find(([props]) => props.side === "player")?.[0]).toEqual(
    expect.objectContaining({ isDead: dead, turnUrgentHide: dead }),
  );
});
