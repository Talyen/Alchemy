import { enemyState as stateForEnemy } from "../../fixtures/enemy-battle";
import { makeDamageCard, makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { cardById } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { getEnemyDamageMultiplier, dealSelfDamage } from "@/lib/battle/status-helpers";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyHealingWithCombatText } from "@/lib/battle/player-rewards";
import { processEnemyTraits, processEnemyRegeneration } from "@/lib/battle/enemy-turn-traits";
import { resolvePlayerCrowdControlTriggers } from "@/lib/battle/status-cc";
import { resolveStunTrigger } from "@/lib/battle/stun-leech-resolution";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { initializeEnemyState } from "@/lib/battle/battle-enemy-setup";
import {
  defaultCcState,
  defaultEnemyStatusValues,
  defaultPlayerStatusValues,
} from "../../fixtures/default-battle-state";

describe("imported enemy trait damage rules", () => {
  it.each([
    ["skeleton", "holy"],
    ["frostwarden", "freeze"],
    ["fire-imp", "freeze"],
    ["hellhound", "freeze"],
    ["giant-snake", "freeze"],
    ["blood-cultist", "holy"],
    ["dire-wolf", "physical"],
    ["vampire", "burn"],
    ["winter-wolf", "burn"],
    ["ice-wraith", "physical"],
    ["yeti", "freeze"],
    ["banshee", "holy"],
    ["earth-elemental", "burn"],
  ] as const)("keeps %s's %s defense exclusively on its separate Trait", (id, damageType) => {
    const state = stateForEnemy(id);
    const withoutDefense = {
      ...state,
      currentEnemy: { ...state.currentEnemy, traits: state.currentEnemy.traits.slice(0, 1) },
    };
    expect(getEnemyDamageMultiplier(withoutDefense, damageType)).toBe(1);
  });

  it.each([
    ["bandit", "holy", 1],
    ["goblin", "burn", 1],
    ["pyromancer", "freeze", 1],
    ["zealot", "bleed", 1],
    ["inquisitor", "bleed", 1],
    ["seraph", "bleed", 1],
    ["brawler", "bleed", 1],
    ["skeleton", "holy", 1.3],
    ["skeleton", "stun", 1],
    ["frostwarden", "freeze", 1],
    ["frostwarden", "burn", 1.3],
    ["fire-imp", "freeze", 1.3],
    ["hellhound", "freeze", 1.3],
    ["giant-snake", "freeze", 1.3],
    ["blood-cultist", "holy", 1],
    ["vampire", "holy", 1.3],
    ["vampire", "burn", 1],
    ["winter-wolf", "burn", 1.3],
    ["ice-wraith", "holy", 1.3],
    ["ice-wraith", "burn", 1],
    ["yeti", "burn", 1.3],
    ["banshee", "holy", 1.3],
    ["earth-elemental", "freeze", 1],
    ["will-o-wisp", "physical", 0.7],
    ["ogre", "holy", 1],
    ["giant-spider", "burn", 1.3],
    ["dire-wolf", "physical", 1.3],
    ["paladin", "holy", 1],
    ["ice-wraith", "physical", 1],
    ["yeti", "freeze", 1],
    ["earth-elemental", "burn", 1],
  ] as const)("applies %s %s multiplier", (id, damageType, expected) => {
    const state = stateForEnemy(id);
    expect(getEnemyDamageMultiplier(state, damageType)).toBe(expected);
  });
});

