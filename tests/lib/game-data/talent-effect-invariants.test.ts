import { describe, expect, it } from "vitest";
import {
  computeTalentEffects,
  createEmptyTalentEffectManifest,
  DEFAULT_TALENT_EFFECTS,
  isTalentPlaceholder,
  talentPool,
  type TalentEffectManifest,
  type TalentEffectOperation,
} from "@/lib/game-data";
import {
  HOMESTEAD_BATTLE_BOOLEAN_KEYS,
  HOMESTEAD_BATTLE_NUMERIC_KEYS,
  HOMESTEAD_BATTLE_RECORD_KEYS,
} from "@/lib/homestead/types";

const LEGACY_SNAPSHOT_FIELDS: ReadonlyArray<keyof TalentEffectManifest> = [
  "partingCutOnDodge",
  "blockOnDodgeEqualToAttack",
  "physicalOnDodgeEqualToAttack",

  "archeryBleedChance",
  "archeryDoubledVsFrozen",
  "archeryDoubledVsStunned",
  "bleedPoisonChance",
  "consumeBurnDamageBonusPercent",
  "dodgeChanceWhileEnemyBurning",
  "dodgeChanceWithoutBlock",
  "drawOnConsume",
  "firstArcheryCardFree",
  "firstBleedCardFree",
  "firstBurnCardBonusMultiplier",
  "firstCompanionCardFree",
  "firstConsumeCardFree",
  "firstHolyCardFree",
  "firstPoisonCardFree",
  "goldOnFirstPoison",
  "holyBurnChance",
  "natureBonusVsPoisoned",
  "physicalDoubledVsFrozen",
  "physicalDoubledVsStunned",
  "poisonOnConsume",
  "poisonCardPhysicalVsPoisoned",
  "poisonPhysicalBonus",
  "poisonStripArmor",
  "flatStunDamage",

  "manaNextTurnOnWish",
  "stunBuildupReductionPercent",
  "blockReduceBurnDamage",
  "campfireHealBonus",
  "blockToBurnDamage",
  "eliteGoldDropBonus",
  "companionGoldFindActive",
  "archeryPlayTwiceChance",
  "receiveHalfNatureDamage",
  "companionBleedDamageBonus",
  "dodgeBlockPercent",
  "consumeDetonatesBurn",
  "archeryPhysicalWithoutBlock",
  "blockOnArmorCard",
  "cleansePoisonOnBurnCard",
  "drawPhysicalOnBleedTick",
  "consecutiveArcheryPhysicalDamage",
  "wishExtraChoices",
  "wishDrawsCard",
  "blockPerDeclinedWishCard",
  "blockPreventsBleed",
  "blockPreventsPoison",
  "blockOnCompanionDamage",
  "bleedPoisonDamageTakenBonus",
  "companionFreezeDamageVsFrozen",
  "shopFreeRefresh",
  "startGold",
  "armorOnPotionCard",
  "blockPerGold",
  "blockOnHolyCard",
  "healthThresholdBlock",
  "maxHealthPerCombat",
  "wishExtraChoiceAfterHolyCard",
  "holyBlockPercentFromDamage",
  "burnDamagePerManaCrystal",
  "freezeDamagePerManaCrystal",
  "companionDamagePerManaCrystal",
  "healOnManaGain",
  "armorNatureDamagePercent",
  "dodgePhysicalDamagePercent",
  "physicalLowHealthDamageBonusPercent",
  "poisonOnNatureCardVsPoisoned",
  "physicalLeechVsStunned",
  "naturePoisonDamageChance",
  "physicalBleedDamageChance",
  "thornsOnNatureCard",
  "physicalAfterNatureBleedDamage",
  "physicalStripArmorWhileBlocked",
  "healOnNatureCard",
];

const UNUSED_MANIFEST_ALLOWLIST: ReadonlySet<keyof TalentEffectManifest> = new Set([
  ...LEGACY_SNAPSHOT_FIELDS,
  "bleedPhysicalBonus",
  "goldPerCombat",
  "blockOnNatureCard",
  "bleedExecuteThreshold",
  "bleedExecuteMultiplier",
  "potionMixPotency",
  "wishGemsGold",
  "runMaxManaBonus",
]);

const HOMESTEAD_KEYS = new Set<string>([
  ...HOMESTEAD_BATTLE_NUMERIC_KEYS,
  ...HOMESTEAD_BATTLE_BOOLEAN_KEYS,
  ...HOMESTEAD_BATTLE_RECORD_KEYS,
]);

