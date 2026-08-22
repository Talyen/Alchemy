// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";

describe("RunEndScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows keyword XP earned this run from runEndTalentXP snapshot", () => {
    render(
      <RunEndScreen
        title="Defeat"
        subtitle="Your run has ended."
        runEndTalentXP={{ physical: 12, burn: 3 }}
        talentXP={{ physical: 20, burn: 3 }}
        runEndMaterials={{ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 }}
        onContinue={() => {}}
        onOpenMenu={() => {}}
      />,
    );

    expect(screen.getByText("+12").isConnected).toBe(true);
    expect(screen.getByText("+3").isConnected).toBe(true);
    expect(screen.getByText("Physical").isConnected).toBe(true);
  });

  it("hides keyword section when runEndTalentXP is empty", () => {
    render(
      <RunEndScreen
        title="Defeat"
        subtitle="Your run has ended."
        runEndTalentXP={{}}
        talentXP={{}}
        runEndMaterials={{ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 }}
        onContinue={() => {}}
        onOpenMenu={() => {}}
      />,
    );

    expect(screen.queryByText("+12")).toBeNull();
    expect(screen.queryByText("Physical")).toBeNull();
    expect(screen.getByRole("button", { name: /continue/i }).isConnected).toBe(true);
  });
});
