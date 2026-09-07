import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { useMysteryEventNavigation } from "@/features/alchemy/shell/use-mystery-event-navigation";
import { useCampfireScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";

beforeEach(resetAllTestStores);

describe("Labyrinth destination modifiers", () => {
  it.each([
    ["deep-rest", 23],
    ["healing-spring", 30],
  ] as const)("%s applies its healing through the normal Rest action", (id, health) => {
    setRunProgress({ contentSystemType: "labyrinth", runPlayerHealth: 5, runMaxHealth: 30 });
    setRunSession({ activeLabyrinthRewardModifiers: [id] });
    const navigateTo = vi.fn((_screen: string, commit?: () => void) => commit?.());
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).handleCampfireContinue();
    expect(readActiveRun().runPlayerHealth).toBe(health);
  });

  it("Hidden Purse adds Gold and Herbal Hearth adds a real Potion", () => {
    setRunProgress({ contentSystemType: "labyrinth", gold: 0, runDeck: [] });
    setRunSession({ activeLabyrinthRewardModifiers: ["hidden-purse"] });
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps());
    handlers.handleCampfireContinue();
    expect(readRunProfile().gold).toBe(15);
    setRunSession({ activeLabyrinthRewardModifiers: ["herbal-hearth"] });
    handlers.handleCampfireContinue();
    expect(readActiveRun().runDeck).toHaveLength(1);
    expect(getStandardPotionPool().map((card) => card.id)).toContain(readActiveRun().runDeck[0]!.id);
  });

  it("Campfire selectors keep stable modifier references across renders", () => {
    setRunProgress({ contentSystemType: "labyrinth" });
    setRunSession({ activeLabyrinthRewardModifiers: ["deep-rest"] });
    const { result, rerender } = renderHook(() => useCampfireScreenData());
    const modifiers = result.current.modifiers;
    rerender();
    expect(result.current.modifiers).toBe(modifiers);
  });

  it("Golden Omen presents and pays the doubled event reward once", () => {
    setRunProgress({ contentSystemType: "labyrinth", gold: 0 });
    setRunSession({ activeLabyrinthRewardModifiers: ["golden-omen"] });
    const { result } = renderHook(() => useMysteryEventNavigation({ navigateTo: vi.fn() }));
    act(() => result.current.beginMysteryEvent());
    const choice = readRunSession().mysteryEvent!.choices.find((entry) =>
      entry.effects.some((effect) => effect.kind === "gainGold"),
    )!;
    const gold = choice.effects.reduce((total, effect) => total + (effect.kind === "gainGold" ? effect.amount : 0), 0);
    expect(gold).toBeGreaterThanOrEqual(40);
    act(() => result.current.handleMysteryChoice(choice));
    expect(readRunProfile().gold).toBe(gold);
    act(() => result.current.handleMysteryChoice(choice));
    expect(readRunProfile().gold).toBe(gold);
  });

  it("Restful Discovery includes its healing in the existing event outcome", () => {
    setRunProgress({ contentSystemType: "labyrinth", runPlayerHealth: 5, runMaxHealth: 100 });
    setRunSession({ activeLabyrinthRewardModifiers: ["restful-discovery"] });
    const { result } = renderHook(() => useMysteryEventNavigation({ navigateTo: vi.fn() }));
    act(() => result.current.beginMysteryEvent());
    const choice = readRunSession().mysteryEvent!.choices[0]!;
    expect(choice.effects.at(-1)).toEqual({ kind: "healHealth", amount: 15 });
    act(() => result.current.handleMysteryChoice(choice));
    expect(readActiveRun().runPlayerHealth).toBeGreaterThanOrEqual(20);
  });
});
