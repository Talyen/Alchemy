import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { findMysteryEvent, isMysteryLootEligible } from "@/lib/mystery";
import {
  applyResolvedMysteryTrinketIds,
  repairUnresolvedMysteryTrinkets,
  resolveMysteryEventTrinkets,
} from "@/lib/mystery/resolve-trinkets";

const eventWithTwoTrinkets = {
  id: "owned-set-test",
  title: "Owned Set",
  art: "test-art",
  narrative: "Test",
  choices: [
    {
      label: "A",
      effects: [{ kind: "gainTrinket" as const, trinketId: "bone-charm" }, { kind: "gainRandomTrinket" as const }],
    },
  ],
};

const eventWithConstrainedRandomTrinket = {
  id: "constrained-random-trinket-test",
  title: "Constrained Random Trinket",
  art: "test-art",
  narrative: "Test",
  choices: [
    {
      label: "A",
      effects: [{ kind: "gainRandomTrinket" as const, fromIds: ["bone-charm", "sin-eaters-lantern"] }],
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
    const resolved = resolveMysteryEventTrinkets(event!, [], () => 0.1);
    const charm = resolved.choices.find((choice) => choice.label === "Take the Charm");
    expect(charm?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "icy-heart" });
  });

  it("falls back to astral gear when the named trinket is already owned", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["icy-heart"], () => 0);
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
    const resolved = resolveMysteryEventTrinkets(event!, ["lucky-clover", "parasitic-bloom"], () => 0);
    // Both named trinkets are owned, so each choice independently falls back
    // to astral gear instead of stealing random trinkets from the other.
    expect(trinketIdsOn(resolved)).toHaveLength(0);
    for (const choice of resolved.choices) {
      expect(choice.effects[0]).toMatchObject({ kind: "gainGeneratedGear", astral: true });
    }
  });

  it("reserves a kept preferred trinket so a later random grant cannot reuse it", () => {
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, [], () => 0);
    const ids = trinketIdsOn(resolved);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("bone-charm");
    expect(ids[1]).not.toBe("bone-charm");
  });

  it("concretizes a random trinket from its pool when those ids are free", () => {
    const resolved = resolveMysteryEventTrinkets(eventWithConstrainedRandomTrinket, [], () => 0);
    const trinket = resolved.choices[0]?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
  });

  it("falls back to any unowned trinket when a random pool is already owned", () => {
    const resolved = resolveMysteryEventTrinkets(
      eventWithConstrainedRandomTrinket,
      ["bone-charm", "sin-eaters-lantern"],
      () => 0,
    );
    const trinket = resolved.choices[0]?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).not.toContain(trinket.trinketId);
  });

  it("falls back to an astral gear drop instead of a duplicate when every trinket is owned", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0);
    for (const effect of resolved.choices[0]!.effects) {
      expect(effect).toMatchObject({ kind: "gainGeneratedGear", astral: true });
      if (effect.kind !== "gainGeneratedGear") return;
      expect(gearBaseItemList.some((item) => item.id === effect.baseItemId)).toBe(true);
    }
    expect(trinketIdsOn(resolved)).toHaveLength(0);
  });

  it("derives the same fallback gear from the same slot across resolution passes", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const first = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0.5);
    const second = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0.9);
    expect(second.choices).toEqual(first.choices);
  });
});

describe("version 19 Mystery Boon decoding", () => {
  it("applies saved substitutions onto the pool event", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["icy-heart"], () => 0);
    const hydrated = applyResolvedMysteryTrinketIds(event!, ["groves-favor", ""]);
    expect(hydrated.choices).toEqual(resolved.choices);
  });

  it("decodes Astral fallback slots from the positional id contract", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0);
    const hydrated = applyResolvedMysteryTrinketIds(eventWithTwoTrinkets, ["", ""]);
    expect(hydrated.choices).toEqual(resolved.choices);
  });

  it("does not rewrite authored gear when applying resolved trinket ids", () => {
    const event = {
      id: "authored-gear",
      title: "Authored Gear",
      art: "test-art",
      narrative: "Test",
      choices: [
        {
          label: "A",
          effects: [
            { kind: "gainGeneratedGear" as const, baseItemId: "staff" },
            { kind: "gainTrinket" as const, trinketId: "icy-heart" },
          ],
        },
      ],
    };

    const hydrated = applyResolvedMysteryTrinketIds(event, ["merchants-favor"]);
    expect(hydrated.choices[0]?.effects[0]).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "staff",
    });
    expect(hydrated.choices[0]?.effects[1]).toEqual({ kind: "gainTrinket", trinketId: "merchants-favor" });
  });

  it("can re-apply resolved ids to an already resolved event with fallback astral gear", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0);
    const rehydrated = applyResolvedMysteryTrinketIds(resolved, ["", ""]);
    expect(rehydrated.choices).toEqual(resolved.choices);
  });

  it("repairs a legacy visit that still has gainRandomTrinket", () => {
    const repaired = repairUnresolvedMysteryTrinkets(eventWithConstrainedRandomTrinket, [], () => 0);
    const trinket = repaired.choices[0]?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
  });
});

it("keeps the last unowned Boon available in mutually exclusive choices", () => {
  const event = {
    ...eventWithTwoTrinkets,
    choices: [
      { label: "A", effects: [{ kind: "gainRandomTrinket" as const }] },
      { label: "B", effects: [{ kind: "gainRandomTrinket" as const }] },
    ],
  };
  const owned = trinketLibrary.filter((entry) => entry.id !== "bone-charm").map((entry) => entry.id);
  const resolved = resolveMysteryEventTrinkets(event, owned, () => 0);
  expect(trinketIdsOn(resolved)).toEqual(["bone-charm", "bone-charm"]);
});

it("offers the same named trinket in every choice that names it", () => {
  const event = {
    ...eventWithTwoTrinkets,
    choices: [
      { label: "A", effects: [{ kind: "gainTrinket" as const, trinketId: "bone-charm" }] },
      { label: "B", effects: [{ kind: "gainTrinket" as const, trinketId: "bone-charm" }] },
    ],
  };
  const resolved = resolveMysteryEventTrinkets(event, [], () => 0);
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
  expect(resolveMysteryEventTrinkets(event, [], () => 0).choices[0]?.effects[1]).toMatchObject({
    kind: "gainGeneratedGear",
    astral: true,
  });
});

it("reserves a later named Boon before rolling an earlier random grant", () => {
  const event = {
    ...eventWithTwoTrinkets,
    choices: [
      {
        label: "A",
        effects: [
          { kind: "gainRandomTrinket" as const, fromIds: ["bone-charm"] },
          { kind: "gainTrinket" as const, trinketId: "bone-charm" },
        ],
      },
    ],
  };
  const owned = trinketLibrary
    .filter((entry) => entry.id !== "bone-charm" && entry.id !== "sin-eaters-lantern")
    .map((entry) => entry.id);
  const early = { depth: 1, highestCompletedDifficulty: null };

  expect(isMysteryLootEligible(event, early, owned)).toBe(true);
  expect(resolveMysteryEventTrinkets(event, owned, () => 0).choices[0]?.effects).toEqual([
    { kind: "gainTrinket", trinketId: "sin-eaters-lantern" },
    { kind: "gainTrinket", trinketId: "bone-charm" },
  ]);
  expect(isMysteryLootEligible(event, early, [...owned, "sin-eaters-lantern"])).toBe(false);
});