describe("imported enemy attack reactions", () => {
  it("adds room-scaled Pyromancy only to Burn hits within the original damage packet", () => {
    const state = stateForEnemy("pyromancer", { roomScalingMultiplier: 2 });
    const card = makeEnemyTestCard({
      effects: [
        { kind: "damage", damageType: "burn", amount: 3 },
        { kind: "damage", damageType: "holy", amount: 3 },
      ],
    });
    const baseline = applyEnemyAbility({ ...state, currentEnemy: { ...state.currentEnemy, traits: [] } }, card, []);
    const result = applyEnemyAbility(state, card, []);
    expect(result.playerHealth).toBe(baseline.playerHealth - 2);
    expect(result.playerStatuses.burn).toBe(baseline.playerStatuses.burn + 2);
  });

  it("stops adding Pyromancy damage once the hero is Burning, including later hits of one ability", () => {
    const state = stateForEnemy("pyromancer", { roomScalingMultiplier: 2 });
    const hit = makeDamageCard("burn", 1);
    const first = applyEnemyAbility(state, hit, []);
    const repeated = applyEnemyAbility(state, { ...hit, effects: [...hit.effects, ...hit.effects] }, []);
    const withoutTrait = applyEnemyAbility({ ...first, currentEnemy: { ...first.currentEnemy, traits: [] } }, hit, []);
    const second = applyEnemyAbility(first, hit, []);
    expect(first.playerStatuses.burn).toBeGreaterThan(0);
    expect(second.playerHealth).toBe(withoutTrait.playerHealth);
    expect(second.playerStatuses.burn).toBe(withoutTrait.playerStatuses.burn);
    expect(repeated.playerHealth).toBe(second.playerHealth);
  });

  it.each(["physical", "bleed"] as const)("Ambush describes and doubles only the first landed %s hit", (damageType) => {
    const state = stateForEnemy("bandit", {});
    expect(state.currentEnemy.traits.find((trait) => trait.id === "bandit")?.description).toBe(
      "Its first landed hit deals double damage.",
    );
    const first = applyEnemyAbility(state, makeDamageCard(damageType, 4), []);
    const second = applyEnemyAbility(first, makeDamageCard(damageType, 4), []);
    expect(first.playerHealth).toBe(92);
    expect(second.playerHealth).toBe(88);
    expect(second.flags.enemyFirstHitDoubleUsed).toBe(true);
  });

  it("does not consume Bandit's first-hit modifier on a dodged packet", () => {
    let calls = 0;
    const state = stateForEnemy("bandit", {
      rng: () => (calls++ === 0 ? 0 : 0.99),
    });
    const dodged = applyEnemyAbility(state, makeDamageCard("physical", 4), []);
    const landed = applyEnemyAbility(dodged, makeDamageCard("physical", 4), []);
    expect(dodged.playerHealth).toBe(100);
    expect(dodged.flags.enemyFirstHitDoubleUsed).toBe(false);
    expect(landed.playerHealth).toBe(92);
  });

  it("consumes Bandit's first-hit modifier on a fully Blocked packet", () => {
    const state = stateForEnemy("bandit", {
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
    });
    const result = applyEnemyAbility(state, makeDamageCard("physical", 4), []);
    expect(result.playerStatuses.block).toBe(2);
    expect(result.playerHealth).toBe(100);
    expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    const second = applyEnemyAbility(result, makeDamageCard("physical", 4), []);
    expect(second.playerHealth).toBe(98);
    expect(second.playerStatuses.block).toBe(0);
  });

  it("doubles Ogre Block removal and gives Giant Snake's poison an extra strip", () => {
    const ogre = applyEnemyAbility(
      stateForEnemy("ogre", {
        playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      }),
      makeDamageCard("physical", 4),
      [],
    );
    const snake = applyEnemyAbility(
      stateForEnemy("giant-snake", {
        playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      }),
      makeDamageCard("poison", 3),
      [],
    );
    expect(ogre.playerStatuses.block).toBe(2);
    expect(ogre.playerHealth).toBe(100);
    expect(snake.playerStatuses.block).toBe(1);
    expect(snake.playerHealth).toBe(100);
  });

  it("applies player mitigation to Pyromancer Burn", () => {
    const state = stateForEnemy("pyromancer", {
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      talentEffects: { ...stateForEnemy("pyromancer").talentEffects, burnDamageReduction: 4 },
    });
    const result = applyEnemyAbility(state, makeDamageCard("burn", 3), []);
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses.block).toBe(1);
  });

  it("applies Burn resistance to unblocked Pyromancer attacks", () => {
    const state = stateForEnemy("pyromancer", {
      talentEffects: { ...stateForEnemy("pyromancer").talentEffects, burnDamageReduction: 2 },
    });
    expect(applyEnemyAbility(state, makeDamageCard("burn", 3), []).playerHealth).toBe(98);
  });

  it.each([
    ["fire-imp", "fireball", "burn", 3],
    ["giant-spider", "venom-fangs", "poison", 2],
    ["winter-wolf", "fangs", "freeze", 1],
  ] as const)("applies %s's %s attack rider", (id, ability, status, expected) => {
    const result = applyEnemyAbility(stateForEnemy(id), cardById[ability], []);
    expect(result.playerStatuses[status]).toBe(expected);
  });

  it.each([
    ["hellhound", "burning-blade", { burn: 1 }, 99],
    ["dire-wolf", "fangs", { bleed: 1 }, 97],
    ["banshee", "bash", { stun: 1 }, 97],
    ["ice-wraith", "frostbolt", undefined, 97],
  ] as const)("modifies %s damage from its player/enemy state", (id, ability, statuses, expectedHealth) => {
    const result = applyEnemyAbility(
      stateForEnemy(id, {
        ...(statuses ? { playerStatuses: defaultPlayerStatusValues(statuses) } : {}),
        ...(id === "ice-wraith" ? { enemyStatuses: defaultEnemyStatusValues({ freeze: 1 }) } : {}),
      }),
      cardById[ability],
      [],
    );
    expect(result.playerHealth).toBe(expectedHealth);
  });

  it("gives Yeti Block when the player becomes Frozen", () => {
    const state = stateForEnemy("yeti", {
      playerHealth: 10,
      playerMaxHealth: 10,
      playerStatuses: defaultPlayerStatusValues({ freeze: 5 }),
    });
    const result = resolvePlayerCrowdControlTriggers(state, []);
    expect(result.enemyMitigation.block).toBe(1);
    expect(result.playerCC.freezeSkipTurns).toBeGreaterThan(0);
  });

  it("purges one Banshee buff after a fully Blocked attack", () => {
    const texts: Parameters<typeof applyEnemyAbility>[2] = [];
    const result = applyEnemyAbility(
      stateForEnemy("banshee", {
        playerStatuses: defaultPlayerStatusValues({ block: 10, haste: 2 }),
      }),
      makeDamageCard("stun", 4),
      texts,
    );
    expect(result.playerHealth).toBe(100);
    const purgedCount = (["block", "haste"] as const).filter((stat) => result.playerStatuses[stat] === 0);
    expect(purgedCount).toHaveLength(1);
    expect(texts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: purgedCount[0],
      text: "Purged",
      signal: "purge",
    });
  });

  it("damages Blood Countess only when the hero restores Health and pays kill rewards", () => {
    const base = stateForEnemy("blood-countess");
    const playerHealState = stateForEnemy("blood-countess", {
      enemyHealth: 1,
      playerHealth: 90,
      gold: 0,
      gearEffects: { ...base.gearEffects, goldOnKill: 3 },
    });
    const playerHealResult = applyHealingWithCombatText(playerHealState, 1, []);
    expect(playerHealResult.enemyHealth).toBe(0);
    expect(playerHealResult.gold).toBe(3);

    const enemyHealResult = processEnemyRegeneration(
      stateForEnemy("blood-countess", { enemyHealth: 90, enemyRegeneration: 3 }),
      [],
    );
    expect(enemyHealResult.enemyHealth).toBe(93);
  });

  it("halves Brawler's first attack after Stun resolves", () => {
    const stunned = resolveStunTrigger(
      stateForEnemy("brawler", {
        enemyStatuses: defaultEnemyStatusValues({ stun: 50 }),
      }),
      [],
    );
    const result = applyEnemyAbility(
      {
        ...stunned,
        enemyCC: defaultCcState(),
      },
      makeDamageCard("physical", 10),
      [],
    );
    expect(result.flags.enemyBrawlerDamagePenalty).toBe(false);
    expect(result.playerHealth).toBe(95);
  });

  it("Crimson Pulse follows alternating turns without selecting an ability", () => {
    const state = stateForEnemy("blood-countess", { turn: 2 });
    const result = processEnemyTraits(state, []);
    expect(result.playerStatuses.bleed).toBe(1);
    expect(result.lastEnemyAbilityId).toBe(state.lastEnemyAbilityId);
    expect(processEnemyTraits({ ...state, turn: 1 }, []).playerStatuses.bleed).toBe(0);
  });
});

