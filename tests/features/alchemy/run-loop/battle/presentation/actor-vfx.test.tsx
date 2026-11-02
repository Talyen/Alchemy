import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore } from "zustand";
import {
  BattleArtPanel,
  ShakingArtPanel,
  ShakingCompanionPanel,
} from "@/features/alchemy/run-loop/battle/presentation/actor-vfx";
import type { BattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/actor-panel", () => ({
  ArtPanel: (props: Record<string, unknown>) => (
    <div
      data-testid="art-panel-mock"
      data-side={props.side as string}
      data-shimmer-id={props.shimmerId as string}
      data-shimmer-active={String(props.shimmerActive)}
      data-shimmer-token={String(props.shimmerToken)}
      data-attack-token={String(props.attackToken)}
      data-dodge-token={String(props.dodgeToken)}
    />
  ),
}));

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/companion-panel", () => ({
  CompanionPanel: (props: { companion: { id: string }; shaking?: boolean }) => (
    <div
      data-testid="companion-panel-mock"
      data-companion-id={props.companion.id}
      data-shaking={String(props.shaking)}
    />
  ),
}));

function createMockPresentationStore(initial: Partial<ReturnType<BattlePresentationStore["getState"]>> = {}) {
  return createStore(() => ({
    playerImpactCue: null,
    enemyImpactCue: null,
    playerAttackToken: 0,
    enemyAttackToken: 0,
    playerCastToken: 0,
    enemyCastToken: 0,
    playerDodgeToken: 0,
    enemyDodgeToken: 0,
    companionShaking: false,
    companionActionCue: null,
    ...initial,
  })) as BattlePresentationStore;
}

describe("actor-vfx presentation connectors", () => {
  afterEach(cleanup);
  it("BattleArtPanel is exported as an alias of ShakingArtPanel", () => {
    expect(BattleArtPanel).toBe(ShakingArtPanel);
  });

  it("extracts side-specific feedback and shimmer state for player", () => {
    useUiStore.setState({
      shimmerState: { cardId: "hero-portrait", token: 42 },
    });

    const store = createMockPresentationStore({
      playerAttackToken: 2,
      playerDodgeToken: 1,
      enemyAttackToken: 9,
      enemyDodgeToken: 7,
    });

    render(
      <ShakingArtPanel
        presentation={store}
        side="player"
        shimmerId="hero-portrait"
        title="Knight"
        art="/knight.webp"
        health={30}
        maxHealth={30}
        statuses={[]}
      />,
    );

    const mock = screen.getByTestId("art-panel-mock");
    expect(mock.getAttribute("data-side")).toBe("player");
    expect(mock.getAttribute("data-shimmer-id")).toBe("hero-portrait");
    expect(mock.getAttribute("data-shimmer-active")).toBe("true");
    expect(mock.getAttribute("data-shimmer-token")).toBe("42");
    expect(mock.getAttribute("data-attack-token")).toBe("2");
    expect(mock.getAttribute("data-dodge-token")).toBe("1");
  });

  it("extracts side-specific feedback and shimmer state for enemy", () => {
    useUiStore.setState({
      shimmerState: { cardId: "other-card", token: 99 },
    });

    const store = createMockPresentationStore({
      playerAttackToken: 2,
      enemyAttackToken: 5,
      enemyDodgeToken: 3,
    });

    render(
      <ShakingArtPanel
        presentation={store}
        side="enemy"
        shimmerId="enemy-portrait"
        title="Goblin"
        art="/goblin.webp"
        health={15}
        maxHealth={15}
        statuses={[]}
      />,
    );

    const mock = screen.getByTestId("art-panel-mock");
    expect(mock.getAttribute("data-side")).toBe("enemy");
    expect(mock.getAttribute("data-shimmer-active")).toBe("false");
    expect(mock.getAttribute("data-shimmer-token")).toBe("undefined");
    expect(mock.getAttribute("data-attack-token")).toBe("5");
    expect(mock.getAttribute("data-dodge-token")).toBe("3");
  });

  it("filters companion action cue only to matching companion id", () => {
    const companion = {
      id: "wolf",
      title: "Wolf",
      art: "/wolf.webp",
      rarity: "common",
      description: "A faithful wolf",
      energyCost: 1,
      affinity: "neutral",
      abilityId: "bite",
    } as const;

    const store = createMockPresentationStore({
      companionShaking: true,
      companionActionCue: {
        sequence: 1,
        companionId: "owl", // Different companion
        kind: "cast",
      },
    });

    const { rerender } = render(
      <ShakingCompanionPanel
        presentation={store}
        companion={companion as unknown as Parameters<typeof ShakingCompanionPanel>[0]["companion"]}
      />,
    );

    expect(screen.getByTestId("companion-action-motion").getAttribute("data-companion-action")).toBeNull();

    // Now update store to target this companion
    store.setState({
      companionActionCue: {
        sequence: 2,
        companionId: "wolf",
        kind: "attack",
      },
    });

    rerender(
      <ShakingCompanionPanel
        presentation={store}
        companion={companion as unknown as Parameters<typeof ShakingCompanionPanel>[0]["companion"]}
      />,
    );

    expect(screen.getByTestId("companion-action-motion").getAttribute("data-companion-action")).toBe("attack");
  });

  it("ignores action cue when inactive is set", () => {
    const companion = {
      id: "wolf",
      title: "Wolf",
      art: "/wolf.webp",
      rarity: "common",
      description: "A faithful wolf",
      energyCost: 1,
      affinity: "neutral",
      abilityId: "bite",
    } as const;

    const store = createMockPresentationStore({
      companionActionCue: {
        sequence: 1,
        companionId: "wolf",
        kind: "attack",
      },
    });

    render(
      <ShakingCompanionPanel
        presentation={store}
        inactive
        companion={companion as unknown as Parameters<typeof ShakingCompanionPanel>[0]["companion"]}
      />,
    );

    expect(screen.getByTestId("companion-action-motion").getAttribute("data-companion-action")).toBeNull();
  });
});
