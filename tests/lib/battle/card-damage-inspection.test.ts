import { describe, expect, it, vi } from "vitest";
import { effectsCard } from "@/lib/game-data/cards/card-builders";
import {
  cardById,
  cardMagnitude,
  enemyById,
  getEnemyAbilities,
  getEnemyAbilityCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { getBattleCardDescriptionInspection, inspectBattleCardOutcomes } from "@/lib/battle/card-damage-inspection";
import type { CombatTextEvent } from "@/lib/battle";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { inspectedDamage } from "../../fixtures/inspection";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const hit = (amount = 6): BattleCardEffect => ({ kind: "damage", damageType: "physical", amount });

describe("rule-preserving tooltip inspection", () => {
  it("inspects a failure-only Chance effect without rebuilding its authored description", () => {
    const card = effectsCard(
      "failure-only",
      [{ kind: "chance", probability: 0, successEffects: [], failureEffects: [hit()] }],
      {
        art: "",
        describe: () => [
          {
            role: "effect",
            parts: [
              "Otherwise deal ",
              cardMagnitude({ effectIndex: 0, effectPath: [0], kind: "damage", field: "amount" }),
              " Physical damage",
            ],
          },
        ],
      },
    );
    const state = patchBattleState({ hand: [card], flags: { nextHitPhysicalBonus: 4 } });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Otherwise deal 10 Physical damage",
    ]);
    expect(playBattleCardResolved(state, card.id, 0).state.enemyHealth).toBe(state.enemyHealth - 10);
  });

  it.each([0, 9])("inlines the direct12Block grant without including %i existing Block or proc rewards", (block) => {
    const card = cardById.block!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      mana: 4,
      maxMana: 4,
      currentEnemy: enemyById["blood-countess"],
      playerHealth: 31,
      playerMaxHealth: 47,
      enemyHealth: 273,
      enemyMaxHealth: 528,
      turn: 15,
      appliesFightPacing: true,
      playerStatuses: { block, forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 3 },
      rng,
    });
    const before = JSON.stringify({ state, card });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Gain 12 Block"]);
    expect(JSON.stringify({ state, card })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(played.state.playerStatuses.block).toBe(block + 12);
    expect(played.state.playerStatuses.thorns).toBe(3);
    expect(played.combatTexts).toContainEqual(
      expect.objectContaining({ stat: "block", amount: 12, feedback: "primary" }),
    );
  });

  it("adjusts Shield Bash's fixed Block without replacing its authored scaling rule", () => {
    const card = cardById["shield-bash"]!;
    const state = patchBattleState({
      playerStatuses: { block: 12, forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.descriptionLines).toEqual(["Gain 9 Block", "Spend half your Block to deal 31 Stun damage"]);
    expect(result.effects[1]).toEqual(card.effects[1]);
    expect(card.descriptionLines[0]).toBe("Gain 2 Block");
  });

  it("previews the paid Stun hit with canonical bonuses without consuming live state or RNG", () => {
    const card = cardById["shield-bash"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      appliesFightPacing: false,
      playerStatuses: { block: 12, forge: 20 },
      talentEffects: { forgeBlockPercent: 25, blockStunDamagePercent: 10 },
      gearEffects: { flatBlockGained: 2, flatStunDamage: 3 },
      rng,
    });
    const before = JSON.stringify({ card, state });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Gain 9 Block",
      "Spend half your Block to deal 35 Stun damage",
    ]);
    expect(JSON.stringify({ card, state })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const actual = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0).state;
    expect(actual.playerStatuses.block).toBe(10);
    expect(actual.enemyHealth).toBe(65);
  });

  it("uses ordered production resource changes before a later fixed grant", () => {
    const card = effectsCard(
      "forge-then-block",
      [
        { kind: "player-status", status: "forge", amount: 2 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
      { art: "" },
    );
    const state = patchBattleState({
      playerStatuses: { forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Gain 2 Forge", "Gain 13 Block"]);
  });

  it("previews adjusted healing power before its Health cap, excluding larger overheal conversions and Consume procs", () => {
    const card = cardById["health-potion"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      playerHealth: 49,
      playerMaxHealth: 50,
      talentEffects: { potionPotency: 2, healMultiplier: 1.5, overhealToBlockRatio: 1, healOnConsume: 7 },
      gearEffects: { flatBlockGained: 2 },
      rng,
    });
    const before = JSON.stringify({ card, state });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Restore 24 Health", "Consume"]);
    expect(JSON.stringify({ card, state })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(played.state.playerHealth).toBe(50);
    expect(played.state.playerStatuses.block).toBe(25);
    expect(played.combatTexts).toContainEqual(
      expect.objectContaining({ kind: "heal", amount: 24, feedback: "primary" }),
    );
  });

  it("inlines deterministic Mana and Gold grants without including their separate healing rewards", () => {
    const mana = cardById["mana-potion"]!;
    const state = patchBattleState({
      hand: [mana],
      mana: 1,
      maxMana: 10,
      talentEffects: { potionPotency: 2, healthPerMana: 3 },
      gearEffects: { blockOnManaRestoreWithoutBlock: 5 },
    });
    expect(getBattleCardDescriptionInspection(mana, state).descriptionLines).toEqual(["Gain 4 Mana", "Consume"]);
    const gold = effectsCard("gold-grant", [{ kind: "gain-gold", amount: 5 }], { art: "" });
    expect(
      getBattleCardDescriptionInspection(
        gold,
        patchBattleState({ gearEffects: { goldGainPercent: 20, healOnCombatGoldGain: 7 } }),
      ).descriptionLines,
    ).toEqual(["Gain 6 Gold"]);
  });

  it("uses known Armor and Forge bonuses without promising random extra grants", () => {
    const armor = cardById["stoneskin-potion"]!;
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 50,
      talentEffects: { potionPotency: 2, armorLowHealthBonusPercent: 50 },
      gearEffects: { flatArmorGained: 2 },
    });
    expect(getBattleCardDescriptionInspection(armor, state).descriptionLines).toEqual(["Gain 15 Armor", "Consume"]);
    expect(
      getBattleCardDescriptionInspection(armor, {
        ...state,
        talentEffects: { ...state.talentEffects, armorDoubleChance: 25 },
      }).descriptionLines,
    ).toEqual(["Gain 15 Armor", "Consume"]);
    const forge = cardById.anvil!;
    expect(
      getBattleCardDescriptionInspection(
        forge,
        patchBattleState({ talentEffects: { forgeBonusChance: 100 }, gearEffects: { blockOnForgeGain: 9 } }),
      ).descriptionLines,
    ).toEqual(["Gain 3 Forge"]);
  });

  it.each([
    { kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 },
    { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
    { kind: "player-status", status: "haste", amount: 1 },
  ] satisfies BattleCardEffect[])("keeps the authored $status formula or duration", (effect) => {
    const card = effectsCard("utility-rule", [effect], { art: "" });
    const result = getBattleCardDescriptionInspection(
      card,
      patchBattleState({
        playerStatuses: { forge: 20 },
        talentEffects: { forgeBlockPercent: 25 },
        gearEffects: { flatBlockGained: 2 },
      }),
    );
    expect(result.descriptionLines).toEqual(card.descriptionLines);
    expect(result.effects).toEqual(card.effects);
  });

  it("shows both known status-choice quantities and leaves the random choice unresolved", () => {
    const card = effectsCard(
      "utility-choice",
      [{ kind: "player-status", status: "armor", amount: 3, statusPool: ["block", "armor"] }],
      { art: "" },
    );
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      playerStatuses: { forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    const before = JSON.stringify({ card, state });
    const rng = vi.fn(() => {
      throw new Error("Preview sampled the live status choice");
    });
    const stateWithRng = { ...state, rng };
    expect(getBattleCardDescriptionInspection(card, stateWithRng).descriptionLines).toEqual([
      "Gain 10 Block or 3 Armor",
    ]);
    expect(rng).not.toHaveBeenCalled();
    const block = playBattleCardResolved({ ...state, rng: () => 0 }, card.id, 0).state;
    const armor = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0).state;
    expect(block.playerStatuses.block - state.playerStatuses.block).toBe(10);
    expect(block.playerStatuses.armor - state.playerStatuses.armor).toBe(0);
    expect(armor.playerStatuses.armor - state.playerStatuses.armor).toBe(3);
    expect(armor.playerStatuses.block - state.playerStatuses.block).toBe(0);
    expect(JSON.stringify({ card, state })).toBe(before);
  });

  it("retains an authored utility value when an earlier draw makes its result unknown", () => {
    const card = effectsCard(
      "draw-block",
      [
        { kind: "draw-cards", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
      { art: "" },
    );
    const state = patchBattleState({
      deck: [makeTestCard()],
      playerStatuses: { forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
    });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(card.descriptionLines);
  });

  it.each([0, 6, 20])("keeps Shield Bash's scaling rule at %i starting Block", (block) => {
    const card = cardById["shield-bash"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({ hand: [card], mana: 3, playerStatuses: { block }, rng });
    const before = JSON.stringify({ card, state });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.descriptionLines).toEqual([
      "Gain 2 Block",
      `Spend half your Block to deal ${Math.round((block + 2) / 2)} Stun damage`,
    ]);
    expect(result.effects.slice(0, card.effects.length)).toEqual(card.effects);
    expect(JSON.stringify({ card, state })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it("adjusts known gear and talent bonuses inside the original fixed-damage sentence", () => {
    const card = effectsCard("plain", [hit(3)], { art: "" });
    const state = patchBattleState({
      gearEffects: { flatPhysicalDamage: 1 },
      talentEffects: { flatPhysicalDamage: 1 },
    });
    expect(card.descriptionLines).toEqual(["Deal 3 Physical damage"]);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(card.effects).toEqual([hit(3)]);
  });

  it("excludes enemy defenses, Dodge and Critical outcomes from fixed attack numbers", () => {
    const card = effectsCard("plain", [hit(3)], { art: "" });
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      currentEnemy: enemyById["will-o-wisp"],
      gearEffects: { flatPhysicalDamage: 1 },
      talentEffects: { flatPhysicalDamage: 1 },
      enemyMitigation: { block: 50, armor: 20 },
      flags: { nextHitCrit: true },
      rng,
    });
    const before = JSON.stringify(state);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(JSON.stringify(state)).toBe(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "damage", damageType: "physical", amount: 0, equalToArmor: true },
    { kind: "damage", damageType: "stun", amount: 3, forgeBonusPercent: 50 },
  ] as const)("retains the complete $damageType scaling/conditional rule", (effect) => {
    const card = effectsCard("formula", [effect], { art: "" });
    const result = getBattleCardDescriptionInspection(
      card,
      patchBattleState({
        playerStatuses: { armor: 8, forge: 6 },
        enemyCC: { freezeSkipTurns: 1 },
        enemyStatuses: { bleed: 2 },
      }),
    );
    expect(result.descriptionLines).toEqual(
      "forgeBonusPercent" in effect ? [`${card.descriptionLines[0]} (6 total)`] : card.descriptionLines,
    );
    expect(result.effects[0]).toEqual(effect);
  });

  it.each([
    [0, 1],
    [4, 3],
    [5, 4],
    [10, 6],
    [11, 7],
    [14, 8],
  ])("keeps Burning Blade's formula and shows its known total at %i Forge", (forge, total) => {
    const card = cardById["burning-blade"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({ hand: [card], playerStatuses: { forge }, rng });
    const before = JSON.stringify({ state, card });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.descriptionLines).toEqual([`Deal 1 Burn damage, increased by half your Forge (${total} total)`]);
    expect(result.effects[0]).toEqual(card.effects[0]);
    expect(JSON.stringify({ state, card })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(played.state.enemyHealth).toBe(state.enemyHealth - total);
  });

  it("includes known Burn bonuses once without adding Ignite twice or predicting a Critical", () => {
    const card = cardById["burning-blade"]!;
    const state = patchBattleState({
      playerStatuses: { forge: 11 },
      talentEffects: { forgeBurnDamagePercent: 25 },
      gearEffects: { flatBurnDamage: 2 },
      flags: { nextHitCrit: true },
      enemyMitigation: { block: 20, armor: 20 },
    });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "Deal 1 Burn damage, increased by half your Forge (9 total)",
    ]);
    expect(card.descriptionLines).toEqual(["Deal 1 Burn damage, increased by half your Forge"]);
  });

  it("does not append triggered follow-ups or duplicate the original effect sentence", () => {
    const card = cardById.fireball!;
    const result = getBattleCardDescriptionInspection(card, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }));
    expect(result.descriptionLines).toEqual(card.descriptionLines);
    expect(result.effects).toEqual(card.effects);
  });

  it("keeps authored numbers when an unresolved draw can change the attack", () => {
    const card = effectsCard("draw-attack", [{ kind: "draw-cards", amount: 1 }, hit()], { art: "" });
    const result = getBattleCardDescriptionInspection(card, patchBattleState({ deck: [makeTestCard()] }));
    expect(result.descriptionLines).toEqual(card.descriptionLines);
  });

  it("splits shared clauses when their known magnitudes differ while retaining every effect", () => {
    const ray = cardById["ray-of-frost"]!;
    expect(
      getBattleCardDescriptionInspection(ray, patchBattleState({ gearEffects: { flatFreezeDamage: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal 3 Freeze damage twice"]);

    const doubleHit = effectsCard("double-hit", [hit(4), hit(4)], { art: "" });
    expect(
      getBattleCardDescriptionInspection(doubleHit, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }))
        .descriptionLines,
    ).toEqual(["Deal 8 Physical damage", "Deal 4 Physical damage"]);

    for (const id of ["earthquake", "blizzard"] as const) {
      const card = cardById[id]!;
      const result = getBattleCardDescriptionInspection(
        card,
        patchBattleState({ playerStatuses: { forge: 4 }, gearEffects: { flatFreezeDamage: 2 } }),
      );
      expect(result.descriptionLines).toEqual(
        id === "earthquake"
          ? ["Deal 6 Stun damage", "Deal 2 Stun damage next turn"]
          : ["Deal 4 Freeze damage", "Deal 2 Freeze damage next turn"],
      );
    }

    const dealAndReceive = effectsCard(
      "reckless",
      [
        { kind: "damage", damageType: "burn", amount: 3 },
        { kind: "self-damage", damageType: "burn", amount: 3 },
      ],
      { art: "" },
    );
    expect(
      getBattleCardDescriptionInspection(dealAndReceive, patchBattleState({ talentEffects: { flatBurnDamage: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal 5 Burn damage", "Take 3 Burn damage"]);
  });
});

describe("battle damage inspection", () => {
  it("shows offensive power before defenses and crits without consuming state or RNG", () => {
    const rng = vi.fn(() => {
      throw new Error("inspection rolled");
    });
    const state = patchBattleState({
      rng,
      currentEnemy: enemyById["will-o-wisp"],
      playerStatuses: { forge: 3 },
      gearEffects: { flatPhysicalDamage: 2 },
      flags: { nextHitPhysicalBonus: 4, nextHitCrit: true },
      enemyMitigation: { block: 50, armor: 20 },
    });
    const card = makeTestCard({ effects: [hit()] });
    const before = JSON.stringify({ state, card });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 15 Physical damage"]);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 15 Physical damage"]);
    expect(rng).not.toHaveBeenCalled();
    expect(JSON.stringify({ state, card })).toBe(before);
  });

  it("uses prepared poison's damage type and bonuses, preserving the real preparation", () => {
    const state = patchBattleState({
      flags: { nextHitPoison: true },
      playerStatuses: { forge: 10 },
      gearEffects: { flatPoisonDamage: 2 },
    });
    expect(state.flags.nextHitPoison).toBe(true);
    expect(getBattleCardDescriptionInspection(makeTestCard({ effects: [hit()] }), state).descriptionLines).toEqual([
      "Deal 8 Poison damage",
    ]);
    expect(
      getBattleCardDescriptionInspection(
        makeTestCard({
          effects: [
            { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] },
          ],
        }),
        state,
      ).descriptionLines,
    ).toEqual(["Deal 3–6 Poison damage"]);
  });

  it.each([
    "frostbolt",
    "blessed-aegis",
    "burning-blade",
    "ray-of-frost",
    "fireball",
    "stab",
    "sunburst",
    "holy-radiance",
    "acid-potion",
  ])("matches actual noncritical damage for %s with resource bonuses and pacing", (id) => {
    const card = cardById[id]!;
    expect(card).toBeDefined();
    const state = patchBattleState({
      rng: () => 0.99,
      currentEnemy: { ...enemyById["blood-countess"], traits: [] },
      enemyHealth: 999,
      enemyMaxHealth: 999,
      playerHealth: 100,
      playerMaxHealth: 100,
      mana: 8,
      maxMana: 8,
      hand: [card],
      appliesFightPacing: true,
      turn: 13,
      playerStatuses: { forge: 3, block: 5 },
      talentEffects: { freezeDamagePerMana: 100 },
    });
    const outcomes = inspectBattleCardOutcomes(card, battleSnapshot(state));
    const projected = card.effects.flatMap((effect, index) => {
      if (effect.kind !== "damage") return [];
      const outcome = outcomes.get(String(index));
      return outcome?.kind === "exact" ? outcome.packets.map((packet) => packet.amount) : [];
    });
    const result = playBattleCardResolved(state, card.id, 0);
    const damage = result.combatTexts
      .filter(
        (text) => text.target === "enemy" && text.kind === "damage" && text.stat !== "armor" && text.stat !== "block",
      )
      .map((text) => ("amount" in text ? text.amount : 0));
    expect(
      projected.reduce((a, b) => a + b, 0),
      JSON.stringify({ outcomes: [...outcomes], texts: result.combatTexts }),
    ).toEqual(damage.reduce((a, b) => a + b, 0));
  });

  it("separates repeated hits when a prepared bonus applies only once", () => {
    const state = patchBattleState({ flags: { nextHitPhysicalBonus: 4 } });
    const card = makeTestCard({ effects: [hit(), hit()] });
    const outcomes = inspectBattleCardOutcomes(card, state);
    expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([10, 6]);
  });

  it("does not invent negative Block when inspecting an unaffordable Freeze card", () => {
    const card = makeTestCard({
      cost: 2,
      effects: [{ kind: "damage", damageType: "freeze", amount: 1 }, hit()],
    });
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 1 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { blockToPhysicalDamageMultiplier: 1 },
    });
    const outcomes = inspectBattleCardOutcomes(card, state);
    expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([1, 6]);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(state.playerStatuses.block).toBe(1);
  });

  it("resolves current conditional damage and keeps random alternatives as a range", () => {
    const state = patchBattleState({ playerStatuses: { forge: 4 }, enemyCC: { freezeSkipTurns: 1 } });
    const card = makeTestCard({
      effects: [
        {
          kind: "damage",
          damageType: "physical",
          amount: 3,
          damageTypeIfTargetFrozen: "freeze",
          amountIfTargetFrozen: 8,
        },
        { kind: "random-damage", minAmount: 2, maxAmount: 5, damageTypePool: ["physical", "poison"] },
      ],
    });
    const outcomes = inspectBattleCardOutcomes(card, state);
    expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([8, [2, 9]]);
  });

  it("adjusts both chance branches without choosing one or changing utility descriptions", () => {
    const state = patchBattleState({ playerStatuses: { forge: 3 } });
    const card = makeTestCard({
      effects: [
        { kind: "chance", probability: 0.5, successEffects: [hit()], failureEffects: [{ kind: "heal", amount: 2 }] },
      ],
    });
    expect(inspectedDamage(inspectBattleCardOutcomes(card, state).get("0.0"))).toBe(9);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual([
      "50% chance: Deal 9 Physical damage",
      "Otherwise: Restore 2 Health",
    ]);
  });

  it.each(["frostwarden", "dire-wolf", "stone-golem", "bandit", "hellhound"])(
    "matches %s's live offensive stage without borrowing hero bonuses",
    (id) => {
      const enemy = enemyById[id]!;
      for (const card of getEnemyAbilities(enemy)) {
        if (
          card.effects.some((effect) => effect.kind === "chance" || (effect.kind === "damage" && effect.damageTypePool))
        )
          continue;
        const state = patchBattleState({
          rng: () => 0.99,
          currentEnemy: enemy,
          enemyHealth: 999,
          enemyMaxHealth: 999,
          playerHealth: 999,
          playerMaxHealth: 999,
          roomScalingMultiplier: 2.2,
          playerStatuses: { burn: 2, bleed: 2, forge: 90 },
          enemyMitigation: { forge: 3, block: 8 },
          appliesFightPacing: true,
          turn: 13,
          gearEffects: { flatPhysicalDamage: 90, flatFreezeDamage: 90 },
        });
        const outcomes = inspectBattleCardOutcomes(card, battleSnapshot(state), "enemy");
        const projected = card.effects.flatMap((effect, index) => {
          if (effect.kind !== "damage") return [];
          const outcome = outcomes.get(String(index));
          return outcome?.kind === "exact" ? outcome.packets.map((packet) => packet.amount) : [];
        });
        const texts: CombatTextEvent[] = [];
        const result = applyEnemyAbility(state, card, texts);
        expect(state.playerHealth - result.playerHealth, JSON.stringify({ card, outcomes: [...outcomes], texts })).toBe(
          projected.reduce((a, b) => a + b, 0),
        );
      }
    },
  );

  it("spends a known preparation once across random damage without selecting an outcome", () => {
    const state = patchBattleState({
      flags: { nextHitPoison: true },
      playerStatuses: { forge: 4 },
      gearEffects: { flatPoisonDamage: 2 },
    });
    const card = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["physical", "poison"] }, hit()],
    });
    const outcomes = inspectBattleCardOutcomes(card, state);
    expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([[3, 5], 10]);
    const zero = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }, hit()] });
    const zeroOutcomes = inspectBattleCardOutcomes(zero, patchBattleState({ flags: { nextHitPoison: true } }));
    expect(["0", "1"].map((key) => inspectedDamage(zeroOutcomes.get(key)))).toEqual([0, 6]);
    expect(state.flags.nextHitPoison).toBe(true);
  });

  it("applies Bandit's opening bonus to the first packet rather than every hit", () => {
    const state = patchBattleState({ currentEnemy: enemyById.bandit });
    const card = { ...getEnemyAbilityCard("slash"), effects: [hit(4), hit(4)] };
    const outcomes = inspectBattleCardOutcomes(card, state, "enemy");
    expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([10, 5]);
    expect(state.flags.enemyFirstHitDoubleUsed).toBe(false);
  });

  it("observes Exorcism's current conversion damage without consuming its status", () => {
    const state = patchBattleState({ playerStatuses: { burn: 4 }, playerHealth: 30, playerMaxHealth: 30 });
    expect(inspectedDamage(inspectBattleCardOutcomes(cardById.exorcism!, state).get("1"))).toBe(5);
    expect(state.playerStatuses.burn).toBe(4);
  });

  it("inspects the catalog without rolling RNG or modifying its definitions", () => {
    const state = battleSnapshot(
      patchBattleState({ playerStatuses: { forge: 4, block: 6, armor: 3 }, mana: 7, maxMana: 7 }),
    );
    const before = JSON.stringify(cardById);
    for (const card of Object.values(cardById)) {
      expect(() => inspectBattleCardOutcomes(card, state), card.id).not.toThrow();
      expect(() => getBattleCardDescriptionInspection(card, state), card.id).not.toThrow();
    }
    expect(JSON.stringify(cardById)).toBe(before);
  });

  it("includes flat Glacial Surge and ignores the hero's mitigation", () => {
    const state = patchBattleState({
      currentEnemy: enemyById.frostwarden,
      playerStatuses: { block: 50, armor: 50 },
      gearEffects: { resistFreeze: 100 },
    });
    const card = getEnemyAbilityCard("frostbolt");
    const base = inspectBattleCardOutcomes(
      card,
      { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
      "enemy",
    );
    const frost = inspectBattleCardOutcomes(card, state, "enemy");
    expect(inspectedDamage(frost.get("0"))).toBe((inspectedDamage(base.get("0")) as number) + 1);
  });

  it("projects guaranteed hit reactions, Opening follow-ups, and target defeat across multi-packet cards", () => {
    const fireball = cardById.fireball!;
    const openingState = patchBattleState({
      hand: [fireball],
      rng: () => 0.99,
      flags: { nextHitPhysicalBonus: 4 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
    });
    expect(inspectBattleCardOutcomes(fireball, openingState).get("0")).toMatchObject({
      kind: "exact",
      packets: [
        { damageType: "burn", amount: 2 },
        { damageType: "physical", amount: 4 },
      ],
    });
    expect(playBattleCardResolved(openingState, fireball.id, 0).state.enemyHealth).toBe(94);

    // Guaranteed Emberforged Forge and Elemental Mana on an opening Burn hit scale subsequent packets.
    const burnThenFollowUps = makeTestCard({
      effects: [
        { kind: "damage", damageType: "burn", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    const emberState = patchBattleState({
      hand: [burnThenFollowUps],
      rng: () => 0.99,
      mana: 1,
      maxMana: 4,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      gearEffects: { forgeOnBurnVsUnburnedChances: [100], elementalDamageManaChance: 100 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const emberOutcomes = inspectBattleCardOutcomes(burnThenFollowUps, emberState);
    const emberPlayed = playBattleCardResolved(emberState, burnThenFollowUps.id, 0);
    expect(["0", "1", "2"].map((key) => inspectedDamage(emberOutcomes.get(key)))).toEqual([2, 3, 3]);
    expect(emberPlayed.state.enemyHealth).toBe(92);

    // Frostfire reaction killing the target zeroes out later packets.
    const ray = cardById["ray-of-frost"]!;
    const frostfireState = patchBattleState({
      hand: [ray],
      rng: () => 0.99,
      enemyHealth: 2,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 1, freeze: 1 },
    });
    const frostfireOutcomes = inspectBattleCardOutcomes(ray, frostfireState);
    expect(["0", "1"].map((key) => inspectedDamage(frostfireOutcomes.get(key)))).toEqual([1, 0]);
    expect(playBattleCardResolved(frostfireState, ray.id, 0).state.enemyHealth).toBe(0);

    // Detonation consumes existing buildup even when Block absorbs the direct hit.
    for (const [id, status, detonateFlag] of [
      ["combustion", "burn", { detonateAllBurn: true }],
      ["hemorrhage", "bleed", { detonateAllBleed: true }],
    ] as const) {
      const detonateCard = makeTestCard({
        id,
        effects: [
          { kind: "damage", damageType: status, amount: 2, ...detonateFlag },
          { kind: "damage", damageType: "poison", amount: 3 },
        ],
      });
      const detonateState = patchBattleState({
        hand: [detonateCard],
        rng: () => 0.99,
        enemyHealth: 3,
        enemyMaxHealth: 100,
        enemyMitigation: { block: 10 },
        enemyStatuses: { [status]: 4 },
      });
      const outcomes = inspectBattleCardOutcomes(detonateCard, detonateState);
      expect(["0", "1"].map((key) => inspectedDamage(outcomes.get(key)))).toEqual([2, 0]);
      expect(playBattleCardResolved(detonateState, detonateCard.id, 0).state.enemyHealth).toBe(0);
    }
  });
});
