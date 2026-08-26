import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { findMysteryEvent } from "@/lib/mystery";
import {
  applyResolvedMysteryTrinketIds,
  collectResolvedMysteryTrinketIds,
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

  it("replaces an owned specified trinket with a random unowned one", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["icy-heart"], () => 0);
    const charm = resolved.choices.find((choice) => choice.label === "Take the Charm");
    const trinket = charm?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(trinket.trinketId).not.toBe("icy-heart");
    expect(trinketLibrary.some((entry) => entry.id === trinket.trinketId)).toBe(true);
  });

  it("does not assign the same fallback trinket to two owned choices", () => {
    const event = findMysteryEvent("fairy-ring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["lucky-clover", "parasitic-bloom"], () => 0);
    const ids = trinketIdsOn(resolved);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids).not.toContain("lucky-clover");
    expect(ids).not.toContain("parasitic-bloom");
  });

  it("reserves a kept preferred trinket so a later random grant cannot reuse it", () => {
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, [], () => 0);
    const ids = trinketIdsOn(resolved);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("bone-charm");
    expect(ids[1]).not.toBe("bone-charm");
  });

  it("concretizes a random trinket from its pool when those ids are free", () => {
    const event = findMysteryEvent("overgrown-temple");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, [], () => 0);
    const search = resolved.choices.find((choice) => choice.label === "Search the Crypt");
    const trinket = search?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
  });

  it("falls back to any unowned trinket when a random pool is already owned", () => {
    const event = findMysteryEvent("overgrown-temple");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["bone-charm", "sin-eaters-lantern"], () => 0);
    const search = resolved.choices.find((choice) => choice.label === "Search the Crypt");
    const trinket = search?.effects.find((effect) => effect.kind === "gainTrinket");
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

describe("collect and apply resolved mystery trinket ids", () => {
  it("round-trips substitutions onto the pool event", () => {
    const event = findMysteryEvent("enchanted-spring");
    expect(event).not.toBeNull();
    const resolved = resolveMysteryEventTrinkets(event!, ["icy-heart"], () => 0);
    const ids = collectResolvedMysteryTrinketIds(resolved);
    const hydrated = applyResolvedMysteryTrinketIds(event!, ids);
    expect(hydrated.choices).toEqual(resolved.choices);
  });

  it("round-trips astral-gear fallback slots through the positional id contract", () => {
    const allOwned = trinketLibrary.map((entry) => entry.id);
    const resolved = resolveMysteryEventTrinkets(eventWithTwoTrinkets, allOwned, () => 0);
    const ids = collectResolvedMysteryTrinketIds(resolved);
    expect(ids).toEqual(["", ""]);
    const hydrated = applyResolvedMysteryTrinketIds(eventWithTwoTrinkets, ids);
    expect(hydrated.choices).toEqual(resolved.choices);
  });

  it("does not rewrite authored astral gear when applying resolved trinket ids", () => {
    const event = {
      id: "authored-astral",
      title: "Authored Astral",
      art: "test-art",
      narrative: "Test",
      choices: [
        {
          label: "A",
          effects: [
            { kind: "gainGeneratedGear" as const, baseItemId: "staff", astral: true as const },
            { kind: "gainTrinket" as const, trinketId: "icy-heart" },
          ],
        },
      ],
    };

    const hydrated = applyResolvedMysteryTrinketIds(event, ["merchants-favor"]);
    expect(hydrated.choices[0]?.effects[0]).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "staff",
      astral: true,
    });
    expect(hydrated.choices[0]?.effects[1]).toEqual({ kind: "gainTrinket", trinketId: "merchants-favor" });
  });

  it("repairs a legacy visit that still has gainRandomTrinket", () => {
    const event = findMysteryEvent("overgrown-temple");
    expect(event).not.toBeNull();
    const repaired = repairUnresolvedMysteryTrinkets(event!, [], () => 0);
    const search = repaired.choices.find((choice) => choice.label === "Search the Crypt");
    const trinket = search?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
  });
});
