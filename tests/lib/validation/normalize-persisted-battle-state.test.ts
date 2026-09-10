import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { GEAR_EFFECT_KEYS } from "@/lib/gear";
import { enemyById } from "@/lib/game-data";
import { LEGACY_MANABURN_PER_CRYSTAL_ENABLED, MANABURN_DAMAGE_PERCENT } from "@/lib/game-constants";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";

describe("normalizePersistedBattleState", () => {
  it("retains a running battle's Health, defenses, and old roster across balance updates", () => {
    const saved = {
      ...defaultBattleState(),
      currentEnemy: { ...enemyById["iron-bear"], abilityIds: ["maul", "burning-blade", "plate-mail"] },
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
    expect(normalized.gearEffects.flatPhysicalDamage).toBe(3);
    expect(normalized.flags.divineAegisTriggered).toBe(true);
    for (const key of GEAR_EFFECT_KEYS) {
      if (key === "flatPhysicalDamage") continue;
      expect(normalized.gearEffects[key]).toBe(0);
    }
    expect(normalized.flags.firstHolyCardFreeUsed).toBe(false);
    expect(normalized.flags.emberforgedUsedThisTurn).toBe(false);
    expect(normalized.flags.pendingCinderSkinReaction).toBe(false);
  });

  it("defaults additive enemy trait flags for older battle snapshots", () => {
    const defaults = defaultBattleState();
    const { enemyFirstHitDoubleUsed: _firstHit, enemyBrawlerDamagePenalty: _brawler, ...legacyFlags } = defaults.flags;
    const normalized = normalizePersistedBattleState({
      flags: legacyFlags as unknown as ReturnType<typeof defaultBattleState>["flags"],
    });

    expect(normalized.flags.enemyFirstHitDoubleUsed).toBe(false);
    expect(normalized.flags.enemyBrawlerDamagePenalty).toBe(false);
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

  it("fills empty status and CC records with numeric defaults", () => {
    const normalized = normalizePersistedBattleState({
      playerStatuses: {} as ReturnType<typeof defaultBattleState>["playerStatuses"],
      enemyStatuses: {} as ReturnType<typeof defaultBattleState>["enemyStatuses"],
      playerCC: {} as ReturnType<typeof defaultBattleState>["playerCC"],
      enemyCC: {} as ReturnType<typeof defaultBattleState>["enemyCC"],
      enemyMitigation: {} as ReturnType<typeof defaultBattleState>["enemyMitigation"],
    });

    expect(normalized.playerStatuses.block).toBe(0);
    expect(normalized.playerStatuses.armor).toBe(0);
    expect(normalized.enemyStatuses.burn).toBe(0);
    expect(normalized.playerCC.stunSkipTurns).toBe(0);
    expect(normalized.enemyCC.cooldown).toBe(0);
    expect(normalized.enemyMitigation.armor).toBe(0);
  });

  it("keeps live stacks while filling omitted status keys", () => {
    const normalized = normalizePersistedBattleState({
      playerStatuses: { block: 4 } as ReturnType<typeof defaultBattleState>["playerStatuses"],
    });

    expect(normalized.playerStatuses.block).toBe(4);
    expect(normalized.playerStatuses.armor).toBe(0);
    expect(normalized.playerStatuses.stun).toBe(0);
  });

  it("coerces a legacy healthThresholdArmor object into an array", () => {
    const saved = {
      ...defaultBattleState(),
      talentEffects: {
        ...defaultBattleState().talentEffects,
        healthThresholdArmor: { threshold: 50, amount: 5 },
      } as unknown as ReturnType<typeof defaultBattleState>["talentEffects"],
    };

    const normalized = normalizePersistedBattleState(saved);
    expect(normalized.talentEffects.healthThresholdArmor).toEqual([{ threshold: 50, amount: 5 }]);
  });

  it("migrates legacy talent snapshots onto co-located magnitude fields", () => {
    const defaults = defaultBattleState().talentEffects;
    const {
      bleedExecuteMultiplier: _bleedExecuteMultiplier,
      wishBlockAmount: _wishBlockAmount,
      firstBurnCardBonusMultiplier: _firstBurnCardBonusMultiplier,
      ...legacyFields
    } = defaults;
    const normalized = normalizePersistedBattleState({
      talentEffects: {
        ...legacyFields,
        firstBurnCardDoubled: true,
        bleedExecuteThreshold: 30,
        wishBlockBelowHealthPct: 30,
        burnDamagePerManaCrystal: LEGACY_MANABURN_PER_CRYSTAL_ENABLED,
      } as ReturnType<typeof defaultBattleState>["talentEffects"] & { firstBurnCardDoubled: boolean },
    });

    expect(normalized.talentEffects.firstBurnCardBonusMultiplier).toBe(1.5);
    expect(normalized.talentEffects.bleedExecuteMultiplier).toBe(2);
    expect(normalized.talentEffects.wishBlockAmount).toBe(6);
    expect(normalized.talentEffects.burnDamagePerManaCrystal).toBe(MANABURN_DAMAGE_PERCENT);
  });

  it("does not rewrite an already-percent Manaburn snapshot", () => {
    const defaults = defaultBattleState().talentEffects;
    const normalized = normalizePersistedBattleState({
      talentEffects: {
        ...defaults,
        burnDamagePerManaCrystal: MANABURN_DAMAGE_PERCENT,
      },
    });

    expect(normalized.talentEffects.burnDamagePerManaCrystal).toBe(MANABURN_DAMAGE_PERCENT);
  });

  it("migrates receiveHalfFreezeBuildUp onto receiveHalfFreezeDamage", () => {
    const defaults = defaultBattleState().talentEffects;
    const normalized = normalizePersistedBattleState({
      talentEffects: {
        ...defaults,
        receiveHalfFreezeDamage: false,
        receiveHalfFreezeBuildUp: true,
      } as ReturnType<typeof defaultBattleState>["talentEffects"] & { receiveHalfFreezeBuildUp: boolean },
    });

    expect(normalized.talentEffects.receiveHalfFreezeDamage).toBe(true);
  });
});

it("preserves the spent Emberforged trigger when resuming a turn", () => {
  const state = defaultBattleState();
  state.flags.emberforgedUsedThisTurn = true;
  expect(normalizePersistedBattleState(state).flags.emberforgedUsedThisTurn).toBe(true);
});
