import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { GEAR_EFFECT_KEYS } from "@/lib/gear";
import { LEGACY_MANABURN_PER_CRYSTAL_ENABLED, MANABURN_DAMAGE_PERCENT } from "@/lib/game-constants";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";

describe("normalizePersistedBattleState", () => {
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
  });

  it("defaults additive enemy trait flags for older battle snapshots", () => {
    const defaults = defaultBattleState();
    const {
      enemyFirstHitDoubleUsed: _firstHit,
      enemyNextAttackCrit: _crit,
      enemyNextAttackBonus: _bonus,
      enemyNextAttackHolyBonus: _holyBonus,
      enemyBrawlerDamagePenalty: _brawler,
      ...legacyFlags
    } = defaults.flags;
    const normalized = normalizePersistedBattleState({
      flags: legacyFlags as unknown as ReturnType<typeof defaultBattleState>["flags"],
    });

    expect(normalized.flags.enemyFirstHitDoubleUsed).toBe(false);
    expect(normalized.flags.enemyNextAttackCrit).toBe(false);
    expect(normalized.flags.enemyNextAttackBonus).toBe(0);
    expect(normalized.flags.enemyNextAttackHolyBonus).toBe(0);
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

    expect(normalized.currentEnemy.traits.map((trait) => trait.id)).toEqual(["tempered"]);
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
