import { describe, expect, it } from "vitest";
import { TALENT_ICONS } from "@/features/alchemy/shared/config";
import {
  talentPool,
  getTalentsForKeyword,
  getAllocatableTalentChoices,
  getTalentRows,
  normalizeUnlockedTalents,
  computeTalentEffects,
  canUnlockTalent,
  tryUnlockTalent,
  isTalentPlaceholder,
  getTalentTreeKeywordIds,
} from "@/lib/game-data";

describe("talent row layout", () => {
  it("offers exactly the unpurchased talents whose prerequisites allow an actual unlock", () => {
    for (const keyword of getTalentTreeKeywordIds()) {
      const talents = getTalentsForKeyword(keyword);
      // Saved later purchases must not unlock an unfinished earlier row.
      const allIds = talents.map((talent) => talent.id);
      const partialRows = [0, 2, 6, 9].map((missing) => allIds.filter((_, index) => index !== missing));
      for (const purchased of [[], ...partialRows, allIds]) {
        const offers = getAllocatableTalentChoices(keyword, purchased);
        const rows = getTalentRows(keyword).map((row) => row.filter((talent) => !isTalentPlaceholder(talent)));
        const expected = rows.find((row) => row.some((talent) => !purchased.includes(talent.id))) ?? [];
        expect(offers, keyword).toEqual(expected.filter((talent) => !purchased.includes(talent.id)));
        for (const talent of talents) {
          expect(canUnlockTalent(keyword, talent.id, { [keyword]: 100_000 }, { [keyword]: purchased }).ok).toBe(
            offers.includes(talent),
          );
        }
      }
    }
  });

  it("keeps displayed choices and unlock validation aligned after purchases beyond a partial row", () => {
    const talents = getTalentsForKeyword("physical");
    const missing = talents[2]!;
    const unlocked = talents.filter((talent) => talent !== missing).map((talent) => talent.id);
    const saved = [...unlocked, "unknown", unlocked[0]!];
    expect(getAllocatableTalentChoices("physical", saved)).toEqual([missing]);
    expect(canUnlockTalent("physical", missing.id, { physical: 2000 }, { physical: unlocked })).toEqual({ ok: true });
    expect(tryUnlockTalent("physical", missing.id, { physical: 2000 }, { physical: unlocked })).toEqual({
      unlockedTalents: { physical: [...unlocked, missing.id] },
    });
    expect(getAllocatableTalentChoices("physical", [...unlocked, missing.id])).toEqual([]);
  });
});

describe("canUnlockTalent", () => {
  it("rejects unknown talent ids", () => {
    expect(canUnlockTalent("burn", "unknown-talent", { burn: 100 }, {}).ok).toBe(false);
  });

  it("rejects keyword mismatch", () => {
    expect(canUnlockTalent("burn", "physical-brute-force", { physical: 100 }, {}).ok).toBe(false);
  });

  it("rejects unlock without unspent points", () => {
    expect(canUnlockTalent("physical", "physical-brute-force", {}, {}).ok).toBe(false);
  });
});

describe("computeTalentEffects", () => {
  it("owns nested talent values so one battle cannot change later battles or the catalog", () => {
    const unlocked = { armor: ["armor-mitigate-stun"], consume: ["consume-feast"] };
    const first = computeTalentEffects(unlocked);
    const expected = structuredClone(first);
    first.healthThresholdArmor[0]!.amount = 999;
    first.healthThresholdArmor.push({ threshold: 25, amount: 999 });
    first.cardHealMultipliers.apple = 999;
    expect(computeTalentEffects(unlocked)).toEqual(expected);
    const operation = talentPool.find((talent) => talent.id === unlocked.armor[0])!.effects![0]!;
    expect(operation).toMatchObject({ value: [{ threshold: 50, amount: 3 }] });
  });

  it("ignores talent ids saved under the wrong keyword", () => {
    const effects = computeTalentEffects({ burn: ["physical-brute-force"] });
    expect(effects.flatPhysicalDamage).toBe(0);
  });

  it("keeps the low-Health cleanse distinct from Armor thresholds", () => {
    const effects = computeTalentEffects({
      physical: ["physical-shield-bash"],
      block: ["block-to-physical"],
      nature: ["nature-verdant-cycle"],
      leech: ["leech-nature-chance"],
      gold: ["gold-on-wish"],
      wish: ["wish-gold"],
      health: ["health-threshold-armor"],
      armor: ["armor-mitigate-stun"],
    });

    expect(effects.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
    expect(effects.physicalStripArmorWhileBlocked).toBe(false);
    expect(effects.natureLeechChance).toBe(10);
    expect(effects.afflictionLeechBonusPercent).toBe(10);
    expect(effects.goldOnWish).toBe(7);
    expect(effects.goldOnWishChance).toBe(10);
    expect(effects.declinedWishCardChance).toBe(10);
    expect(effects.cleanseBelowHealthPercent).toBe(25);
    expect(effects.healthThresholdArmor).toHaveLength(1);
    expect(effects.healthThresholdArmor).toEqual(expect.arrayContaining([{ threshold: 50, amount: 3 }]));
  });
});

describe("combat feedback talent progression", () => {
  it("preserves an already-purchased connector without granting its new prerequisites", () => {
    const purchased = { holy: ["holy-tithe"] };
    expect(normalizeUnlockedTalents(purchased)).toEqual(purchased);
    expect(computeTalentEffects(purchased).holyGoldChance).toBe(10);
    expect(getAllocatableTalentChoices("holy", purchased.holy).map((talent) => talent.name)).toEqual(["Faith Barrier"]);
  });
});

describe("talent icon registry", () => {
  it("resolves every authored talent icon id", () => {
    const missing = talentPool
      .filter((talent) => talent.icon)
      .filter((talent) => !(talent.icon && talent.icon in TALENT_ICONS))
      .map((talent) => `${talent.id}:${talent.icon}`);
    expect(missing).toEqual([]);
  });
});