function talentWrittenFields(): Set<keyof TalentEffectManifest> {
  const fields = new Set<keyof TalentEffectManifest>();
  for (const talent of talentPool) {
    if (isTalentPlaceholder(talent)) continue;
    for (const effect of talent.effects ?? []) {
      fields.add(effect.field);
    }
  }
  return fields;
}

describe("talent effect invariants", () => {
  it("every manifest field is written by a talent, homestead, or the unused allowlist", () => {
    const written = talentWrittenFields();
    const unused = Object.keys(DEFAULT_TALENT_EFFECTS).filter((key) => {
      const field = key as keyof TalentEffectManifest;
      return !written.has(field) && !HOMESTEAD_KEYS.has(key) && !UNUSED_MANIFEST_ALLOWLIST.has(field);
    });
    expect(unused).toEqual([]);
  });

  it("allowlist entries are actually unused", () => {
    const written = talentWrittenFields();
    for (const field of UNUSED_MANIFEST_ALLOWLIST) {
      expect(written.has(field), `${field} is written and should leave the allowlist`).toBe(false);
      expect(HOMESTEAD_KEYS.has(field), `${field} is a homestead key and should leave the allowlist`).toBe(false);
    }
  });

  it("non-boolean set fields have a single writer unless they concatenate as arrays", () => {
    const writers = new Map<string, string[]>();
    for (const talent of talentPool) {
      if (isTalentPlaceholder(talent)) continue;
      for (const effect of talent.effects ?? []) {
        if (effect.kind !== "set") continue;
        if (typeof effect.value === "boolean") continue;
        const list = writers.get(effect.field) ?? [];
        list.push(talent.id);
        writers.set(effect.field, list);
      }
    }

    const collisions = [...writers.entries()].filter(([field, ids]) => {
      if (ids.length <= 1) return false;
      const sample = talentPool
        .find((talent) => talent.id === ids[0])
        ?.effects?.find((effect) => effect.kind === "set" && effect.field === field);
      return !Array.isArray(sample && "value" in sample ? sample.value : null);
    });

    expect(collisions.map(([field, ids]) => `${field}: ${ids.join(", ")}`)).toEqual([]);
  });

  it("computeTalentEffects applies each talent's declared operations", () => {
    const empty = createEmptyTalentEffectManifest();
    for (const talent of talentPool) {
      if (isTalentPlaceholder(talent) || !talent.effects?.length) continue;
      const computed = computeTalentEffects({ [talent.keywordId]: [talent.id] });
      for (const effect of talent.effects) {
        assertEffectApplied(empty, computed, effect, talent.id);
      }
    }
  });

  it("every non-placeholder talent has at least one effect", () => {
    const missing = talentPool.filter(
      (talent) => !isTalentPlaceholder(talent) && (!talent.effects || talent.effects.length === 0),
    );
    expect(missing.map((t) => t.id)).toEqual([]);
  });

  it("placeholder talents never declare effects", () => {
    const invalid = talentPool.filter(
      (talent) => isTalentPlaceholder(talent) && talent.effects && talent.effects.length > 0,
    );
    expect(invalid.map((t) => t.id)).toEqual([]);
  });

  it("isolates every mutable manifest default across battles", () => {
    const first = createEmptyTalentEffectManifest();
    const next = createEmptyTalentEffectManifest();
    const before = structuredClone(next);
    first.cardHealBonus.slash = 99;
    first.cardHealMultipliers.slash = 99;
    first.companionBondLevels.wolf = 99;
    first.healthThresholdArmor.push({ threshold: 50, amount: 3 });
    expect(next).toEqual(before);
    expect(DEFAULT_TALENT_EFFECTS).toEqual(before);
  });
});

function assertEffectApplied(
  empty: TalentEffectManifest,
  computed: TalentEffectManifest,
  effect: TalentEffectOperation,
  talentId: string,
) {
  if (effect.kind === "add") {
    expect(computed[effect.field], `${talentId} ${effect.field}`).toBe(empty[effect.field] + effect.amount);
    return;
  }
  if (Array.isArray(effect.value)) {
    expect(computed[effect.field], `${talentId} ${effect.field}`).toEqual(effect.value);
    return;
  }
  expect(computed[effect.field], `${talentId} ${effect.field}`).toEqual(effect.value);
}
