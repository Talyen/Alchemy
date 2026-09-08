import {
  cardLibrary,
  characters,
  companionLibrary,
  computeTalentEffects,
  getCardKeywords,
  trinketLibrary,
  type BattleCard,
  type CharacterId,
  type CompanionId,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import {
  generateGearInstanceForBaseItem,
  gearBaseItemList,
  gearInstanceRarity,
  type GearEffectManifest,
} from "@/lib/gear";
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
import { combatTalentsInPoolOrder } from "./combat-talent";
import { companionIdsFromDeck } from "./homestead-preset";
import {
  balanceScenarioSeed,
  BOON_GAUNTLET,
  reportCharacterIds,
  reportTierForPreset,
  reportTierRecord,
  REPORT_TIERS,
} from "./report-catalog";
import type { PairedTierRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { combinePairedWinStats, makePairedDelta, pairedWinStats, type PairedWinStats } from "./report-rankings";
import { simulateWinSeries, type WinSeries } from "./simulator-batch";
import type { BalanceBatchConfig } from "./simulator-types";
import { buildPresetUnlockedTalents, withTalent, withoutTalent } from "./talent-preset";
import type { TalentPreset } from "./types";

interface BalanceScenarioConfig {
  characterId: CharacterId;
  enemyId: string;
  depth: number;
  preset: TalentPreset;
  seed: number;
  deck?: BattleCard[];
  trinketIds?: string[];
  gearEffects?: GearEffectManifest;
  talentEffects?: TalentEffectManifest;
  iterations?: number;
}

export function buildBalanceBatchConfig(options: ReportRunOptions, config: BalanceScenarioConfig): BalanceBatchConfig {
  return {
    characterId: config.characterId,
    enemyId: config.enemyId,
    depth: config.depth,
    talentPreset: config.preset,
    difficultyModifiers: reportTierForPreset(config.preset).difficultyModifiers,
    loadoutMode: options.loadoutMode,
    iterations: config.iterations ?? options.iterations,
    seed: config.seed,
    maxTurns: 30,
    policy: options.policy,
    ...(options.appliesFightPacing === undefined ? {} : { appliesFightPacing: options.appliesFightPacing }),
    ...(config.deck ? { deck: config.deck } : {}),
    ...(config.trinketIds ? { trinketIds: config.trinketIds } : {}),
    ...(config.gearEffects ? { gearEffects: config.gearEffects } : {}),
    ...(config.talentEffects ? { talentEffects: config.talentEffects } : {}),
  };
}

function runSeries(options: ReportRunOptions, config: BalanceScenarioConfig): WinSeries {
  return simulateWinSeries(buildBalanceBatchConfig(options, config));
}

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

type PairedStatsById = Map<string, Map<TalentPreset, PairedWinStats[]>>;

function pushComparison(
  collected: PairedStatsById,
  tier: TalentPreset,
  id: string,
  baseline: WinSeries,
  treatment: WinSeries,
): void {
  const byTier = collected.get(id) ?? new Map<TalentPreset, PairedWinStats[]>();
  const entries = byTier.get(tier) ?? [];
  entries.push(pairedWinStats(baseline.outcomes, treatment.outcomes, baseline.turns, treatment.turns));
  byTier.set(tier, entries);
  collected.set(id, byTier);
}

function mergeComparisons(collected: PairedStatsById): PairedTierRow[] {
  return [...collected.entries()].map(([id, byTier]) => ({
    id,
    deltas: reportTierRecord((tier) => makePairedDelta(id, combinePairedWinStats(byTier.get(tier) ?? []))),
  }));
}

function runComparison(
  options: ReportRunOptions,
  collected: PairedStatsById,
  tier: TalentPreset,
  id: string,
  baseline: BalanceScenarioConfig,
  treatment: BalanceScenarioConfig,
): void {
  pushComparison(collected, tier, id, runSeries(options, baseline), runSeries(options, treatment));
}

function recordComparison(
  options: ReportRunOptions,
  collected: PairedStatsById,
  tier: TalentPreset,
  id: string,
  baseline: WinSeries,
  treatment: BalanceScenarioConfig,
): void {
  pushComparison(collected, tier, id, baseline, runSeries(options, treatment));
}

export function runTrinketSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      for (const scenario of BOON_GAUNTLET) {
        const depth = tier.depthOffset + scenario.depthDelta;
        const deckSeed = balanceScenarioSeed("boon-deck", tier.preset, characterId, scenario.enemyId, depth);
        const fightSeed = balanceScenarioSeed("boon-fight", tier.preset, characterId, scenario.enemyId, depth);
        const deck = buildRandomDeck(deckSeed);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth,
          preset: tier.preset,
          seed: fightSeed,
          deck,
          iterations: options.pairedIterations,
        };
        const baseline = runSeries(options, { ...shared, trinketIds: [] });
        for (const trinket of trinketLibrary) {
          recordComparison(options, collected, tier.preset, trinket.id, baseline, {
            ...shared,
            trinketIds: [trinket.id],
          });
        }
      }
    }
  }
  return mergeComparisons(collected);
}

