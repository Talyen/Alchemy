import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatTextRail } from "@/features/alchemy/shared/ui/battle/combat-text";

describe("CombatTextRail", () => {
  it("renders Death's Door as a centered skull without text", () => {
    const { container } = render(
      <CombatTextRail
        entries={[
          {
            id: "protected-hit",
            target: "player",
            kind: "notice",
            stat: "deathsDoor",
            text: "",
            displayText: "",
            lane: 0,
          },
        ]}
      />,
    );
    expect(container.querySelector("svg.lucide-skull")).not.toBeNull();
    expect(container.querySelector(".text-red-200")).not.toBeNull();
    expect(container.textContent).toBe("");
    expect(container.querySelector("span")).toBeNull();
  });

  it("keeps numeric damage feedback", () => {
    const { container } = render(
      <CombatTextRail
        entries={[
          { id: "damage", target: "player", kind: "damage", stat: "physical", amount: 5, displayText: "-5", lane: 0 },
        ]}
      />,
    );
    expect(container.textContent).toBe("-5");
  });
});
