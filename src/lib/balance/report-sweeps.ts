import { resolveLootWeights } from "@/lib/loot";
import {
  cardLibrary,
  characters,
  companionLibrary,
  computeTalentEffects,
  getCardKeywords,
  trinketLibrary,
  type BattleCard,
  type CompanionId,
} from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { effectsForInstance, generateLootGearChoices, gearBaseItemList } from "@/lib/gear";
import { gearAffixList } from "@/lib/gear/affix-catalog";
import { effectsForAffixRolls } from "@/lib/gear/affixes";
import { defaultGearEffects } from "@/lib/gear/gear-effect-manifest";
import { createRunStreamRng, sampleItems } from "@/lib/rng";
import {
  buildClassSimDeck,
  cardMatchesAffinity,
  insertCardIntoDeck,
  removeCardIdFromDeck,
  removeCompanionSummonFromDeck,
} from "./class-deck";
import { SIM_GEAR_ROLL_DEPTH, SIM_GEAR_ROLL_SOURCE } from "./gear-preset";
import { companionIdsFromDeck } from "./homestead-preset";
import {
  balanceScenarioSeed,
  BOON_GAUNTLET,
  gauntletDepthDeltaFor,
  IN_CLASS_CARD_GAUNTLET,
  reportCharacterIds,
  REPORT_TIERS,
} from "./report-catalog";
import type { PairedTierRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { runPairedSweep, type PairedSweepGroup } from "./report-sweep-runner";
import { buildPresetUnlockedTalents, combatTalentsInPoolOrder, withTalent, withoutTalent } from "./talent-preset";

export { IN_CLASS_CARD_GAUNTLET };
export { buildBalanceBatchConfig } from "./report-sweep-runner";

function buildRandomDeck(seed: number, size = 10): BattleCard[] {
  return sampleItems(getOfferableCardPool(), size, createRunStreamRng(seed, "world"));
}

function buildCardIsolationDecks(
  target: BattleCard,
  seed: number,
  size = 10,
): { baseline: BattleCard[]; treatment: BattleCard[] } {
  const candidates = getOfferableCardPool().filter((card) => card.id !== target.id);
  const baseline = sampleItems(candidates, size, createRunStreamRng(seed, "world"));
  return { baseline, treatment: [...baseline.slice(0, size - 1), target] };
}

function* trinketGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      for (const scenario of BOON_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const deckSeed = balanceScenarioSeed("boon-deck", tier.preset, characterId, scenario.enemyId, depth);
        const fightSeed = balanceScenarioSeed("boon-fight", tier.preset, characterId, scenario.enemyId, depth);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed: fightSeed,
          deck: buildRandomDeck(deckSeed),
          iterations: options.pairedIterations,
        };
        yield {
          reference: { ...shared, trinketIds: [] },
          variants: trinketLibrary.map((trinket) => ({
            id: trinket.id,
            scenario: { ...shared, trinketIds: [trinket.id] },
          })),
        };
      }
    }
  }
}

export function runTrinketSweep(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, trinketGroups(options));
}

function* isolatedCardGroups(options: ReportRunOptions, enemyId: string): Iterable<PairedSweepGroup> {
  const ids = reportCharacterIds();
  const depthDelta = gauntletDepthDeltaFor(enemyId);
  const iterations = Math.min(
    options.pairedIterations,
    Math.max(options.mode === "quick" ? 3 : 1, Math.floor(options.iterations / 10) || 1),
  );
  for (const tier of REPORT_TIERS) {
    for (let index = 0; index < options.cardDeckSamples; index += 1) {
      const characterId = ids[index % ids.length] ?? ids[0];
      if (!characterId) continue;
      const deckSeed = balanceScenarioSeed("card-isolated-deck", tier.preset, enemyId, index);
      const seed = balanceScenarioSeed("card-isolated-fight", tier.preset, characterId, enemyId, index);
      const shared = {
        characterId,
        enemyId,
        depth: tier.depthOffset + depthDelta,
        preset: tier.preset,
        seed,
        trinketIds: [],
        iterations,
      };
      for (const card of cardLibrary) {
        const decks = buildCardIsolationDecks(card, deckSeed);
        yield {
          reference: { ...shared, deck: decks.baseline },
          variants: [{ id: card.id, scenario: { ...shared, deck: decks.treatment } }],
        };
      }
    }
  }
}

