import { describe, expect, it, vi } from "vitest";
import {
  cardById,
  enemyBestiary,
  enemyById,
  enemyAbilityDealsDamage,
  getEnemyAbilities,
  getEnemyAbilityCard,
  isEnemyAbilityCard,
} from "@/lib/game-data";
import { applyEnemyAbility, processEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { getEnemyAbilityPressure, scaleEnemyAbilityDamage } from "@/lib/battle/battle-enemy-setup";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestBattleState, makeTestCard, seededRng } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import type { BattleState, CombatTextEvent } from "@/lib/battle";

function enemyState(id = "skeleton", overrides: Partial<BattleState> = {}): BattleState {
  const state = makeTestBattleState({
    currentEnemy: enemyById[id],
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    rng: () => 0.99,
    ...overrides,
  });
  return {
    ...state,
    difficultyModifiers: state.difficultyModifiers.some((modifier) => modifier.kind === "enemy-damage-multiplier")
      ? state.difficultyModifiers
      : [{ kind: "enemy-damage-multiplier", amount: 1 / getEnemyAbilityPressure(state) }, ...state.difficultyModifiers],
  };
}

function useAbility(state: BattleState, id: string, texts: CombatTextEvent[] = []) {
  return applyEnemyAbility(state, getEnemyAbilityCard(id), texts);
}

describe("enemy repertoire", () => {
  it("assigns three distinct canonical, fully supported cards to every enemy", () => {
    for (const enemy of enemyBestiary) {
      expect(enemy.abilityIds).toHaveLength(3);
      expect(new Set(enemy.abilityIds).size).toBe(3);
      for (const card of getEnemyAbilities(enemy)) {
        expect(card).toBe(cardById[card.id]);
        expect(isEnemyAbilityCard(card)).toBe(true);
      }
    }
    expect(enemyById["forge-golem"].abilityIds).toContain("sunder");
  });

  it("rejects unsupported cards and unsupported effects hidden inside a chance", () => {
    for (const id of ["haste", "meteor", "steal", "wish", "poison-dagger", "crystal-bulwark", "ray-of-frost"]) {
      expect(isEnemyAbilityCard(cardById[id])).toBe(false);
      expect(() => useAbility(enemyState(), id)).toThrow("Unsupported enemy ability");
    }
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "physical", amount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    });
    expect(() => applyEnemyAbility(enemyState(), card, [])).toThrow("Unsupported enemy ability");
    expect(enemyAbilityDealsDamage(cardById.maul)).toBe(true);
    expect(enemyAbilityDealsDamage(cardById.block)).toBe(false);
  });

  it("selects reproducibly without consecutive repeats and never rolls during inspection", () => {
    function sequence() {
      let state = enemyState("skeleton", { rng: seededRng(1234), playerHealth: 1000, playerMaxHealth: 1000 });
      const ids: string[] = [];
      for (let i = 0; i < 20; i++) {
        state = processEnemyAbility(state, []);
        ids.push(state.lastEnemyAbilityId!);
      }
      return ids;
    }
    const ids = sequence();
    expect(sequence()).toEqual(ids);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id, index) => index === 0 || ids[index - 1] !== id)).toBe(true);
    const rng = vi.fn(() => 0.4);
    const state = enemyState("skeleton", { rng });
    getEnemyAbilities(state.currentEnemy);
    expect(rng).not.toHaveBeenCalled();
  });

  it("uses all opening choices and excludes only the preceding ability", () => {
    for (const [roll, id] of [
      [0.1, "slash"],
      [0.5, "bash"],
      [0.9, "block"],
    ] as const) {
      expect(processEnemyAbility(enemyState("skeleton", { rng: () => roll }), []).lastEnemyAbilityId).toBe(id);
    }
    const state = enemyState("skeleton", { lastEnemyAbilityId: "bash", rng: () => 0.5 });
    expect(processEnemyAbility(state, []).lastEnemyAbilityId).toBe("block");
  });

  it("does not advance ability history or world randomness during crowd control or Haste", () => {
    const base = enemyState("skeleton", { lastEnemyAbilityId: "slash" });
    for (const state of [
      { ...base, enemyCC: { ...base.enemyCC, stunSkipTurns: 1 } },
      { ...base, enemyCC: { ...base.enemyCC, freezeSkipTurns: 1 } },
      { ...base, playerStatuses: { ...base.playerStatuses, haste: 1 } },
    ]) {
      const rng = vi.fn(() => 0.9);
      const result = endPlayerTurn({ ...state, rng });
      expect(result.enemyPerformedAbility).toBe(false);
      expect(result.state.lastEnemyAbilityId).toBe("slash");
      expect(rng).not.toHaveBeenCalled();
    }
  });

  it("retains valid history when normalized and repairs invalid ability references", () => {
    const current = useAbility(enemyState(), "slash");
    const restored = normalizePersistedBattleState(JSON.parse(JSON.stringify(current)));
    expect(restored.lastEnemyAbilityId).toBe("slash");
    expect(processEnemyAbility({ ...restored, rng: () => 0.1 }, []).lastEnemyAbilityId).toBe("bash");
    const repaired = normalizePersistedBattleState({
      ...current,
      lastEnemyAbilityId: "wish",
      currentEnemy: { ...current.currentEnemy, abilityIds: ["wish", "slash", "block"] },
    });
    expect(repaired.currentEnemy.abilityIds).toEqual(enemyById.skeleton.abilityIds);
    expect(repaired.lastEnemyAbilityId).toBeNull();
  });

  it("treats inherited object names as invalid catalog references when restoring a battle", () => {
    const state = enemyState();
    for (const id of ["constructor", "__proto__"]) {
      expect(() => getEnemyAbilityCard(id)).toThrow("Unsupported enemy ability");
      const restored = normalizePersistedBattleState({
        ...state,
        currentEnemy: { ...state.currentEnemy, abilityIds: [id, "slash", "block"] },
        lastEnemyAbilityId: id,
      });
      expect(restored.currentEnemy.abilityIds).toEqual(enemyById.skeleton.abilityIds);
      expect(restored.lastEnemyAbilityId).toBeNull();
      expect(restored.playerHealth).toBe(state.playerHealth);
    }
  });
});

