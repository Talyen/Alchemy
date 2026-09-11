import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatTextRail } from "@/features/alchemy/shared/ui/battle/combat-text";
import type { CombatTextBurst } from "@/features/alchemy/shared/types";

const protectedHit: CombatTextBurst = {
  id: "protected-hit",
  target: "player",
  lifetimeMs: 1100,
  entries: [{ id: "notice", target: "player", kind: "notice", stat: "deathsDoor", text: "", displayText: "" }],
};

describe("CombatTextRail", () => {
  it("retains the centered Death's Door skull without adding text", () => {
    const { container } = render(<CombatTextRail bursts={[protectedHit]} />);
    expect(container.querySelector("svg.lucide-skull")).not.toBeNull();
    expect(container.querySelector(".text-red-200")).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it("keeps existing action nodes and typed numbers when a new action appears", () => {
    const damage: CombatTextBurst = {
      id: "first",
      target: "enemy",
      lifetimeMs: 1100,
      entries: [
        { id: "first-damage", target: "enemy", kind: "damage", stat: "physical", amount: 5, displayText: "-5" },
      ],
    };
    const { container, rerender } = render(<CombatTextRail bursts={[damage]} />);
    const firstNode = container.querySelector('[data-burst-id="first"]');
    const second = {
      ...damage,
      id: "second",
      entries: [{ ...damage.entries[0]!, id: "second-damage", displayText: "-8" }],
    };
    rerender(<CombatTextRail bursts={[damage, second]} />);
    expect(container.querySelector('[data-burst-id="first"]')).toBe(firstNode);
    expect(firstNode?.textContent).toBe("-5");
    expect(container.querySelector('[data-burst-id="second"]')?.textContent).toBe("-8");
  });
});
