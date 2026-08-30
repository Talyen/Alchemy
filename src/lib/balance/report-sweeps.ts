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
import { createRunStreamRng } from "@/lib/run-rng";
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
import { BOON_GAUNTLET, REPORT_TIERS } from "./report-catalog";
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
    difficultyModifiers: REPORT_TIERS.find((tier) => tier.preset === config.preset)?.difficultyModifiers ?? [],
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

function characterIds(): CharacterId[] {
  return Object.keys(characters) as CharacterId[];
}

function buildRandomDeck(seed: number, size = 10): BattleCard[] {
  return sampleItems(cardLibrary, size, createRunStreamRng(seed, "world"));
}

function buildFixedCardDeck(target: BattleCard, seed: number, size = 10): BattleCard[] {
  const others = buildRandomDeck(seed, size).filter((card) => card.id !== target.id);
  return [target, ...others.slice(0, size - 1)];
}

type TierLabel = (typeof REPORT_TIERS)[number]["label"];
type PairedStatsByTierAndId = Map<string, PairedWinStats[]>;

function pushComparison(
  collected: PairedStatsByTierAndId,
  tier: TierLabel,
  id: string,
  baseline: WinSeries,
  treatment: WinSeries,
): void {
  const key = `${tier}:${id}`;
  const entries = collected.get(key) ?? [];
  entries.push(pairedWinStats(baseline.outcomes, treatment.outcomes));
  collected.set(key, entries);
}

function mergeComparisons(collected: PairedStatsByTierAndId): PairedTierRow[] {
  const ids = [...new Set([...collected.keys()].map((key) => key.slice(key.indexOf(":") + 1)))];
  const deltaFor = (tier: TierLabel, id: string) =>
    makePairedDelta(id, combinePairedWinStats(collected.get(`${tier}:${id}`) ?? []));
  return ids.map((id) => ({
    id,
    early: deltaFor("Early", id),
    mid: deltaFor("Mid", id),
    late: deltaFor("Late", id),
  }));
}

export function runTrinketSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsByTierAndId = new Map();
  let scenarioSeed = 50_000;
  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      for (const scenario of BOON_GAUNTLET) {
        const deck = buildRandomDeck(scenarioSeed);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth: tier.depthOffset + scenario.depthDelta,
          preset: tier.preset,
          seed: scenarioSeed,
          deck,
          iterations: options.trinketIterations,
        };
        const baseline = runSeries(options, { ...shared, trinketIds: [] });
        for (const trinket of trinketLibrary) {
          pushComparison(
            collected,
            tier.label,
            trinket.id,
            baseline,
            runSeries(options, { ...shared, trinketIds: [trinket.id] }),
          );
        }
        scenarioSeed += 1000;
      }
    }
  }
  return mergeComparisons(collected);
}

export function runCardSweepIsolated(options: ReportRunOptions, enemyId: string): PairedTierRow[] {
  const collected: PairedStatsByTierAndId = new Map();
  const ids = characterIds();
  const iterations = Math.max(10, Math.floor(options.iterations / 10));
  for (const tier of REPORT_TIERS) {
    for (let index = 0; index < options.cardIterations; index += 1) {
      const characterId = ids[index % ids.length]!;
      const deckSeed = 200_000 + index;
      const seed = deckSeed + 100_000;
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
          tier.label,
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
  const collected: PairedStatsByTierAndId = new Map();
  const iterations = Math.max(10, Math.floor(options.iterations / 5));
  let scenarioSeed = 400_000;
  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const affinity = characters[characterId].keywords;
      const baseDeck = buildClassSimDeck(characterId, tier.preset, scenarioSeed);
      const shared = {
        characterId,
        enemyId: "skeleton",
        depth: tier.depthOffset + 2,
        preset: tier.preset,
        seed: scenarioSeed,
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
        pushComparison(collected, tier.label, card.id, baseline, treatment);
      }
      scenarioSeed += 1000;
    }
  }
  return mergeComparisons(collected);
}

export function runTalentSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsByTierAndId = new Map();
  let seed = 600_000;
  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const keywords = characters[characterId].keywords;
      const unlocked = buildPresetUnlockedTalents(keywords, tier.preset);
      const talents = keywords.flatMap((keyword) => combatTalentsInPoolOrder(keyword));
      const deck = buildClassSimDeck(characterId, tier.preset, seed);
      for (const talent of talents) {
        const baselineEffects = computeTalentEffects(withoutTalent(unlocked, talent));
        const treatmentEffects = computeTalentEffects(withTalent(unlocked, talent));
        for (const scenario of BOON_GAUNTLET) {
          const shared = {
            characterId,
            enemyId: scenario.enemyId,
            depth: tier.depthOffset + scenario.depthDelta,
            preset: tier.preset,
            seed,
            deck,
            iterations: options.trinketIterations,
          };
          pushComparison(
            collected,
            tier.label,
            talent.id,
            runSeries(options, { ...shared, talentEffects: baselineEffects }),
            runSeries(options, { ...shared, talentEffects: treatmentEffects }),
          );
        }
      }
      seed += 1000;
    }
  }
  return mergeComparisons(collected);
}

function summonCards(): BattleCard[] {
  return cardLibrary.filter((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
}

export function runCompanionSweep(options: ReportRunOptions): PairedTierRow[] {
  const collected: PairedStatsByTierAndId = new Map();
  let seed = 700_000;
  const summons = summonCards();
  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const classKeywords = characters[characterId].keywords;
      const deck = buildClassSimDeck(characterId, tier.preset, seed);
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
          const shared = {
            characterId,
            enemyId: scenario.enemyId,
            depth: tier.depthOffset + scenario.depthDelta,
            preset: tier.preset,
            seed,
            iterations: options.trinketIterations,
          };
          pushComparison(
            collected,
            tier.label,
            companionId,
            runSeries(options, { ...shared, deck: baselineDeck }),
            runSeries(options, { ...shared, deck: treatmentDeck }),
          );
        }
      }
      seed += 1000;
    }
  }
  return mergeComparisons(collected);
}
