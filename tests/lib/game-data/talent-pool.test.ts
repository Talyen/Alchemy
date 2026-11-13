import { describe, expect, it } from "vitest";
import { TALENT_ICONS } from "@/features/alchemy/shared/config";
import {
  talentPool,
  getTalentsForKeyword,
  getAllocatableTalentChoices,
  getTalentRows,
  normalizeUnlockedTalents,
  computeTalentEffects,
  DEFAULT_TALENT_EFFECTS,
  canUnlockTalent,
  tryUnlockTalent,
  getTalentTreeKeywordIds,
} from "@/lib/game-data";

describe("talent row layout", () => {
  it("offers exactly the unpurchased talents whose prerequisites allow an actual unlock", () => {
    for (const keyword of getTalentTreeKeywordIds()) {
      const talents = getTalentsForKeyword(keyword);
      // Saved later purchases must not unlock an unfinished earlier row.
      const allIds = talents.map((talent) => talent.id);
      const partialRows = [0, 2, 6, 9].map((missing) => allIds.filter((_, index) => index !== missing));
      const rows = [talents.slice(0, 1), talents.slice(1, 3), talents.slice(3, 6), talents.slice(6, 10)];
      expect(getTalentRows(keyword), keyword).toEqual(rows);
      for (const purchased of [[], ...partialRows, allIds]) {
        const offers = getAllocatableTalentChoices(keyword, purchased);
        const expected = rows.find((row) => row.some((talent) => !purchased.includes(talent.id))) ?? [];
        expect(offers, keyword).toEqual(expected.filter((talent) => !purchased.includes(talent.id)));
        const unlockable = talents.filter(
          (talent) => canUnlockTalent(keyword, talent.id, { [keyword]: 100_000 }, { [keyword]: purchased }).ok,
        );
        expect(unlockable, `${keyword}: ${purchased.join(",")}`).toEqual(offers);
      }
    }
  });

  it("keeps displayed choices and unlock validation aligned after purchases beyond a partial row", () => {
    const talents = getTalentsForKeyword("physical");
    const missing = talents[2]!;
    const unlocked = talents.filter((talent) => talent !== missing).map((talent) => talent.id);
    const saved = [...unlocked, "unknown", unlocked[0]!];
    expect(getAllocatableTalentChoices("physical", saved)).toEqual([missing]);
    expect(canUnlockTalent("physical", missing.id, { physical: 2000 }, { physical: saved })).toEqual({ ok: true });
    expect(tryUnlockTalent("physical", missing.id, { physical: 2000 }, { physical: saved })).toEqual({
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
    const empty = computeTalentEffects({});
    expect(empty).toEqual(DEFAULT_TALENT_EFFECTS);
    empty.cardHealMultipliers.slash = 999;
    empty.companionBondLevels.wolf = 999;
    empty.healthThresholdArmor.push({ threshold: 25, amount: 999 });
    expect(computeTalentEffects({})).toEqual(DEFAULT_TALENT_EFFECTS);

    const unlocked = {
      armor: ["armor-mitigate-stun"],
      consume: ["consume-feast"],
      dodge: ["dodge-lightfoot", "dodge-unburdened"],
    };
    const first = computeTalentEffects(unlocked);
    const expected = structuredClone(first);
    expect(first).toMatchObject({ dodgeChance: 5, cleanseCcOnDodge: true });
    first.healthThresholdArmor[0]!.amount = 999;
    first.healthThresholdArmor.push({ threshold: 25, amount: 999 });
    first.cardHealMultipliers.apple = 999;
    expect(computeTalentEffects(unlocked)).toEqual(expected);
    const effects = talentPool.find((talent) => talent.id === unlocked.armor[0])!.effects!;
    expect(effects.healthThresholdArmor).toEqual([{ threshold: 50, amount: 3 }]);
  });

  it("counts each valid purchase once across save repair and combat aggregation", () => {
    const purchases = { armor: ["armor-mitigate-stun", "armor-mitigate-stun"], physical: ["physical-brute-force"] };
    const saved = { ...purchases, burn: ["physical-brute-force", "unknown-talent"] };
    const normalized = { ...purchases, armor: ["armor-mitigate-stun"] };
    expect(normalizeUnlockedTalents(saved)).toEqual(normalized);
    expect(computeTalentEffects(saved)).toEqual(computeTalentEffects(normalized));
    expect(saved.armor).toHaveLength(2);
  });
});

it("combat feedback talent progression preserves an already-purchased connector without granting its new prerequisites", () => {
  const purchased = { holy: ["holy-tithe"] };
  expect(normalizeUnlockedTalents(purchased)).toEqual(purchased);
  expect(computeTalentEffects(purchased).holyGoldChance).toBe(10);
  expect(getAllocatableTalentChoices("holy", purchased.holy).map((talent) => talent.name)).toEqual(["Faith Barrier"]);
});

it("talent icon registry resolves every authored talent icon id", () => {
  const missing = talentPool
    .filter((talent) => talent.icon)
    .filter((talent) => !(talent.icon && talent.icon in TALENT_ICONS))
    .map((talent) => `${talent.id}:${talent.icon}`);
  expect(missing).toEqual([]);
});
