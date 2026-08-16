import { describe, expect, it } from "vitest";
import { trinketLibrary } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import {
  applyResolvedMysteryTrinketIds,
  collectResolvedMysteryTrinketIds,
  repairUnresolvedMysteryTrinkets,
  resolveMysteryEventTrinkets,
} from "@/lib/mystery/resolve-trinkets";

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
    const event = {
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
    const resolved = resolveMysteryEventTrinkets(event, [], () => 0);
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
