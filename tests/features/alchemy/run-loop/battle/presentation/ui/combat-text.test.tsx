import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatTextRail } from "@/features/alchemy/run-loop/battle/presentation/ui/combat-text";
import type { CombatTextBurst } from "@/features/alchemy/shared/types";

const protectedHit: CombatTextBurst = {
  id: "protected-hit",
  target: "player",
  lifetimeMs: 1100,
  firstShownAt: 0,
  entries: [{ id: "notice", target: "player", kind: "notice", stat: "deathsDoor", text: "", displayText: "" }],
};

describe("CombatTextRail", () => {
  it("retains the centered Death's Door skull without adding text", () => {
    const { container } = render(<CombatTextRail bursts={[protectedHit]} />);
    expect(container.querySelector("svg.lucide-skull")).not.toBeNull();
    expect(container.querySelector(".text-red-200")).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it.each([
    { stat: "freeze", text: "Frozen", signal: undefined, icons: 1, label: "Frozen" },
    { stat: "armor", text: "Purged", signal: "purge", icons: 2, label: "Purged Armor" },
    { stat: "nextHitCrit", text: "", signal: "prepared", icons: 2, label: "Predator's Focus prepared" },
    { stat: "freeze", text: "Immune to Freeze", signal: "immune", icons: 2, label: "Immune to Freeze" },
    { stat: "phoenixFeather", text: "Revived", signal: undefined, icons: 1, label: "Revived" },
  ] as const)(
    "renders $stat notices as icons with readable accessible labels",
    ({ stat, text, signal, icons, label }) => {
      const burst: CombatTextBurst = {
        id: "notice",
        target: "player",
        firstShownAt: 0,
        lifetimeMs: 1100,
        entries: [{ id: "notice-entry", target: "player", kind: "notice", stat, text, signal, displayText: "" }],
      };
      const { container } = render(<CombatTextRail bursts={[burst]} />);
      expect(container.textContent).toBe("");
      expect(container.querySelectorAll("svg")).toHaveLength(icons);
      expect(container.querySelector('[data-testid="combat-text"]')?.getAttribute("aria-label")).toBe(label);
    },
  );

  it("adds critical glow without changing damage text, typography, or accessible meaning", () => {
    const burst: CombatTextBurst = {
      id: "critical-hit",
      target: "enemy",
      lifetimeMs: 1100,
      firstShownAt: 0,
      entries: [
        { id: "crit", target: "enemy", kind: "damage", stat: "stun", amount: 22, critical: true, displayText: "-22" },
        { id: "ordinary", target: "enemy", kind: "damage", stat: "stun", amount: 10, displayText: "-10" },
      ],
    };
    const { container } = render(<CombatTextRail bursts={[burst]} />);
    const entries = container.querySelectorAll('[data-testid="combat-text"]');
    expect(entries[0]?.textContent).toBe("-22");
    expect(entries[0]?.getAttribute("aria-label")).toBe("Critical Stun: -22");
    expect(entries[1]?.textContent).toBe("-10");
    expect(entries[1]?.getAttribute("aria-label")).toBe("Stun: -10");
    expect(entries[0]?.className).toContain("combat-text-critical");
    expect(entries[1]?.className).not.toContain("combat-text-critical");
    expect(entries[0]?.className.replace(" combat-text-critical", "")).toBe(entries[1]?.className);
  });

  it("keeps existing action nodes and typed numbers when a new action appears", () => {
    const damage: CombatTextBurst = {
      id: "first",
      target: "enemy",
      lifetimeMs: 1100,
      firstShownAt: 0,
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

it("shows a named reaction and one Critical-inclusive total without a lone reaction icon", () => {
  const prepared = prepareCombatFeedback(
    [
      { target: "enemy", kind: "notice", stat: "physical", text: "Shatter", signal: "reaction", reactionId: "shatter" },
      { target: "enemy", kind: "damage", stat: "physical", amount: 6, critical: true },
      { target: "enemy", kind: "damage", stat: "physical", amount: 8, additive: false },
    ],
    1,
    0,
    1100,
  );
  const { container } = render(<CombatTextRail bursts={prepared.bursts} reactions={prepared.reactions} />);
  expect(container.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(1);
  expect(container.querySelector('[data-testid="combat-text"]')?.getAttribute("aria-label")).toBe(
    "Physical: -14 (includes a Critical)",
  );
  const name = container.querySelector('[data-reaction="shatter"]');
  expect(name?.textContent).toBe("Shatter");
  expect(name?.closest('[data-testid="combat-feedback-action"]')).toBe(
    container.querySelector('[data-testid="combat-text"]')?.closest('[data-testid="combat-feedback-action"]'),
  );
  expect((name!.firstElementChild as HTMLElement).style.webkitTextStroke).toBe("0px");
  expect(name?.querySelector("svg")).toBeNull();
  expect(container.querySelectorAll("svg")).toHaveLength(1);
});
