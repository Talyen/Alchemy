import { describe, expect, it, vi } from "vitest";
import { createChoiceCatalog } from "@/app/playthrough/choice-catalog";

describe("playthrough choice catalog", () => {
  it("keeps distinct replay identities even when their text contains separators", () => {
    const catalog = createChoiceCatalog();
    const first = vi.fn();
    const second = vi.fn();
    const choices = catalog.beginObservation();
    catalog.offer("a:b", "c", 1, first);
    catalog.offer("a", "b:c", 1, second);

    catalog.execute(choices[0]!);
    catalog.execute(choices[1]!);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("rejects duplicate offers and actions absent from the current observation", () => {
    const catalog = createChoiceCatalog();
    const choices = catalog.beginObservation();
    catalog.offer("play", "card", 2, () => {}, 0);
    expect(() => catalog.offer("play", "card", 3, () => {}, 0)).toThrow("Duplicate playthrough choice");
    expect(choices).toHaveLength(1);

    catalog.beginObservation();
    expect(() => catalog.execute(choices[0]!)).toThrow("Replay choice unavailable");
  });
});