describe("native enemy identities", () => {
  const attack = makeDamageCard("physical", 8);

  it("Hollow Frame blocks direct and delayed Leech, including Leech rewards, while preserving damage", () => {
    const state = stateForEnemy("skeleton", { playerHealth: 50 });
    const withRewards = {
      ...state,
      talentEffects: { ...state.talentEffects, leechHealingBonus: 10 },
      gearEffects: { ...state.gearEffects, leechBlockChance: 100 },
    };
    const effect = { kind: "damage", damageType: "bleed", amount: 8, lifesteal: true } as const;
    const card = makeEnemyTestCard({ effects: [effect] });
    const texts: Parameters<typeof applyEnemyAbility>[2] = [];
    const hit = dealDamageToEnemy(withRewards, card, effect, texts);
    expect(hit.enemyHealth).toBe(92);
    expect(hit.playerHealth).toBe(50);
    expect(hit.playerStatuses.block).toBe(0);
    const ticked = tickEnemyStatuses(hit, texts);
    expect(ticked.enemyHealth).toBeLessThan(hit.enemyHealth);
    expect(ticked.playerHealth).toBe(50);
    expect(texts.some((text) => text.target === "player" && text.kind === "heal")).toBe(false);
  });

  it("Hollow Frame still prevents Leech on the killing hit", () => {
    const effect = { kind: "damage", damageType: "physical", amount: 8, lifesteal: true } as const;
    const card = makeEnemyTestCard({ effects: [effect] });
    const result = dealDamageToEnemy(stateForEnemy("skeleton", { playerHealth: 50, enemyHealth: 1 }), card, effect, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(50);
  });

  it("Pilfer transfers one Block before the attack and pays depletion rewards", () => {
    const state = stateForEnemy("goblin", {
      playerHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ block: 1 }),
    });
    const result = applyEnemyAbility(
      { ...state, talentEffects: { ...state.talentEffects, blockDepletedHeal: 2 } },
      attack,
      [],
    );
    expect(result.enemyMitigation.block).toBe(1);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerHealth).toBe(44);
  });

  it("Pilfer cannot create Block from nothing or steal on a defensive ability", () => {
    expect(applyEnemyAbility(stateForEnemy("goblin"), attack, []).enemyMitigation.block).toBe(0);
    const state = stateForEnemy("goblin", { playerStatuses: defaultPlayerStatusValues({ block: 5 }) });
    const defensive = applyEnemyAbility(state, cardById.block, []);
    const withoutTrait = applyEnemyAbility(
      { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
      cardById.block,
      [],
    );
    expect(defensive.playerStatuses.block).toBe(5);
    expect(defensive.enemyMitigation.block).toBe(withoutTrait.enemyMitigation.block);
  });

  it("Pilfer steals before every hit, including Dodged hits", () => {
    const state = stateForEnemy("goblin", { playerStatuses: defaultPlayerStatusValues({ block: 20 }) });
    const result = applyEnemyAbility(state, { ...attack, effects: [...attack.effects, ...attack.effects] }, []);
    expect(result.enemyMitigation.block).toBe(2);
    expect(result.playerStatuses.block).toBe(2);
    const dodged = applyEnemyAbility({ ...state, rng: () => 0 }, attack, []);
    expect(dodged.playerStatuses.block).toBe(19);
    expect(dodged.enemyMitigation.block).toBe(1);
  });

  it("Snap Shut grants Block on landed hits and never after misses or utility", () => {
    const state = stateForEnemy("mimic");
    expect(applyEnemyAbility(state, attack, []).enemyMitigation.block).toBe(1);
    expect(applyEnemyAbility({ ...state, rng: () => 0 }, attack, []).enemyMitigation.block).toBe(0);
    const defensive = applyEnemyAbility(state, cardById.block, []);
    const baseline = applyEnemyAbility(
      { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
      cardById.block,
      [],
    );
    expect(defensive.enemyMitigation.block).toBe(baseline.enemyMitigation.block);
  });

  it("Contagion heals once per damaging Poison hit and tick, including typed self-damage", () => {
    const state = stateForEnemy("plague-doctor", { enemyHealth: 50 });
    const poison = makeDamageCard("poison", 4);
    const hit = applyEnemyAbility(state, poison, []);
    expect(hit.enemyHealth).toBe(51);
    expect(tickPlayerStatuses(hit, []).enemyHealth).toBe(52);
    expect(dealSelfDamage(state, 3, "poison", []).state.enemyHealth).toBe(51);
  });

  it("Contagion rewards blocked Poison hits but not other damage or a finished battle", () => {
    const state = stateForEnemy("plague-doctor", { enemyHealth: 50 });
    const poison = makeDamageCard("poison", 4);
    const blocked = applyEnemyAbility(
      { ...state, playerStatuses: defaultPlayerStatusValues({ block: 20 }) },
      poison,
      [],
    );
    expect(blocked.enemyHealth).toBe(51);
    const resisted = tickPlayerStatuses(
      {
        ...state,
        playerStatuses: defaultPlayerStatusValues({ poison: 4 }),
        talentEffects: { ...state.talentEffects, poisonDamageReduction: 100 },
      },
      [],
    );
    expect(resisted.enemyHealth).toBe(51);
    const selfResisted = dealSelfDamage(
      { ...state, talentEffects: { ...state.talentEffects, poisonDamageReduction: 100 } },
      3,
      "poison",
      [],
    );
    expect(selfResisted.healthLost).toBe(0);
    expect(selfResisted.state.enemyHealth).toBe(51);
    expect(applyEnemyAbility(state, attack, []).enemyHealth).toBe(50);
    const lethal = applyEnemyAbility({ ...state, playerHealth: 1, deathsDoorUsed: true }, poison, []);
    expect(lethal.playerHealth).toBe(0);
    expect(lethal.enemyHealth).toBe(50);
  });

  it("Cold Embrace heals 3 only on becoming Frozen, respecting the Health cap", () => {
    const state = stateForEnemy("ice-wraith", {
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ freeze: 50 }),
    });
    const frozen = resolvePlayerCrowdControlTriggers(state, []);
    expect(frozen.enemyHealth).toBe(53);
    expect(resolvePlayerCrowdControlTriggers(frozen, []).enemyHealth).toBe(53);
    expect(resolvePlayerCrowdControlTriggers({ ...state, enemyHealth: 99 }, []).enemyHealth).toBe(100);
    expect(
      resolvePlayerCrowdControlTriggers({ ...state, playerCC: defaultCcState({ cooldown: 1 }) }, []).enemyHealth,
    ).toBe(50);
    expect(
      resolvePlayerCrowdControlTriggers({ ...state, playerStatuses: defaultPlayerStatusValues({ freeze: 1 }) }, [])
        .enemyHealth,
    ).toBe(50);
  });

  it.each([50, 51])(
    "Soul Harvest stays inactive at %s enemy Health even when the hero is below half",
    (enemyHealth) => {
      const result = applyEnemyAbility(
        stateForEnemy("necromancer", {
          enemyHealth,
          playerHealth: 25,
          playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
        }),
        attack,
        [],
      );
      expect(result.enemyHealth).toBe(enemyHealth);
      expect(result.playerStatuses.forge).toBe(2);
    },
  );

  it("Soul Harvest chooses Leech below the Necromancer's half Health even when the hero is healthy", () => {
    const result = applyEnemyAbility(
      stateForEnemy("necromancer", {
        enemyHealth: 49,
        playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      }),
      attack,
      [],
    );
    expect(result.enemyHealth).toBe(53);
    expect(result.playerHealth).toBe(92);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("Soul Harvest chooses and resolves Purge for each landed hit without Leech", () => {
    let draws = 0;
    const state = stateForEnemy("necromancer", {
      enemyHealth: 49,
      playerStatuses: defaultPlayerStatusValues({ forge: 2, haste: 2 }),
      rng: () => [0.1, 0.99, 0.99][draws++ % 3],
    });
    const fangs = makeDamageCard("bleed", [2, 2]);
    const texts: Parameters<typeof applyEnemyAbility>[2] = [];
    const result = applyEnemyAbility(state, fangs, texts);
    expect(result.enemyHealth).toBe(49);
    expect(texts.filter((text) => "signal" in text && text.signal === "purge")).toHaveLength(2);
    expect(result.pendingEnemyBleedLeechHealing).toBe(0);
  });

  it("Soul Harvest never Purges on a Dodged attack", () => {
    let draws = 0;
    const result = applyEnemyAbility(
      stateForEnemy("necromancer", {
        enemyHealth: 49,
        playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
        rng: () => (draws++ === 0 ? 0.1 : 0),
      }),
      attack,
      [],
    );
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.enemyHealth).toBe(49);
  });

  it("Mud Elemental starts with the existing one-Health regeneration", () => {
    const state = stateForEnemy("mud-elemental", { enemyHealth: 50 });
    const setup = initializeEnemyState(state.currentEnemy, 1, []);
    expect(setup.enemyRegeneration).toBe(1);
    expect(processEnemyRegeneration({ ...state, enemyRegeneration: setup.enemyRegeneration }, []).enemyHealth).toBe(51);
  });
});
