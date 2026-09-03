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
import { createRunStreamRng } from "@/lib/rng";
import { sampleItems } from "@/lib/utils";
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
    ...(config.talentEffects ? { talentEffects: config.talentEffects } : {}),
  };
}

function runSeries(options: ReportRunOptions, config: BalanceScenarioConfig): WinSeries {
  return simulateWinSeries(buildBalanceBatchConfig(options, config));
}

function buildRandomDeck(seed: number, size = 10): BattleCard[] {
  return sampleItems(cardLibrary, size, createRunStreamRng(seed, "world"));
}

function buildFixedCardDeck(target: BattleCard, seed: number, size = 10): BattleCard[] {
  const others = buildRandomDeck(seed, size).filter((card) => card.id !== target.id);
  return [target, ...others.slice(0, size - 1)];
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
  entries.push(pairedWinStats(baseline.outcomes, treatment.outcomes));
  byTier.set(tier, entries);
  collected.set(id, byTier);
}

function mergeComparisons(collected: PairedStatsById): PairedTierRow[] {
  return [...collected.entries()].map(([id, byTier]) => ({
    id,
    deltas: reportTierRecord((tier) => makePairedDelta(id, combinePairedWinStats(byTier.get(tier) ?? []))),
  }));
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
          iterations: options.trinketIterations,
        };
        const baseline = runSeries(options, { ...shared, trinketIds: [] });
        for (const trinket of trinketLibrary) {
          pushComparison(
            collected,
            tier.preset,
            trinket.id,
            baseline,
            runSeries(options, { ...shared, trinketIds: [trinket.id] }),
          );
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
    for (let index = 0; index < options.cardIterations; index += 1) {
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
      const baseline = runSeries(options, { ...shared, deck: buildRandomDeck(deckSeed) });
      for (const card of cardLibrary) {
        pushComparison(
          collected,
          tier.preset,
          card.id,
          baseline,
          runSeries(options, { ...shared, deck: buildFixedCardDeck(card, deckSeed) }),
        );
      }
    }
  }
  return mergeComparisons(collected);
}

export function runCardSweepInClass(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  const iterations = Math.max(10, Math.floor(options.iterations / 5));
  for (const tier of REPORT_TIERS) {
    for (const characterId of reportCharacterIds()) {
      const deckSeed = balanceScenarioSeed("card-in-class-deck", tier.preset, characterId);
      const fightSeed = balanceScenarioSeed("card-in-class-fight", tier.preset, characterId, "skeleton");
      const affinity = characters[characterId].keywords;
      const baseDeck = buildClassSimDeck(characterId, tier.preset, deckSeed);
      const shared = {
        characterId,
        enemyId: "skeleton",
        depth: tier.depthOffset + 2,
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
            iterations: options.trinketIterations,
          };
          pushComparison(
            collected,
            tier.preset,
            talent.id,
            runSeries(options, { ...shared, talentEffects: baselineEffects }),
            runSeries(options, { ...shared, talentEffects: treatmentEffects }),
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
            iterations: options.trinketIterations,
          };
          pushComparison(
            collected,
            tier.preset,
            companionId,
            runSeries(options, { ...shared, deck: baselineDeck }),
            runSeries(options, { ...shared, deck: treatmentDeck }),
          );
        }
      }
    }
  }
  return mergeComparisons(collected);
}
