import { describe, expect, it } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { defaultTalentEffects } from "@/lib/battle";
import { computeTalentEffects, enemyBestiary } from "@/lib/game-data";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { dealDamage, incomingPhysical, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultEnemyStatusValues, defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

describe("Nature and Physical Talent reworks", () => {
  it("Rupture recognizes critical Physical counterattacks", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 3 },
      talentEffects: { physicalDetonatesBleed: true },
      rng: () => 0.01,
    });
    const next = resolveFollowUpHit(state, { source: "player-follow-up", damageType: "physical", amount: 4 }, []);
    expect(next.enemyHealth).toBe(89);
    expect(next.enemyStatuses.bleed).toBe(0);
  });

  it("Sunder removes Armor using the Forge that powered the attack", () => {
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const state = patchBattleState({
      hand: [card],
      enemyMitigation: { armor: 8 },
      playerStatuses: { forge: 3 },
      talentEffects: { physicalStripArmorByForge: true },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerStatuses.forge).toBe(2);
    expect(next.enemyMitigation.armor).toBe(4);
  });

  it("repeats a Nature card's effects once while paying and consuming once", () => {
    const card = makeTestCard({
      id: "nature-repeat",
      tags: ["nature"],
      cost: 1,
      consume: true,
      effects: [{ kind: "damage", damageType: "nature", amount: 2 }],
    });
    const state = patchBattleState({
      hand: [card],
      mana: 1,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, natureCardPlayTwiceChance: 100, blockOnNatureCard: 1 },
    });

    const result = playBattleCardResolved(state, card.id, 0).state;

    expect(result.enemyHealth).toBe(96);
    expect(result.mana).toBe(0);
    expect(result.exhausted).toHaveLength(1);
    expect(result.playerStatuses.block).toBe(1);
  });

  it("applies Nature reward riders from resolved packet damage before Health overkill capping", () => {
    const card = makeTestCard({ tags: ["nature"] });
    const state = patchBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      enemyHealth: 2,
      enemyMaxHealth: 30,
      rng: () => 0.99,
      talentEffects: {
        ...defaultTalentEffects,
        armorOnNatureDamageChance: 100,
        thornsOnNatureDamageChance: 100,
        healOnNatureDamageChance: 100,
        natureBleedChance: 100,
        naturePoisonChance: 100,
      },
    });
    const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 5 };

    const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 5 }, []);

    expect(result.enemyHealth).toBe(0);
    expect(result.playerStatuses).toMatchObject({ armor: 5, thorns: 5 });
    expect(result.playerHealth).toBe(10);
    expect(result.enemyStatuses).toMatchObject({ bleed: 5, poison: 5 });
  });

  it("does not run Nature riders for a zero-damage packet", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ armor: 2, thorns: 3 }),
      talentEffects: {
        ...defaultTalentEffects,
        armorOnNatureDamageChance: 100,
        thornsOnNatureDamageChance: 100,
        healOnNatureDamageChance: 100,
        natureBleedChance: 100,
        naturePoisonChance: 100,
      },
    });
    const card = makeTestCard({ tags: ["nature"] });
    const effect = { kind: "damage" as const, damageType: "nature" as const, amount: 5 };

    const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 0 }, []);

    expect(result).toEqual(state);
  });

  it("uses half Block and half Armor for Physical damage", () => {
    const effect = { kind: "damage", damageType: "physical", amount: 4 } as const;
    const blockState = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      talentEffects: computeTalentEffects({ physical: ["physical-shield-bash"] }),
      rng: () => 0.99,
    });
    const armorState = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
      talentEffects: computeTalentEffects({ physical: ["physical-armored-fists"] }),
      rng: () => 0.99,
    });

    expect(computeCardDamageToEnemy(blockState, effect).modifiedDamage).toBe(7);
    expect(computeCardDamageToEnemy(armorState, effect).modifiedDamage).toBe(7);
  });

  it("applies Lacerate as direct Bleed instead of a secondary damage hit", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { ...computeTalentEffects({ physical: ["physical-lacerate"] }), physicalBleedChance: 100 },
    });
    const card = makeTestCard();
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };

    const result = resolvePlayerHit(state, { source: "card-attack", card, effect, resolvedDamage: 5 }, []);

    expect(result.enemyHealth).toBe(95);
    expect(result.enemyStatuses.bleed).toBe(5);
  });

  it("does not recursively roll Lacerate from a derived Physical hit", () => {
    const state = patchBattleState({
      rng: () => 0,
      talentEffects: { ...computeTalentEffects({ physical: ["physical-lacerate"] }), physicalBleedChance: 100 },
    });

    const result = resolveFollowUpHit(state, { source: "talent-derived", damageType: "physical", amount: 5 }, []);

    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("requires a Critical positive Physical hit for Rupture", () => {
    const card = makeTestCard();
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const talentEffects = computeTalentEffects({ physical: ["physical-hemorrhage"] });
    const bleeding = { bleed: 6 };

    const nonCritical = resolvePlayerHit(
      patchBattleState({ talentEffects, enemyStatuses: defaultEnemyStatusValues(bleeding) }),
      { source: "card-attack", card, effect, resolvedDamage: 5, critical: false },
      [],
    );
    const critical = resolvePlayerHit(
      patchBattleState({ talentEffects, enemyStatuses: defaultEnemyStatusValues(bleeding) }),
      { source: "card-attack", card, effect, resolvedDamage: 5, critical: true },
      [],
    );
    const blocked = resolvePlayerHit(
      patchBattleState({ talentEffects, enemyStatuses: defaultEnemyStatusValues(bleeding) }),
      { source: "card-attack", card, effect, resolvedDamage: 0, critical: true },
      [],
    );

    expect(nonCritical.enemyStatuses.bleed).toBe(6);
    expect(critical.enemyStatuses.bleed).toBe(0);
    expect(blocked.enemyStatuses.bleed).toBe(6);
  });

  it("arms Riposte for a Physical-only Crit and preserves it through other attempts", () => {
    let rolls = 0;
    const state = incomingPhysical({
      rng: () => (rolls++ === 0 ? 0.01 : 0.99),
      talentEffects: computeTalentEffects({ physical: ["physical-brute-force"] }),
      enemyHealth: 100,
      enemyMaxHealth: 100,
    });
    const dodged = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    const holy = dealDamage(dodged, makeTestCard({ effects: [makeEffect("holy", 2)] }));
    const physical = dealDamage(holy, makeTestCard({ effects: [makeEffect("physical", 5)] }));

    expect(dodged.flags.nextPhysicalCrit).toBe(true);
    expect(holy.flags.nextPhysicalCrit).toBe(true);
    expect(physical.flags.nextPhysicalCrit).toBe(false);
    expect(physical.enemyHealth).toBe(88);
  });

  it("uses strict enemy and player Health cutoffs for Finish Him and Unrelenting", () => {
    const physical = { kind: "damage", damageType: "physical", amount: 4 } as const;
    const finish = computeTalentEffects({ physical: ["physical-finish-him"] });
    const unrelenting = computeTalentEffects({ physical: ["physical-unrelenting"] });

    expect(
      computeCardDamageToEnemy(
        patchBattleState({ enemyHealth: 24, enemyMaxHealth: 100, talentEffects: finish }),
        physical,
      ).modifiedDamage,
    ).toBe(8);
    expect(
      computeCardDamageToEnemy(
        patchBattleState({ enemyHealth: 25, enemyMaxHealth: 100, talentEffects: finish }),
        physical,
      ).modifiedDamage,
    ).toBe(4);
    expect(
      computeCardDamageToEnemy(
        patchBattleState({ playerHealth: 19, playerMaxHealth: 40, talentEffects: unrelenting }),
        physical,
      ).modifiedDamage,
    ).toBe(8);
    expect(
      computeCardDamageToEnemy(
        patchBattleState({ playerHealth: 20, playerMaxHealth: 40, talentEffects: unrelenting }),
        physical,
      ).modifiedDamage,
    ).toBe(4);
  });

  it("draws Ecosystem's Nature card before the ordinary opening hand", () => {
    const nature = makeTestCard({ id: "nature-start", tags: ["nature"] });
    const ordinary = makeTestCard({ id: "ordinary-start" });
    const state = createBattleStartState({
      runDeck: [ordinary, nature],
      currentEnemy: enemyBestiary[0]!,
      talentEffects: computeTalentEffects({ nature: ["nature-ecosystem"] }),
      rng: () => 0.99,
    });

    expect(state.hand.map((card) => card.id)).toEqual(["nature-start"]);
  });

  it("defaults new Talent manifest fields and Riposte readiness when loading older battles", () => {
    const raw = JSON.parse(JSON.stringify(patchBattleState({ talentEffects: { physicalBleedChance: 10 } })));
    delete raw.talentEffects.natureCardPlayTwiceChance;
    delete raw.talentEffects.drawNatureCardAtCombatStart;
    delete raw.talentEffects.physicalDoubledBelowQuarterHealth;
    delete raw.talentEffects.physicalCritOnDodge;
    delete raw.flags.nextPhysicalCrit;

    const restored = PersistedBattleStateSchema.parse(raw);

    expect(restored.talentEffects.natureCardPlayTwiceChance).toBe(0);
    expect(restored.talentEffects.drawNatureCardAtCombatStart).toBe(false);
    expect(restored.talentEffects.physicalDoubledBelowQuarterHealth).toBe(false);
    expect(restored.talentEffects.physicalCritOnDodge).toBe(false);
    expect(restored.flags.nextPhysicalCrit).toBe(false);
    expect(restored.talentEffects.physicalBleedChance).toBe(10);
  });
});
