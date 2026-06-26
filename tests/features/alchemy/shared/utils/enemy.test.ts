import { describe, expect, it } from "vitest";
import { formatEnemyAttackLines } from "@/features/alchemy/shared/utils";
import { enemyBestiary } from "@/lib/game-data";
import type { EnemyAttackEffect } from "@/lib/game-data";

describe("formatEnemyAttackLines", () => {
  it("returns fallback for empty effects", () => {
    expect(formatEnemyAttackLines([])).toEqual(["Deals Physical damage"]);
  });

  it("formats pure physical damage", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "damage", damageType: "physical", amount: 8 }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 8 Physical damage"]);
  });

  it("formats physical damage with lifesteal", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "damage", damageType: "physical", amount: 2, lifesteal: true }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 2 Physical damage", "Leech"]);
  });

  it("formats a single status effect", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "player-status", status: "burn", amount: 2 }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 2 Burn damage"]);
  });

  it("formats two status effects combined", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "player-status", status: "bleed", amount: 2 },
      { kind: "player-status", status: "poison", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 2 Bleed and 2 Poison"]);
  });

  it("formats three status effects", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "player-status", status: "burn", amount: 1 },
      { kind: "player-status", status: "poison", amount: 1 },
      { kind: "player-status", status: "bleed", amount: 1 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 1 Burn, 1 Poison and 1 Bleed"]);
  });

  it("formats single physical + single status as a combined line", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 3 },
      { kind: "player-status", status: "burn", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 3 Physical and 2 Burn"]);
  });

  it("formats mixed damage (with lifesteal) + status", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 2, lifesteal: true },
      { kind: "player-status", status: "bleed", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals 2 Physical damage", "Leech", "Deals 2 Bleed damage"]);
  });

  it("formats damage + two statuses as separate lines", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 5 },
      { kind: "player-status", status: "poison", amount: 2 },
      { kind: "player-status", status: "bleed", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual([
      "Deals 5 Physical damage",
      "Deals 2 Poison damage",
      "Deals 2 Bleed damage",
    ]);
  });
});

describe("enemyBestiary attack lines integration", () => {
  function getAttackLines(id: string): string[] {
    const entry = enemyBestiary.find((e) => e.id === id);
    if (!entry) throw new Error(`Enemy ${id} not found`);
    return formatEnemyAttackLines(entry.attackEffects);
  }

  it("authored enemies use damage effects for Stun and Freeze attacks", () => {
    const invalid = enemyBestiary.flatMap((enemy) =>
      enemy.attackEffects
        .filter(
          (effect): effect is Extract<EnemyAttackEffect, { kind: "player-status" }> =>
            effect.kind === "player-status" && (effect.status === "stun" || effect.status === "freeze"),
        )
        .map((effect) => `${enemy.id}:${effect.status}`),
    );
    expect(invalid).toEqual([]);
  });

  it("Skeleton — pure physical", () => {
    expect(getAttackLines("skeleton")).toEqual(["Deals 7 Physical damage"]);
  });

  it("Goblin — pure physical", () => {
    expect(getAttackLines("goblin")).toEqual(["Deals 7 Physical damage"]);
  });

  it("Imp — pure Burn", () => {
    expect(getAttackLines("imp")).toEqual(["Deals 3 Burn damage"]);
  });

  it("Lizard Scout — Physical + Poison", () => {
    expect(getAttackLines("lizard-scout")).toEqual(["Deals 2 Physical and 1 Poison"]);
  });

  it("Mimic — Physical + Bleed", () => {
    expect(getAttackLines("mimic")).toEqual(["Deals 7 Physical and 1 Bleed"]);
  });

  it("Mud Elemental — Nature and Poison combined", () => {
    expect(getAttackLines("mud-elemental")).toEqual(["Deals 2 Nature and 1 Poison"]);
  });

  it("Necromancer — pure Bleed", () => {
    expect(getAttackLines("necromancer")).toEqual(["Deals 4 Bleed damage"]);
  });

  it("Plague Doctor — Bleed + Poison", () => {
    expect(getAttackLines("plague-doctor")).toEqual(["Deals 2 Bleed and 1 Poison"]);
  });

  it("The Forge Golem — physical + stun combined", () => {
    expect(getAttackLines("forge-golem")).toEqual(["Deals 4 Physical and 1 Stun"]);
  });

  it("The Frostwarden — physical + freeze combined", () => {
    expect(getAttackLines("frostwarden")).toEqual(["Deals 6 Physical and 1 Freeze"]);
  });

  it("The Blight Treant — nature + poison combined", () => {
    expect(getAttackLines("blight-treant")).toEqual(["Deals 3 Nature and 1 Poison"]);
  });

  it("Living Armor — physical + nature combined", () => {
    expect(getAttackLines("living-armor")).toEqual(["Deals 3 Physical and 3 Nature"]);
  });

  it("The Iron Bear — physical and burn", () => {
    expect(getAttackLines("iron-bear")).toEqual(["Deals 3 Physical and 1 Burn"]);
  });
});