describe("enemy card effects", () => {
  it("resolves mixed offense and self-defense without borrowing hero talents or resources", () => {
    const base = enemyState();
    const state = {
      ...base,
      talentEffects: { ...base.talentEffects, flatPhysicalDamage: 100, flatArmorAmount: 100, forgeToBlock: true },
      gearEffects: { ...base.gearEffects, flatBlockGained: 100 },
      playerStatuses: { ...base.playerStatuses, forge: 100 },
    };
    const cardBefore = JSON.stringify(cardById["shield-bash"]);
    const result = useAbility(state, "shield-bash");
    expect(result.playerHealth).toBe(98);
    expect(result.playerStatuses.stun).toBe(2);
    expect(result.enemyMitigation.block).toBe(2);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.mana).toBe(state.mana);
    expect(result.gold).toBe(state.gold);
    expect(result.hand).toBe(state.hand);
    expect(result.talentEffects).toBe(state.talentEffects);
    expect(useAbility(state, "plate-mail").enemyMitigation.armor).toBe(2);
    expect(useAbility(state, "briar-shield").enemyStatuses.thorns).toBe(3);
    expect(JSON.stringify(cardById["shield-bash"])).toBe(cardBefore);
  });

  it("targets hero Armor, live Bleed, and Freeze buildup from the enemy perspective", () => {
    const base = enemyState();
    const state = { ...base, playerStatuses: { ...base.playerStatuses, armor: 5, bleed: 1 } };
    const sunder = useAbility(state, "sunder");
    expect(sunder.playerStatuses.armor).toBe(3);
    expect(sunder.enemyMitigation.armor).toBe(0);
    expect(useAbility(state, "rend").playerHealth).toBe(96);
    const frozen = useAbility({ ...base, playerStatuses: { ...base.playerStatuses, freeze: 25 } }, "cold-snap");
    expect(frozen.playerCC.freezeSkipTurns).toBe(1);
    expect(frozen.playerStatuses.freeze).toBe(0);
    expect(frozen.enemyStatuses.freeze).toBe(0);
  });

  it("resolves both Maul branches and preserves their native damage types", () => {
    for (const [roll, status] of [
      [0.1, "stun"],
      [0.9, "bleed"],
    ] as const) {
      const result = useAbility(enemyState("skeleton", { rng: () => roll }), "maul");
      expect(result.playerHealth).toBe(97);
      expect(result.playerStatuses[status]).toBeGreaterThan(0);
    }
  });

  it("carries native Bleed Leech into its tick without leeching Vampire's bonus", () => {
    const state = enemyState("vampire", { enemyHealth: 10, playerHealth: 49 });
    const hit = useAbility(state, "fangs");
    expect(hit.pendingEnemyBleedLeechHealing).toBe(2);
    expect(hit.playerStatuses.bleed).toBe(3);
    expect(hit.enemyHealth).toBe(12);
    const tick = tickPlayerStatuses(hit, []);
    expect(tick.enemyHealth).toBe(13);
    expect(tick.pendingEnemyBleedLeechHealing).toBe(0);
  });

  it("uses card-granted Thorns independently of legacy encounter retaliation", () => {
    const slash = { ...cardById.slash, uid: 1 };
    for (const legacy of [false, true]) {
      const base = enemyState("blight-treant");
      const prepared = useAbility(
        {
          ...base,
          currentEnemy: {
            ...base.currentEnemy,
            traits: legacy ? [{ id: "thorns", title: "Thorns", description: "" }] : [],
          },
          enemyStatuses: { ...base.enemyStatuses, thorns: legacy ? 1 : 0 },
          flags: { ...base.flags, legacyEnemyThornsReady: legacy },
        },
        "briar-shield",
      );
      const hit = playBattleCardResolved({ ...prepared, hand: [slash], mana: 1 }, slash.id, 0).state;
      expect(hit.playerHealth).toBe(legacy ? 96 : 97);
      expect(hit.enemyStatuses.thorns).toBe(0);
      expect(hit.flags.legacyEnemyThornsReady).toBe(false);
    }
  });

  it("scales canonical damage at resolution without modifying the card", () => {
    const effect = { kind: "damage", damageType: "freeze", amount: 3, lifesteal: true } as const;
    const scaled = scaleEnemyAbilityDamage(
      {
        roomScalingMultiplier: 1.5,
        currentEnemy: enemyById.skeleton,
        difficultyModifiers: [
          { kind: "enemy-damage-multiplier", amount: 1.5 },
          { kind: "increase-enemy-damage", amount: 2 },
          { kind: "increase-enemy-status", status: "freeze", amount: 1 },
        ],
      },
      effect,
    );
    expect(scaled).toEqual({ ...effect, amount: 13 });
    expect(effect.amount).toBe(3);
    expect(
      scaleEnemyAbilityDamage(
        {
          currentEnemy: enemyById.skeleton,
          roomScalingMultiplier: 1,
          difficultyModifiers: [{ kind: "enemy-attacks-gain-leech" }],
        },
        { kind: "damage", damageType: "physical", amount: 6 },
      ).lifesteal,
    ).toBe(true);
  });

  it("stops the ability when retaliation defeats the enemy", () => {
    const base = enemyState();
    const state = {
      ...base,
      enemyHealth: 1,
      playerStatuses: { ...base.playerStatuses, block: 10 },
      talentEffects: { ...base.talentEffects, holyReflectionBlockLostPercent: 100 },
    };
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "player-status", status: "block", amount: 5 },
        { kind: "damage", damageType: "physical", amount: 20 },
      ],
    });
    const result = applyEnemyAbility(state, card, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.enemyMitigation.block).toBe(0);
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses.block).toBe(8);
  });
});

