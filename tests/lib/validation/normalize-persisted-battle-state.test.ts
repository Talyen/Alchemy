import { describe, expect, it } from "vitest";
import { battleSnapshot, defaultBattleState } from "@/lib/battle";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import type { TrinketManifest } from "@/lib/battle/types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { cardById, enemyById } from "@/lib/game-data";
import { MANABURN_DAMAGE_PERCENT, MAX_HAND_SIZE, MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { normalizePersistedBattleState, repairPersistedTrinketManifest } from "@/lib/validation";

describe("normalizePersistedBattleState", () => {
  it("repairs related fields consistently without mutating the saved battle", () => {
    const saved = {
      ...battleSnapshot(defaultBattleState()),
      playerHealth: 100,
      playerMaxHealth: 50,
      mana: Number.NaN,
      maxMana: 0,
      turn: 4.9,
      deathsDoorActive: true,
      deathsDoorUsed: true,
      deathsDoorTriggeredTurn: 5,
      deathsDoorGraceTurnsRemaining: 2.9,
      hand: Array.from({ length: MAX_HAND_SIZE + 1 }, (_, index) => ({ ...cardById.slash!, uid: index + 1 })),
      pendingHandCards: [{ ...cardById.block!, uid: 50 }],
      exhausted: [{ ...cardById.slash!, uid: 80 }],
      nextCardUid: 1,
    };
    const before = structuredClone(saved);
    Object.freeze(saved);
    Object.freeze(saved.flags);
    Object.freeze(saved.hand);
    Object.freeze(saved.pendingHandCards);

    const normalized = normalizePersistedBattleState(saved);
    expect(normalized).toMatchObject({
      playerHealth: 50,
      playerMaxHealth: 50,
      mana: defaultBattleState().mana,
      maxMana: MIN_MAX_MANA_FLOOR,
      turn: 4,
      deathsDoorActive: true,
      deathsDoorUsed: true,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: 2,
      nextCardUid: 81,
    });
    expect(normalized.hand).toHaveLength(MAX_HAND_SIZE);
    expect(normalized.pendingHandCards.map((card) => card.uid)).toEqual([MAX_HAND_SIZE + 1, 50]);
    expect(normalizePersistedBattleState(normalized)).toEqual(normalized);
    expect(saved).toEqual(before);
  });

  it("retains a running battle's Health, defenses, and old roster across balance updates", () => {
    const saved = {
      ...defaultBattleState(),
      currentEnemy: {
        ...enemyById["iron-bear"],
        title: "Stale name",
        art: "stale-art.webp",
        abilityIds: ["maul", "burning-blade", "plate-mail"],
      },
      roomScalingMultiplier: 1.42,
      enemyMaxHealth: 119,
      enemyHealth: 63,
      lastEnemyAbilityId: "plate-mail",
      enemyMitigation: { block: 5, armor: 7, forge: 0 },
    };
    const normalized = normalizePersistedBattleState(saved);
    expect(normalized).toMatchObject({
      enemyMaxHealth: 119,
      enemyHealth: 63,
      roomScalingMultiplier: 1.42,
      lastEnemyAbilityId: "plate-mail",
      enemyMitigation: saved.enemyMitigation,
      currentEnemy: { abilityIds: saved.currentEnemy.abilityIds },
    });
    expect(normalized.currentEnemy.title).toBe(enemyById["iron-bear"].title);
    expect(normalized.currentEnemy.art).toBe(enemyById["iron-bear"].art);
    expect(enemyById["iron-bear"].abilityIds).toContain("pounce");
  });
  it.each(["goblin", "frostwarden", "skeleton", "ice-wraith", "pyromancer"] as const)(
    "refreshes %s native Traits without replaying battle setup or losing modifiers",
    (id) => {
      const defaults = defaultBattleState();
      const enemy = enemyById[id];
      const saved = {
        ...defaults,
        currentEnemy: {
          ...enemy,
          traits: [
            { id: id === "goblin" ? "trinket-hoarder" : enemy.traits[0]!.id, title: "Old", description: "Old" },
            { id: "combustible", title: "Combustible", description: "Old" },
          ],
        },
        enemyHealth: 17,
        enemyMitigation: { block: 1, armor: 2, forge: 3 },
        lastEnemyAbilityId: enemy.abilityIds[0]!,
        flags: { ...defaults.flags, enemyFirstHitDoubleUsed: true },
      };
      const normalized = normalizePersistedBattleState(saved);
      expect(normalized.currentEnemy.traits.slice(0, enemy.traits.length)).toEqual(enemy.traits);
      expect(normalized.currentEnemy.traits.at(-1)?.title).toBe("Scorching");
      expect(normalized.currentEnemy.traits).toHaveLength(enemy.traits.length + 1);
      expect(normalized).toMatchObject({
        enemyHealth: 17,
        enemyMitigation: saved.enemyMitigation,
        lastEnemyAbilityId: saved.lastEnemyAbilityId,
        flags: saved.flags,
      });
      expect(normalizePersistedBattleState(normalized)).toEqual(normalized);
    },
  );

  it("fills missing gear and flag manifests from defaults", () => {
    const saved = {
      ...defaultBattleState(),
      turn: 4,
      gearEffects: { flatPhysicalDamage: 3 } as ReturnType<typeof defaultBattleState>["gearEffects"],
      flags: { divineAegisTriggered: true } as ReturnType<typeof defaultBattleState>["flags"],
    };

    const normalized = normalizePersistedBattleState(saved);

    expect(normalized.turn).toBe(4);
    expect(normalized.gearEffects).toEqual({ ...defaultBattleState().gearEffects, flatPhysicalDamage: 3 });
    expect(normalized.flags).toEqual({ ...defaultBattleState().flags, divineAegisTriggered: true });
  });

  it("keeps current talent effects while dropping unknown saved fields", () => {
    const defaults = defaultBattleState();
    const normalized = normalizePersistedBattleState({
      talentEffects: {
        ...defaults.talentEffects,
        holyReflectionBlockLostPercent: 30,
        burnDamagePerManaCrystal: MANABURN_DAMAGE_PERCENT,
        holyOnAttackBlocked: 6,
        archeryHolyDamageVsFrozen: 2,
        blockOnConsume: 4,
        cardHealMultipliers: { apple: 1, bread: 1 },
        unknownTalentEffect: 9,
      } as typeof defaults.talentEffects,
    });

    expect(normalized.talentEffects.holyReflectionBlockLostPercent).toBe(30);
    expect(normalized.talentEffects.burnDamagePerManaCrystal).toBe(MANABURN_DAMAGE_PERCENT);
    expect(normalized.talentEffects).not.toHaveProperty("holyOnAttackBlocked");
    expect(normalized.talentEffects).not.toHaveProperty("archeryHolyDamageVsFrozen");
    expect(normalized.talentEffects).not.toHaveProperty("blockOnConsume");
    expect(normalized.talentEffects.cardHealMultipliers).toEqual({ apple: 1, bread: 1 });
    expect(normalized.talentEffects).not.toHaveProperty("unknownTalentEffect");
    expect(normalizePersistedBattleState(normalized).talentEffects).toEqual(normalized.talentEffects);
  });

  it("sanitizes persisted enemy traits", () => {
    const saved = {
      ...defaultBattleState(),
      currentEnemy: {
        ...defaultBattleState().currentEnemy,

        traits: [{ id: "tempered", kind: "combat" as const }] as unknown as ReturnType<
          typeof defaultBattleState
        >["currentEnemy"]["traits"],
      },
    };

    const normalized = normalizePersistedBattleState(saved);

    expect(normalized.currentEnemy.traits.map((trait) => trait.id)).toEqual([
      ...enemyById.skeleton.traits.map((trait) => trait.id),
      "tempered",
    ]);
  });

  it("repairs malformed defenses and control counters while retaining valid live stacks", () => {
    const defaults = defaultBattleState();
    const normalized = normalizePersistedBattleState({
      currentEnemy: enemyById.skeleton,
      playerStatuses: { block: 4, armor: -2, stun: Number.NaN, retiredDefense: 999 } as typeof defaults.playerStatuses,
      enemyStatuses: { burn: 6, poison: Infinity, retiredStatus: 7 } as typeof defaults.enemyStatuses,
      gearEffects: {
        flatPhysicalDamage: Number.NaN,
        flatHolyDamage: -2,
        flatBurnDamage: 1.5,
        retiredDamage: 9,
      } as typeof defaults.gearEffects,
      playerCC: { stunSkipTurns: -1 } as typeof defaults.playerCC,
      enemyCC: { cooldown: Number.NaN, retiredControl: 4 } as typeof defaults.enemyCC,
      enemyMitigation: { armor: -5, block: 3, retiredMitigation: 8 } as typeof defaults.enemyMitigation,
    });
    expect(normalized.playerStatuses).toEqual({ ...defaults.playerStatuses, block: 4 });
    expect(normalized.enemyStatuses).toEqual({ ...defaults.enemyStatuses, burn: 6 });
    expect(normalized.gearEffects).toEqual({ ...defaults.gearEffects, flatBurnDamage: 1.5 });
    expect(
      computeCardDamageToEnemy(
        { ...defaults, ...normalized, rng: () => 0.99, appliesFightPacing: false },
        { kind: "damage", damageType: "physical", amount: 6 },
      ).modifiedDamage,
    ).toBe(3);
    expect(normalized.playerCC).toEqual(defaults.playerCC);
    expect(normalized.enemyCC).toEqual(defaults.enemyCC);
    expect(normalized.enemyMitigation).toEqual({ ...defaults.enemyMitigation, block: 3 });
    expect(normalizePersistedBattleState(normalized)).toEqual(normalized);
  });
});

describe("repairPersistedTrinketManifest (owned by normalize-persisted-battle-state)", () => {
  it("recomputes default trinketEffects from runBoons", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedTrinketManifest(battleState, ["bone-charm"]);
    expect(repaired.trinketEffects.boneCharmHealOnKill).toBe(3);
  });

  it("leaves non-default manifests unchanged", () => {
    const battleState = {
      ...defaultBattleState(),
      trinketEffects: {
        ...defaultBattleState().trinketEffects,
        boneCharmHealOnKill: 9,
      },
    };
    const repaired = repairPersistedTrinketManifest(battleState, ["bone-charm"]);
    expect(repaired.trinketEffects.boneCharmHealOnKill).toBe(9);
  });

  it("drops retired trinket fields when recomputing from runBoons", () => {
    const defaults = defaultBattleState();
    // Simulates a save written before retired fields were removed from the manifest.
    const legacyEffects: TrinketManifest & Record<string, unknown> = {
      ...defaults.trinketEffects,
      blockToArmorThreshold: 6,
      blockToArmorAmount: 1,
      mortarPestleFreeFirstPotion: true,
      grovesFavorStartHeal: 2,
    };
    const battleState = { ...defaults, trinketEffects: legacyEffects };

    const repaired = repairPersistedTrinketManifest(battleState, ["ironwood-buckler", "mortar-and-pestle"]);

    expect(repaired.trinketEffects).toEqual(computeTrinketManifest(["ironwood-buckler", "mortar-and-pestle"]));
    expect(repaired.trinketEffects).not.toHaveProperty("blockToArmorThreshold");
    expect(repaired.trinketEffects).not.toHaveProperty("mortarPestleFreeFirstPotion");
    expect(repaired.trinketEffects).not.toHaveProperty("grovesFavorStartHeal");
  });

  it("no-ops when runBoons is empty", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedTrinketManifest(battleState, []);
    expect(repaired).toBe(battleState);
  });
});
