import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatTextRail } from "@/features/alchemy/run-loop/battle/presentation/ui/combat-text";
import type { CombatTextBurst } from "@/features/alchemy/shared/types";
import {
  advanceCombatFeedback,
  scheduleCombatFeedback,
} from "@/features/alchemy/run-loop/battle/combat-feedback-queue";

const protectedHit: CombatTextBurst = {
  id: "protected-hit",
  target: "player",
  lifetimeMs: 1100,
  firstShownAt: 0,
  entries: [{ id: "notice", target: "player", kind: "notice", stat: "deathsDoor", text: "", displayText: "" }],
};

describe("CombatTextRail", () => {
  it("retains the Death's Door skull in setback feedback without adding text", () => {
    const { container } = render(<CombatTextRail bursts={[protectedHit]} />);
    expect(container.querySelector("svg.lucide-skull")).not.toBeNull();
    expect(container.querySelector(".text-red-200")).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it.each([
    { stat: "freeze", text: "Frozen", signal: undefined, icons: 1, label: "Frozen" },
    { stat: "armor", text: "Purged", signal: "purge", icons: 2, label: "Purged Armor" },
    { stat: "nextHitCrit", text: "", signal: "prepared", icons: 2, label: "Predator's Focus prepared" },
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

  it("omits immunity flights for every intent without losing actual damage or control application", () => {
    const events = [
      { target: "enemy", kind: "damage", stat: "stun", amount: 8, feedback: "primary" },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "notice", stat: "stun", text: "Immune to Stun", signal: "immune", feedback: "primary" },
      {
        target: "player",
        kind: "notice",
        stat: "freeze",
        text: "Immune to Freeze",
        signal: "immune",
        feedback: "secondary",
      },
    ] as const;
    const original = structuredClone(events);
    const prepared = prepareCombatFeedback(events, 1, 0, 1100);
    expect(prepared.bursts.flatMap((burst) => burst.entries)).toHaveLength(2);
    expect(prepareCombatFeedback(events.slice(2), 2, 0, 1100).bursts).toEqual([]);
    // Raw/replayed presentation input must obey the same rule.
    const raw = {
      ...prepared.bursts[0]!,
      entries: events.map((event, i) => ({
        ...event,
        id: String(i),
        displayText: event.kind === "damage" ? "-8" : "",
      })),
    };
    const { container } = render(<CombatTextRail bursts={[raw]} />);
    expect(container.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Stunned"]')).not.toBeNull();
    expect(container.querySelector('[data-kind="damage"]')?.textContent).toBe("-8");
    expect(container.querySelector("svg.lucide-shield-check")).toBeNull();
    expect(events).toEqual(original);
  });

  it("marks only secondary state gains and control applications for live status-row deduplication", () => {
    const prepared = prepareCombatFeedback(
      [
        { target: "player", kind: "status", stat: "block", amount: 6, feedback: "primary" },
        { target: "player", kind: "status", stat: "thorns", amount: 2, feedback: "secondary" },
        { target: "player", kind: "status", stat: "armor", amount: 0, feedback: "secondary" },
        { target: "player", kind: "damage", stat: "block", amount: 2, feedback: "secondary" },
        { target: "player", kind: "notice", stat: "burn", text: "Cleansed", signal: "cleanse" },
        { target: "enemy", kind: "notice", stat: "armor", text: "Purged", signal: "purge" },
        { target: "player", kind: "notice", stat: "nextHitCrit", text: "", signal: "prepared", feedback: "secondary" },
        { target: "player", kind: "notice", stat: "companion", text: "Summoned" },
        { target: "enemy", kind: "notice", stat: "stun", text: "Stunned", feedback: "secondary" },
      ],
      4,
      0,
      1100,
    );
    const { container } = render(<CombatTextRail bursts={prepared.bursts} />);
    const marked = [...container.querySelectorAll("[data-secondary-status-feedback]")].map((node) =>
      node.getAttribute("data-secondary-status-feedback"),
    );
    expect(marked).toEqual(["player:nextHitCrit", "player:thorns", "enemy:stunned"]);
    expect(
      container
        .querySelector('[data-stat="block"][data-kind="status"]')
        ?.closest("[data-feedback-lane]")
        ?.getAttribute("data-feedback-lane"),
    ).toBe("impact");
    expect(container.querySelector('[aria-label="Stunned"]')).not.toBeNull();
  });

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

it("keeps the direct flight independent while pairing the reaction name and bonus with matching shine", () => {
  const prepared = prepareCombatFeedback(
    [
      { target: "enemy", kind: "notice", stat: "physical", text: "Shatter", signal: "reaction", reactionId: "shatter" },
      { target: "enemy", kind: "damage", stat: "physical", amount: 6, critical: true, feedback: "primary" },
      {
        target: "enemy",
        kind: "damage",
        stat: "physical",
        amount: 8,
        additive: false,
        reactionId: "shatter",
        feedback: "secondary",
      },
    ],
    1,
    0,
    1100,
  );
  const { container } = render(<CombatTextRail bursts={prepared.bursts} reactions={prepared.reactions} />);
  expect(container.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(2);
  expect(container.querySelector('[data-testid="combat-text"]')?.getAttribute("aria-label")).toBe(
    "Critical Physical: -6",
  );
  const bonus = container.querySelector('[data-reaction-id="shatter"]');
  expect(bonus?.getAttribute("aria-label")).toBe("Physical: -8");
  const name = container.querySelector('[data-reaction="shatter"]');
  expect(name?.textContent).toBe("Shatter");
  expect(name?.closest('[data-testid="combat-feedback-action"]')).not.toBe(
    container.querySelector('[data-testid="combat-text"]')?.closest('[data-testid="combat-feedback-action"]'),
  );
  expect(name?.closest('[data-testid="combat-feedback-action"]')).toBe(
    bonus?.closest('[data-testid="combat-feedback-action"]'),
  );
  expect((name!.firstElementChild as HTMLElement).style.webkitTextStroke).toBe("0px");
  expect(name?.querySelector("svg")).toBeNull();
  expect(container.querySelectorAll("svg")).toHaveLength(2);
  expect(bonus?.closest("[data-feedback-lane]")?.getAttribute("data-feedback-lane")).toBe("announcement");
  expect(bonus?.querySelector(".reaction-text-shine")?.getAttribute("style")).toBe(
    name?.firstElementChild?.getAttribute("style"),
  );
});

it("fans direct hits independently and gives simultaneous reactions separate stable routes", () => {
  const prepared = prepareCombatFeedback(
    [
      { target: "enemy", kind: "damage", stat: "burn", amount: 8, feedback: "primary" },
      { target: "enemy", kind: "damage", stat: "nature", amount: 7 },
      { target: "enemy", kind: "notice", stat: "burn", text: "", signal: "reaction", reactionId: "frostfire" },
      { target: "enemy", kind: "damage", stat: "burn", amount: 6, reactionId: "frostfire" },
      { target: "enemy", kind: "notice", stat: "burn", text: "", signal: "reaction", reactionId: "venomflash" },
      { target: "enemy", kind: "damage", stat: "burn", amount: 2, reactionId: "venomflash" },
    ],
    4,
    0,
    1050,
  );
  const scheduled = scheduleCombatFeedback(prepared.bursts, prepared.reactions, 0, 1050, false);
  const hits = scheduled.floatingCombatBursts[0]!.entries;
  expect(hits[0]!.presentation!.spread).not.toBe(hits[1]!.presentation!.spread);
  expect(scheduled.reactionAnnouncements[0]!.presentation!.spread).not.toBe(
    scheduled.reactionAnnouncements[1]!.presentation!.spread,
  );
  expect([...hits, ...scheduled.reactionAnnouncements].every((entry) => entry.presentation!.launchAt <= 180)).toBe(
    true,
  );
  const shown = advanceCombatFeedback(scheduled.floatingCombatBursts, scheduled.reactionAnnouncements, 180);
  const { container } = render(
    <CombatTextRail bursts={shown.floatingCombatBursts} reactions={shown.reactionAnnouncements} />,
  );
  expect(container.querySelectorAll('[data-testid="combat-feedback-action"]')).toHaveLength(4);
  for (const id of ["frostfire", "venomflash"]) {
    const pair = container.querySelector(`[data-reaction="${id}"]`)!.closest('[data-testid="combat-feedback-action"]');
    expect(pair?.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(1);
    expect(pair?.querySelector(`[data-reaction-id="${id}"]`)).not.toBeNull();
  }
});

it("does not mount queued text early and preserves the active flight when another entry arrives", () => {
  const prepared = prepareCombatFeedback(
    [{ target: "enemy", kind: "damage", stat: "physical", amount: 9 }],
    1,
    0,
    1050,
  );
  const first = prepared.bursts[0]!;
  first.entries[0]!.presentation = { lane: "impact", launchAt: 0, lifetimeMs: 1050, phase: "visible", spread: 0 };
  const pending = {
    ...first.entries[0]!,
    id: "pending",
    displayText: "+8",
    presentation: {
      lane: "impact" as const,
      launchAt: 180,
      lifetimeMs: 1050,
      phase: "waiting" as const,
      spread: 1 as const,
    },
  };
  const { container, rerender } = render(<CombatTextRail bursts={[first]} />);
  const flight = container.querySelector('[data-testid="combat-feedback-action"]');
  rerender(<CombatTextRail bursts={[{ ...first, entries: [...first.entries, pending] }]} />);
  expect(container.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(1);
  expect(container.querySelector('[data-testid="combat-feedback-action"]')).toBe(flight);
  rerender(
    <CombatTextRail
      bursts={[
        {
          ...first,
          entries: [...first.entries, { ...pending, presentation: { ...pending.presentation, phase: "visible" } }],
        },
      ]}
    />,
  );
  expect(container.querySelectorAll('[data-testid="combat-text"]')).toHaveLength(2);
  expect(container.querySelector('[data-testid="combat-feedback-action"]')).toBe(flight);
  expect(flight?.closest("[data-feedback-spread]")?.getAttribute("data-feedback-spread")).toBe("0");
  expect(container.querySelector('[data-feedback-spread="1"]')).not.toBeNull();
});