describe("ability trait boundaries", () => {
  it.each(["bandit", "banshee"])("Aetherward preserves landed-hit reactions for %s", (enemy) => {
    const initial = enemyState(enemy, {
      mana: 3,
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ thorns: 3, armor: 4 }),
      difficultyModifiers: [{ kind: "enemy-attacks-gain-leech" }],
    });
    const result = useAbility(
      { ...initial, gearEffects: { ...initial.gearEffects, damageReductionPerMana: 10 } },
      "slash",
    );
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(47);
    expect(result.playerStatuses.thorns).toBe(0);
    if (enemy === "bandit") expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    else expect(result.playerStatuses.armor).toBe(0);
  });

  it("triggers landed-hit reactions when resistance prevents all Health damage", () => {
    const initial = enemyState("bandit", {
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ thorns: 3 }),
      difficultyModifiers: [{ kind: "enemy-attacks-gain-leech" }],
    });
    const result = useAbility({ ...initial, gearEffects: { ...initial.gearEffects, resistPhysical: 100 } }, "slash");
    expect(result.playerHealth).toBe(100);
    expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(result.enemyHealth).toBe(47);
  });

  it("consumes Ambush and triggers Thorns on an Armor-absorbed hit without granting Leech", () => {
    const result = useAbility(
      enemyState("bandit", {
        enemyHealth: 50,
        playerStatuses: defaultPlayerStatusValues({ armor: 20, thorns: 3 }),
        difficultyModifiers: [{ kind: "enemy-attacks-gain-leech" }],
      }),
      "slash",
    );
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses.armor).toBe(20);
    expect(result.flags.enemyFirstHitDoubleUsed).toBe(true);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(result.enemyHealth).toBe(47);
  });

  it("lets Banshee Purge Armor that completely absorbed its hit", () => {
    const result = useAbility(
      enemyState("banshee", { playerStatuses: defaultPlayerStatusValues({ armor: 20, forge: 2 }) }),
      "bash",
    );
    expect(result.playerHealth).toBe(100);
    expect(result.playerStatuses).toMatchObject({ armor: 0, forge: 2, stun: 0 });
  });

  it("keeps Bandit and Brawler bonuses through defensive actions", () => {
    const blockedBandit = useAbility(enemyState("bandit"), "block");
    expect(blockedBandit.flags.enemyFirstHitDoubleUsed).toBe(false);
    const first = useAbility(blockedBandit, "serrated-edge");
    expect(first.playerHealth).toBe(95);
    expect(first.flags.enemyFirstHitDoubleUsed).toBe(true);
    const base = enemyState("brawler");
    const stunned = resolveStunTrigger({ ...base, enemyStatuses: { ...base.enemyStatuses, stun: 60 } }, []);
    const defended = useAbility(stunned, "block");
    expect(defended.flags.enemyBrawlerDamagePenalty).toBe(true);
    const attacked = useAbility(defended, "pounce");
    expect(attacked.playerHealth).toBe(98);
    expect(attacked.flags.enemyBrawlerDamagePenalty).toBe(false);
  });

  it("rewards established Bleed with Blood Frenzy while retaining only native Leech", () => {
    const state = enemyState("blood-cultist", { enemyHealth: 10 });
    expect(useAbility(state, "serrated-edge").enemyHealth).toBe(10);
    expect(useAbility(state, "rend").playerHealth).toBe(98);
    const bleeding = { ...state, playerStatuses: { ...state.playerStatuses, bleed: 1 } };
    expect(useAbility(bleeding, "rend").playerHealth).toBe(95);
    expect(useAbility(bleeding, "rend").enemyHealth).toBe(10);
    expect(useAbility(state, "fangs").enemyHealth).toBe(
      useAbility(enemyState("skeleton", { enemyHealth: 10 }), "fangs").enemyHealth,
    );
    expect(useAbility(state, "bloodthorn").enemyHealth).toBe(12);
  });

  it("adds one Blood Scent hit strictly below half Health without additional Leech", () => {
    const normal = enemyState("vampire", { playerHealth: 50, enemyHealth: 10 });
    const low = { ...normal, playerHealth: 49 };
    const normalResult = useAbility(normal, "fangs");
    const lowResult = useAbility(low, "fangs");
    expect(normalResult.playerHealth).toBe(47);
    expect(lowResult.playerHealth).toBe(45);
    expect(lowResult.enemyHealth).toBe(normalResult.enemyHealth);
    const block = useAbility(low, "block");
    expect(block.playerHealth).toBe(49);
    expect(block.playerStatuses.bleed).toBe(0);
  });

  it("rewards matching Health damage once per ability and not for fully blocked hits", () => {
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "holy", amount: 2 },
        { kind: "damage", damageType: "holy", amount: 2 },
        { kind: "damage", damageType: "stun", amount: 2 },
      ],
    });
    for (const [id, reward] of [
      ["zealot", "forge"],
      ["paladin", "block"],
      ["stone-titan", "armor"],
    ] as const) {
      const base = enemyState(id);
      expect(applyEnemyAbility(base, card, []).enemyMitigation[reward]).toBe(1);
      expect(
        applyEnemyAbility({ ...base, playerStatuses: defaultPlayerStatusValues({ block: 50 }) }, card, [])
          .enemyMitigation[reward],
      ).toBe(0);
    }
    for (const id of ["cleric", "seraph"]) {
      const result = applyEnemyAbility(enemyState(id, { enemyHealth: 10 }), card, []);
      expect(result.enemyHealth).toBe(11);
    }
    const armored = useAbility(
      enemyState("stone-titan", { playerStatuses: defaultPlayerStatusValues({ armor: 20 }) }),
      "bash",
    );
    expect(armored.playerHealth).toBe(100);
    expect(armored.enemyMitigation.armor).toBe(0);
    const holy = useAbility(
      enemyState("inquisitor", { playerStatuses: defaultPlayerStatusValues({ burn: 1 }) }),
      "judgment",
    );
    expect(holy.playerHealth).toBe(95);
  });
});