export function runCardSweepIsolated(options: ReportRunOptions, enemyId: string): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  const ids = reportCharacterIds();
  const iterations = Math.max(10, Math.floor(options.iterations / 10));
  for (const tier of REPORT_TIERS) {
    for (let index = 0; index < options.cardDeckSamples; index += 1) {
      const characterId = ids[index % ids.length]!;
      const deckSeed = balanceScenarioSeed("card-isolated-deck", tier.preset, enemyId, index);
      const seed = balanceScenarioSeed("card-isolated-fight", tier.preset, characterId, enemyId, index);
      const shared = {
        characterId,
        enemyId,
        depth: tier.depthOffset + 2,
        preset: tier.preset,
        seed,
        trinketIds: [],
        iterations,
      };
      for (const card of cardLibrary) {
        const decks = buildCardIsolationDecks(card, deckSeed);
        runComparison(
          options,
          collected,
          tier.preset,
          card.id,
          { ...shared, deck: decks.baseline },
          { ...shared, deck: decks.treatment },
        );
      }
    }
  }
  return mergeComparisons(collected);
}

export const IN_CLASS_CARD_GAUNTLET = [
  { enemyId: "skeleton", depthDelta: 1 },
  { enemyId: "mimic", depthDelta: 5 },
  { enemyId: "forge-golem", depthDelta: 7 },
] as const;

export function runCardSweepInClass(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  const iterations = Math.max(10, Math.floor(options.iterations / 5));
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
        const baseSeries = runSeries(options, { ...shared, deck: baseDeck });
        for (const card of cardLibrary) {
          const keywords = getCardKeywords(card);
          const matches = characterId === "wildcard" || keywords.length === 0 || cardMatchesAffinity(card, affinity);
          if (!matches) continue;
          const alreadyInDeck = baseDeck.some((entry) => entry.id === card.id);
          const baseline = alreadyInDeck
            ? runSeries(options, { ...shared, deck: removeCardIdFromDeck(baseDeck, card.id) })
            : baseSeries;
          const treatment = alreadyInDeck
            ? baseSeries
            : runSeries(options, { ...shared, deck: insertCardIntoDeck(baseDeck, card) });
          pushComparison(collected, tier.preset, card.id, baseline, treatment);
        }
      }
    }
  }
  return mergeComparisons(collected);
}

export function runTalentSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("talent-deck", tier.preset, characterId);
      const keywords = characters[characterId].keywords;
      const unlocked = buildPresetUnlockedTalents(keywords, tier.preset);
      const talents = keywords.flatMap((keyword) => combatTalentsInPoolOrder(keyword));
      const deck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      for (const talent of talents) {
        const baselineEffects = computeTalentEffects(withoutTalent(unlocked, talent));
        const treatmentEffects = computeTalentEffects(withTalent(unlocked, talent));
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
          runComparison(
            options,
            collected,
            tier.preset,
            talent.id,
            { ...shared, talentEffects: baselineEffects },
            { ...shared, talentEffects: treatmentEffects },
          );
        }
      }
    }
  }
  return mergeComparisons(collected);
}

function summonCards(): BattleCard[] {
  return cardLibrary.filter((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
}

export function runCompanionSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  const summons = summonCards();
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("companion-deck", tier.preset, characterId);
      const classKeywords = characters[characterId].keywords;
      const deck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      const relevant = summons.filter((card) => {
        const effect = card.effects.find((candidate) => candidate.kind === "summon-companion");
        if (!effect || effect.kind !== "summon-companion") return false;
        return (
          classKeywords.includes("companion") ||
          companionIdsFromDeck(deck).includes(effect.companionId) ||
          cardMatchesAffinity(card, classKeywords)
        );
      });
      for (const card of relevant) {
        const effect = card.effects.find((candidate) => candidate.kind === "summon-companion");
        if (!effect || effect.kind !== "summon-companion") continue;
        const companionId: CompanionId = effect.companionId;
        if (!(companionId in companionLibrary)) continue;
        const baselineDeck = removeCompanionSummonFromDeck(insertCardIntoDeck(deck, card), companionId);
        const treatmentDeck = insertCardIntoDeck(baselineDeck, card);
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
          runComparison(
            options,
            collected,
            tier.preset,
            companionId,
            { ...shared, deck: baselineDeck },
            { ...shared, deck: treatmentDeck },
          );
        }
      }
    }
  }
  return mergeComparisons(collected);
}

export function runGearSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
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
        const baseline = runSeries(options, { ...shared, gearEffects: defaultGearEffects });
        for (const item of gearBaseItemList) {
          const matches =
            keywords.length === 0 ||
            item.affinityKeywords.length === 0 ||
            item.affinityKeywords.some((keyword) => keywords.includes(keyword));
          if (!matches) continue;
          const rng = createRunStreamRng(seed, "rewards");
          const instance = generateGearInstanceForBaseItem(item.id, rng);
          const treatmentGear = instance
            ? effectsForAffixRolls(instance.affixes, gearInstanceRarity(instance))
            : defaultGearEffects;
          recordComparison(options, collected, tier.preset, item.id, baseline, {
            ...shared,
            gearEffects: treatmentGear,
          });
        }
      }
    }
  }
  return mergeComparisons(collected);
}

export function runAffixSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  for (const tier of REPORT_TIERS) {
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
          const baseline = runSeries(options, { ...shared, gearEffects: defaultGearEffects });
          for (const affix of gearAffixList) {
            const range = affix.roll[affix.uniqueOnly ? "unique" : tier.preset === "late" ? "astral" : "basic"];
            const value = Math.round((range.min + range.max) / 2);
            recordComparison(options, collected, tier.preset, affix.id, baseline, {
              ...shared,
              gearEffects: effectsForAffixRolls(
                [{ id: affix.id, value }],
                affix.uniqueOnly ? "unique" : tier.preset === "late" ? "astral" : "basic",
              ),
            });
          }
        }
      }
    }
  }
  return mergeComparisons(collected);
}
