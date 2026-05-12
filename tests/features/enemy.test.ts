import { describe, expect, it } from "vitest";
import { formatEnemyAttackLines } from "@/features/alchemy/utils";
import { enemyBestiary } from "@/lib/game-data";
import type { EnemyAttackEffect } from "@/lib/game-data";

describe("formatEnemyAttackLines", () => {
  it("returns fallback for empty effects", () => {
    expect(formatEnemyAttackLines([])).toEqual(["Deals Physical damage"]);
  });

  it("formats pure physical damage", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "damage", damageType: "physical", amount: 8 }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Physical damage"]);
  });

  it("formats physical damage with lifesteal", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "damage", damageType: "physical", amount: 2, lifesteal: true }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Physical damage", "Leech"]);
  });

  it("formats a single status effect", () => {
    const effects: EnemyAttackEffect[] = [{ kind: "player-status", status: "burn", amount: 2 }];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Burn damage"]);
  });

  it("formats two status effects combined", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "player-status", status: "stun", amount: 2 },
      { kind: "player-status", status: "poison", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Stun and Poison"]);
  });

  it("formats three status effects", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "player-status", status: "burn", amount: 1 },
      { kind: "player-status", status: "poison", amount: 1 },
      { kind: "player-status", status: "freeze", amount: 1 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Burn, Poison and Freeze"]);
  });

  it("formats mixed damage + status as separate lines", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 3 },
      { kind: "player-status", status: "burn", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Physical damage", "Deals Burn damage"]);
  });

  it("formats mixed damage (with lifesteal) + status", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 2, lifesteal: true },
      { kind: "player-status", status: "bleed", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Physical damage", "Leech", "Deals Bleed damage"]);
  });

  it("formats damage + two statuses as separate lines", () => {
    const effects: EnemyAttackEffect[] = [
      { kind: "damage", damageType: "physical", amount: 5 },
      { kind: "player-status", status: "poison", amount: 2 },
      { kind: "player-status", status: "freeze", amount: 2 },
    ];
    expect(formatEnemyAttackLines(effects)).toEqual(["Deals Physical damage", "Deals Poison damage", "Deals Freeze damage"]);
  });
});

describe("enemyBestiary attack lines integration", () => {
  function getAttackLines(id: string): string[] {
    const entry = enemyBestiary.find((e) => e.id === id);
    if (!entry) throw new Error(`Enemy ${id} not found`);
    return formatEnemyAttackLines(entry.attackEffects);
  }

  it("Skeleton — pure physical", () => {
    expect(getAttackLines("skeleton")).toEqual(["Deals Physical damage"]);
  });

  it("Goblin — pure physical", () => {
    expect(getAttackLines("goblin")).toEqual(["Deals Physical damage"]);
  });

  it("Imp — pure Burn", () => {
    expect(getAttackLines("imp")).toEqual(["Deals Burn damage"]);
  });

  it("Lizard Scout — pure Poison", () => {
    expect(getAttackLines("lizard-scout")).toEqual(["Deals Poison damage"]);
  });

  it("Mimic — pure physical", () => {
    expect(getAttackLines("mimic")).toEqual(["Deals Physical damage"]);
  });

  it("Mud Elemental — Stun and Poison combined", () => {
    expect(getAttackLines("mud-elemental")).toEqual(["Deals Stun and Poison"]);
  });

  it("Necromancer — pure Bleed", () => {
    expect(getAttackLines("necromancer")).toEqual(["Deals Bleed damage"]);
  });

  it("Plague Doctor — pure Poison", () => {
    expect(getAttackLines("plague-doctor")).toEqual(["Deals Poison damage"]);
  });

  it("Warden of the Ashen Gate — physical + burn", () => {
    expect(getAttackLines("act-i-boss")).toEqual(["Deals Physical damage", "Deals Burn damage"]);
  });

  it("The Hollow Knight — physical + bleed", () => {
    expect(getAttackLines("act-ii-boss")).toEqual(["Deals Physical damage", "Deals Bleed damage"]);
  });

  it("The Primordial Wyrm — physical + poison + freeze", () => {
    expect(getAttackLines("act-iii-boss")).toEqual(["Deals Physical damage", "Deals Poison damage", "Deals Freeze damage"]);
  });
});
