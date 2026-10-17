import { describe, expect, it, vi } from "vitest";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { cardById, companionLibrary, type BattleCard, type KeywordId } from "@/lib/game-data";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function ray(keyword: KeywordId): BattleCard {
  const card = cardById["ray-of-frost"]!;
  return getTransmutationVariants(card, keyword, [card])[0]!.result;
}

function inspect(card: BattleCard, patch: BattleStatePatch, expected: number[]) {
  const rng = vi.fn(() => 0.99);
  const state = patchBattleState({
    hand: [card],
    mana: 10,
    maxMana: 10,
    enemyHealth: 999,
    enemyMaxHealth: 999,
    playerHealth: 30,
    playerMaxHealth: 40,
    ...patch,
    rng,
  });
  const before = JSON.stringify({ card, state });
  const preview = getBattleDamageInspectionCard(card, state);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify({ card, state })).toBe(before);
  const actual = playBattleCardResolved(state, card.id, 0);
  const projected = preview.effects.flatMap((effect) => (effect.kind === "damage" ? [effect.amount] : []));
  return { projected, actual, expected };
}

describe("damage inspection includes guaranteed reactions", () => {
  it.each([
    ["combustion", "burn"],
    ["hemorrhage", "bleed"],
  ] as const)("%s detonates existing buildup even when Block prevents its direct hit", (id, status) => {
    const card = getCorruptionMutationGroups(cardById[id]!)
      .find((group) => group.kind === "secondary")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "poison"),
      )!.card;
    const result = inspect(
      card,
      { enemyHealth: 3, enemyMaxHealth: 100, enemyMitigation: { block: 10 }, enemyStatuses: { [status]: 4 } },
      [],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(
      result.actual.combatTexts.some(
        (text) => text.target === "enemy" && text.kind === "damage" && text.stat === "poison",
      ),
    ).toBe(false);
    expect(result.projected.at(-1)).toBe(0);
  });

  it("enemy Thorns can change Unrelenting before a second Physical hit", () => {
    const result = inspect(
      ray("physical"),
      {
        playerHealth: 21,
        enemyStatuses: { thorns: 2 },
        currentEnemy: { traits: [{ id: "thornhide", title: "Thornhide", description: "" }] },
        talentEffects: { physicalDoubledBelowHalfHealth: true },
      },
      [1, 2],
    );
    expect(result.actual.state.playerHealth).toBe(19);
    expect(result.actual.state.enemyHealth).toBe(996);
    expect(result.projected).toEqual(result.expected);
  });

  it("Frostfire defeats the enemy before Ray of Frost's second hit", () => {
    const result = inspect(
      cardById["ray-of-frost"]!,
      {
        enemyHealth: 2,
        enemyMaxHealth: 100,
        enemyStatuses: { burn: 1, freeze: 1 },
      },
      [1, 0],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(result.actual.combatTexts.some((event) => "reactionId" in event && event.reactionId === "frostfire")).toBe(
      true,
    );
    expect(result.projected).toEqual(result.expected);
  });

  it("Purge's Holy reward can defeat the target before later card packets", () => {
    const result = inspect(
      ray("holy"),
      {
        enemyHealth: 3,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 1 },
        gearEffects: { attackPurgeOncePerTurn: 1, holyOnPurge: 2 },
      },
      [1, 0],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(result.projected).toEqual(result.expected);
  });

  it("Golden Verdict Stuns on the first Holy hit and enables Exploit Weakness", () => {
    const result = inspect(
      ray("holy"),
      {
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { stun: 49 },
        gearEffects: { holyStunBuildupGold: 1 },
        talentEffects: { stunDoubleDamage: true },
      },
      [1, 2],
    );
    expect(result.actual.state.enemyHealth).toBe(97);
    expect(result.actual.state.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(result.projected).toEqual(result.expected);
  });

  it("Icy Heart can finish the enemy before the next Freeze packet", () => {
    const result = inspect(
      cardById["ray-of-frost"]!,
      {
        enemyHealth: 5,
        enemyMaxHealth: 100,
        enemyStatuses: { freeze: 100 },
        trinketEffects: { frozenHeartDamage: 6 },
      },
      [1, 0],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(result.projected).toEqual(result.expected);
  });

  it("Thunderstone can finish the enemy before the next Stun packet", () => {
    const result = inspect(
      ray("stun"),
      {
        enemyHealth: 5,
        enemyMaxHealth: 100,
        enemyStatuses: { stun: 100 },
        trinketEffects: { thunderstoneDamageOnStun: 6 },
      },
      [1, 0],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(result.projected).toEqual(result.expected);
  });

  it("Pack Tactics lets Pixie heal before a corrupted Burn hit checks Bleeding Out", () => {
    const card = getCorruptionMutationGroups(cardById["pack-tactics"]!)
      .find((group) => group.kind === "secondary")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "burn"),
      )!.card;
    const result = inspect(
      card,
      {
        playerHealth: 19,
        activeCompanion: companionLibrary.pixie,
        talentEffects: { bleedDesperateMultiplier: 1.25 },
        gearEffects: { sharedBurnBleedBonuses: 1, flatBurnDamage: 4 },
      },
      [5],
    );
    expect(result.actual.state.playerHealth).toBeGreaterThanOrEqual(20);
    expect(result.actual.state.enemyHealth).toBe(994);
    expect(result.projected).toEqual(result.expected);
  });

  it("Wildheart's guaranteed critical can defeat the target before corrupted secondary damage", () => {
    const card = getCorruptionMutationGroups(cardById["lightning-bolt"]!)
      .find((group) => group.kind === "secondary")!
      .mutations.find(({ card }) =>
        card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "burn"),
      )!.card;
    const result = inspect(
      card,
      {
        enemyHealth: 8,
        enemyMaxHealth: 100,
        gearEffects: { dodgeReadiesNatureCrit: 1 },
        uniqueGear: { wildheartReady: true },
      },
      [4, 0],
    );
    expect(result.actual.state.enemyHealth).toBe(0);
    expect(result.projected).toEqual(result.expected);
  });
});