export function runCardSweepIsolated(options: ReportRunOptions, enemyId: string): PairedTierRow[] {
  return runPairedSweep(options, isolatedCardGroups(options, enemyId));
}

function* inClassCardGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  const iterations = Math.min(
    options.pairedIterations,
    Math.max(options.mode === "quick" ? 3 : 1, Math.floor(options.iterations / 5) || 1),
  );
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("card-in-class-deck", tier.preset, characterId);
      const affinity = characters[characterId].keywords;
      const baseDeck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      for (const scenario of IN_CLASS_CARD_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const fightSeed = balanceScenarioSeed("card-in-class-fight", tier.preset, characterId, scenario.enemyId, depth);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed: fightSeed,
          trinketIds: [],
          iterations,
        };
        yield {
          reference: { ...shared, deck: baseDeck },
          variants: cardLibrary.flatMap((card) => {
            const keywords = getCardKeywords(card);
            const matches = characterId === "wildcard" || keywords.length === 0 || cardMatchesAffinity(card, affinity);
            if (!matches) return [];
            const alreadyInDeck = baseDeck.some((entry) => entry.id === card.id);
            return [
              {
                id: card.id,
                scenario: {
                  ...shared,
                  deck: alreadyInDeck ? removeCardIdFromDeck(baseDeck, card.id) : insertCardIntoDeck(baseDeck, card),
                },
                referenceSide: alreadyInDeck ? ("treatment" as const) : ("baseline" as const),
              },
            ];
          }),
        };
      }
    }
  }
}

export function runCardSweepInClass(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, inClassCardGroups(options));
}

function* talentGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("talent-deck", tier.preset, characterId);
      const keywords = characters[characterId].keywords;
      const unlocked = buildPresetUnlockedTalents(keywords, tier.preset);
      const talents = keywords.flatMap((keyword) => combatTalentsInPoolOrder(keyword));
      const deck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      const baseEffects = computeTalentEffects(unlocked);
      const talentSpecs = talents.map((talent) => {
        const isUnlocked = (unlocked[talent.keywordId] ?? []).includes(talent.id);
        const variantEffects = computeTalentEffects(
          isUnlocked ? withoutTalent(unlocked, talent) : withTalent(unlocked, talent),
        );
        return { talent, isUnlocked, variantEffects };
      });
      for (const scenario of BOON_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed: balanceScenarioSeed("talent-fight", tier.preset, characterId, scenario.enemyId, depth),
          deck,
          iterations: options.pairedIterations,
        };
        yield {
          reference: { ...shared, talentEffects: baseEffects },
          variants: talentSpecs.map(({ talent, isUnlocked, variantEffects }) => ({
            id: talent.id,
            scenario: { ...shared, talentEffects: variantEffects },
            referenceSide: isUnlocked ? ("treatment" as const) : ("baseline" as const),
          })),
        };
      }
    }
  }
}

export function runTalentSweep(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, talentGroups(options));
}

