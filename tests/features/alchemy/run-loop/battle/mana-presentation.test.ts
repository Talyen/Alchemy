import { describe, expect, it } from "vitest";
import { projectMana } from "@/features/alchemy/run-loop/battle/mana-presentation";

describe("mana dock resource projection", () => {
  it("centers owned gems and includes temporary mana in the strip", () => {
    const bonus = projectMana(null, 5, 3);
    expect(bonus.gems).toHaveLength(5);
    expect(bonus.gems.every((gem) => gem.filled && gem.effect === null)).toBe(true);
  });
  it("caps visible crystals without losing current, capacity, or overflow totals", () => {
    const state = projectMana(null, 14, 17);
    expect(state.gems).toHaveLength(9);
    expect(state.hidden).toBe(8);
    expect([state.mana, state.maxMana]).toEqual([14, 17]);
    expect(projectMana(state, 2, 4).hidden).toBe(0);
  });
  it("spending empties owned gems while disappearing bonus mana only fades", () => {
    const state = projectMana(projectMana(null, 7, 5), 4, 5);
    expect(state.gems).toHaveLength(5);
    expect(state.gems[4]?.effect).toBe("spend");
    expect(state.exits.map((exit) => exit.kind)).toEqual(["fade", "fade"]);
  });
  it("shatters only permanent crystals when capacity loss clamps current mana", () => {
    const state = projectMana(projectMana(null, 8, 6), 4, 4);
    expect(state.exits.map((exit) => [exit.index, exit.kind])).toEqual([
      [4, "destroy"],
      [5, "destroy"],
      [6, "fade"],
      [7, "fade"],
    ]);
    expect(state.gems.every((gem) => gem.filled)).toBe(true);
    expect(state.exits.every((exit) => exit.height === projectMana(null, 8, 6).height)).toBe(true);
    expect(state.exits[0]?.y).toBe(projectMana(null, 8, 6).gems[4]?.y);
  });
  it("distinguishes capacity gains from refills and preserves unchanged effect identities", () => {
    const initial = projectMana(null, 2, 4);
    const refill = projectMana(initial, 3, 4);
    expect(refill.gems[2]?.effect).toBe("fill");
    expect(refill.gems[0]?.token).toBe(initial.gems[0]?.token);
    const gain = projectMana(refill, 4, 5);
    expect(gain.gems[4]?.effect).toBe("gain");
    expect(gain.gems[3]?.effect).toBe("fill");
    const promoted = projectMana(projectMana(null, 6, 4), 7, 5);
    expect(promoted.gems[4]?.effect).toBe("gain");
    expect(promoted.gems[5]?.effect).toBeNull();
  });
  it("removes an old exit when its position is rapidly regained and settles without motion", () => {
    const loss = projectMana(projectMana(null, 5, 5), 4, 4);
    expect(loss.exits).toHaveLength(1);
    const regain = projectMana(loss, 5, 5);
    expect(regain.exits).toHaveLength(0);
    expect(regain.gems[4]?.effect).toBe("gain");
    const settled = projectMana(regain, 1, 1, false);
    expect(settled.exits).toHaveLength(0);
    expect(settled.gems[0]?.effect).toBeNull();
  });
});
