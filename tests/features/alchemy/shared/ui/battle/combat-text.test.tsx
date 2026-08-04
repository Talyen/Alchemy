// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CombatTextRail } from "@/features/alchemy/shared/ui/battle/combat-text";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { FloatingCombatText } from "@/features/alchemy/shared/types";

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
});

describe("CombatTextRail", () => {
  const sampleEntry: FloatingCombatText = {
    id: "test-1",
    target: "enemy",
    kind: "damage",
    stat: "physical",
    amount: 15,
    displayText: "-15",
    lane: 0,
  };

  it("renders null when entries array is empty", () => {
    const { container } = render(<CombatTextRail entries={[]} side="enemy" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders combat text bubble with display text", () => {
    render(<CombatTextRail entries={[sampleEntry]} side="enemy" />);
    expect(screen.getByText("-15")).toBeDefined();
  });
});