function summonCards(): BattleCard[] {
  return cardLibrary.filter((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
}

function* companionGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  const summons = summonCards();
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("companion-deck", tier.preset, characterId);
      const classKeywords = characters[characterId].keywords;
      const deck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      const deckCompanions = companionIdsFromDeck(deck);
      const specs = summons.flatMap((card) => {
        const effect = card.effects.find((candidate) => candidate.kind === "summon-companion");
        if (!effect || effect.kind !== "summon-companion") return [];
        const companionId: CompanionId = effect.companionId;
        if (!(companionId in companionLibrary)) return [];
        if (
          !classKeywords.includes("companion") &&
          !deckCompanions.includes(companionId) &&
          !cardMatchesAffinity(card, classKeywords)
        )
          return [];
        const baselineDeck = removeCompanionSummonFromDeck(deck, companionId);
        const alreadyInDeck = deck.some((entry) =>
          entry.effects.some(
            (candidate) => candidate.kind === "summon-companion" && candidate.companionId === companionId,
          ),
        );
        return [{ companionId, baselineDeck, treatmentDeck: insertCardIntoDeck(baselineDeck, card), alreadyInDeck }];
      });
      for (const scenario of BOON_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed: balanceScenarioSeed("companion-fight", tier.preset, characterId, scenario.enemyId, depth),
          iterations: options.pairedIterations,
        };
        const absent = specs.filter((spec) => !spec.alreadyInDeck);
        if (absent.length > 0) {
          yield {
            reference: { ...shared, deck },
            variants: absent.map(({ companionId, treatmentDeck }) => ({
              id: companionId,
              scenario: { ...shared, deck: treatmentDeck },
            })),
          };
        }
        for (const { companionId, baselineDeck, treatmentDeck, alreadyInDeck } of specs) {
          if (!alreadyInDeck) continue;
          yield {
            reference: { ...shared, deck: baselineDeck },
            variants: [{ id: companionId, scenario: { ...shared, deck: treatmentDeck } }],
          };
        }
      }
    }
  }
}

export function runCompanionSweep(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, companionGroups(options));
}

function* gearGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  const lootWeights = resolveLootWeights({
    source: SIM_GEAR_ROLL_SOURCE,
    progress: { depth: SIM_GEAR_ROLL_DEPTH, highestCompletedDifficulty: null },
  });
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const keywords = characters[characterId].keywords;
      const deckSeed = balanceScenarioSeed("gear-deck", tier.preset, characterId);
      const deck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      for (const scenario of BOON_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const seed = balanceScenarioSeed("gear-fight", tier.preset, characterId, scenario.enemyId, depth);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed,
          deck,
          iterations: options.pairedIterations,
        };
        const variants = gearBaseItemList.flatMap((item) => {
          const matches =
            keywords.length === 0 ||
            item.affinityKeywords.length === 0 ||
            item.affinityKeywords.some((keyword) => keywords.includes(keyword));
          if (!matches) return [];
          const rng = createRunStreamRng(seed, "rewards");
          const instance = generateLootGearChoices(1, rng, lootWeights, new Set(), [item.id])[0];
          return [
            {
              id: item.id,
              scenario: { ...shared, gearEffects: instance ? effectsForInstance(instance) : defaultGearEffects },
            },
          ];
        });
        yield { reference: { ...shared, gearEffects: defaultGearEffects }, variants };
      }
    }
  }
}

export function runGearSweep(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, gearGroups(options));
}

function* affixGroups(options: ReportRunOptions): Iterable<PairedSweepGroup> {
  for (const tier of REPORT_TIERS) {
    const tierAffixes = gearAffixList.map((affix) => {
      const rarity = affix.uniqueOnly ? "unique" : tier.preset === "late" ? "astral" : "basic";
      const range = affix.roll[rarity];
      const value = Math.round((range.min + range.max) / 2);
      return { id: affix.id, gearEffects: effectsForAffixRolls([{ id: affix.id, value }], rarity) };
    });
    for (const characterId of reportCharacterIds()) {
      for (let deckIndex = 0; deckIndex < options.deckSeeds; deckIndex += 1) {
        const deck = buildClassSimDeck(
          characterId,
          tier.preset,
          balanceScenarioSeed("affix-deck", tier.preset, characterId, deckIndex),
        );
        for (const scenario of BOON_GAUNTLET) {
          const depth = tier.depthOffset + scenario.depthDelta;
          const shared = {
            characterId,
            enemyId: scenario.enemyId,
            depth,
            preset: tier.preset,
            deck,
            seed: balanceScenarioSeed("affix-fight", tier.preset, characterId, scenario.enemyId, depth, deckIndex),
            iterations: options.pairedIterations,
          };
          yield {
            reference: { ...shared, gearEffects: defaultGearEffects },
            variants: tierAffixes.map(({ id, gearEffects }) => ({ id, scenario: { ...shared, gearEffects } })),
          };
        }
      }
    }
  }
}

export function runAffixSweep(options: ReportRunOptions): PairedTierRow[] {
  return runPairedSweep(options, affixGroups(options));
}
