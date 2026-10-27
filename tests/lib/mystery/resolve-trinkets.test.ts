import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { findMysteryEvent, isMysteryLootEligible, mysteryLootEligibility } from "@/lib/mystery";
import { resolveMysteryEventTrinkets } from "@/lib/mystery/resolve-trinkets";

const eventWithTwoTrinkets = {
  id: "owned-set-test",
  title: "Owned Set",
  art: "test-art",
  narrative: "Test",
  choices: [
    {
      label: "A",
      effects: [
        { kind: "gainTrinket" as const, trinketId: "bone-charm" },
        { kind: "gainTrinket" as const, trinketId: "sin-eaters-lantern" },
      ],
    },
  ],
};

function trinketIdsOn(event: ReturnType<typeof resolveMysteryEventTrinkets>): string[] {
  return event.choices.flatMap((choice) =>
    choice.effects.flatMap((effect) => (effect.kind === "gainTrinket" ? [effect.trinketId] : [])),
  );
}

describe("resolveMysteryEventTrinkets", () => {
  it("keeps the authored trinket when it is not owned", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, []);
    const charm = resolved.choices.find((choice) => choice.label === "Take the Charm");
    expect(charm?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "icy-heart" });
  });

  it("falls back to astral gear when the named trinket is already owned", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["icy-heart"]);
    const charm = resolved.choices.find((choice) => choice.label === "Take the Charm");
    const reward = charm?.effects.find(
      (effect) => effect.kind === "gainTrinket" || effect.kind === "gainGeneratedGear",
    );
    // The narrative still names the charm, so no unrelated trinket is granted.
    expect(reward?.kind).toBe("gainGeneratedGear");
    if (reward?.kind !== "gainGeneratedGear") return;
    expect(reward.astral).toBe(true);
    expect(gearBaseItemList.some((item) => item.id === reward.baseItemId)).toBe(true);
    // The other choice still grants its unowned named trinket.
    const moss = resolved.choices.find((choice) => choice.label === "Gather the Moss");
    expect(moss?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "groves-favor" });
  });

  it("resolves each choice from the same pre-event collection", () => {
    const event = findMysteryEvent("fairy-ring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["lucky-clover", "parasitic-bloom"]);
    // Both named trinkets are owned, so each choice independently falls back
    // to astral gear instead of stealing random trinkets from the other.
    expect(trinketIdsOn(resolved)).toHaveLength(0);
    for (const choice of resolved.choices) {
      expect(choice.effects[0]).toMatchObject({ kind: "gainGeneratedGear", astral: true });
    }
  });

  it("falls back to an astral gear drop instead of a duplicate when every trinket is owned", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned);
    for (const effect of resolved.choices[0]!.effects) {
      expect(effect).toMatchObject({ kind: "gainGeneratedGear", astral: true });
      if (effect.kind !== "gainGeneratedGear") return;
      expect(gearBaseItemList.some((item) => item.id === effect.baseItemId)).toBe(true);
    }
    expect(trinketIdsOn(resolved)).toHaveLength(0);
  });

  it("derives the same fallback gear from the same slot across resolution passes", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const first = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned);
    const second = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned);
    expect(second.choices).toEqual(first.choices);
  });
});

it("offers the same named trinket in every choice that names it", () => {
  const event = {
    ...eventWithTwoTrinkets,
    choices: [
      { label: "A", effects: [{ kind: "gainTrinket" as const, trinketId: "bone-charm" }] },
      { label: "B", effects: [{ kind: "gainTrinket" as const, trinketId: "bone-charm" }] },
    ],
  };
  const resolved = resolveMysteryEventTrinkets(event, []);
  expect(trinketIdsOn(resolved)).toEqual(["bone-charm", "bone-charm"]);
});

it("rejects repeated named Boons within a choice before Astral Gear unlocks", () => {
  const event = {
    ...eventWithTwoTrinkets,
    choices: [
      {
        label: "A",
        effects: [
          { kind: "gainTrinket" as const, trinketId: "bone-charm" },
          { kind: "gainTrinket" as const, trinketId: "bone-charm" },
        ],
      },
    ],
  };
  const early = { depth: 1, highestCompletedDifficulty: null };

  expect(isMysteryLootEligible(event, early, [])).toBe(false);
  expect(isMysteryLootEligible(event, { ...early, depth: 4 }, [])).toBe(true);
  expect(resolveMysteryEventTrinkets(event, []).choices[0]?.effects[1]).toMatchObject({
    kind: "gainGeneratedGear",
    astral: true,
  });
});

it("reuses early-room eligibility across choices without carrying ownership between events", () => {
  const early = { depth: 1, highestCompletedDifficulty: null };
  const eligible = mysteryLootEligibility(early, ["bone-charm"]);
  const owned = {
    ...eventWithTwoTrinkets,
    choices: [{ label: "Owned", effects: [eventWithTwoTrinkets.choices[0]!.effects[0]!] }],
  };
  const unowned = {
    ...eventWithTwoTrinkets,
    choices: [{ label: "Unowned", effects: [eventWithTwoTrinkets.choices[0]!.effects[1]!] }],
  };
  expect(eligible(owned)).toBe(false);
  expect(eligible(unowned)).toBe(true);
  expect(eligible(unowned)).toBe(true);
});
