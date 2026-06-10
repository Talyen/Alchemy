// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameOverScreen } from "@/features/alchemy/run-loop/screens/game-over-screen";

describe("GameOverScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows keyword XP earned this run from runEndTalentXP snapshot", () => {
    render(
      <GameOverScreen
        runEndTalentXP={{ physical: 12, burn: 3 }}
        talentXP={{ physical: 20, burn: 3 }}
        runEndMaterials={{ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 }}
        onMainMenu={() => {}}
      />,
    );

    expect(screen.getByText("+12")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("Physical")).toBeTruthy();
  });

  it("hides keyword section when runEndTalentXP is empty", () => {
    render(
      <GameOverScreen
        runEndTalentXP={{}}
        talentXP={{}}
        runEndMaterials={{ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 }}
        onMainMenu={() => {}}
      />,
    );

    expect(screen.queryByText("+12")).toBeNull();
    expect(screen.queryByText("Return to Main Menu")).toBeTruthy();
  });
});
