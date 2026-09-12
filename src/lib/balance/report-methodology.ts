import { CLASS_SIM_AFFINITY_EXTRAS, WILDCARD_SIM_DECK_SIZE } from "./class-deck";
import { TIER_GOLD } from "./loadout-preset";
import type { ReportRunOptions } from "./report-options";
import {
  LATE_AFFINITY_TALENT_CAP,
  LATE_OTHER_TALENT_COUNT,
  MID_AFFINITY_TALENT_COUNT,
  MID_OTHER_TALENT_COUNT,
} from "./talent-preset";

export function reportMethodologyLines(options: ReportRunOptions): string[] {
  return [
    `Core scenarios: all characters × normal/elite/boss × tier depths × ${options.deckSeeds} semantic class-deck seeds. Each tier/class deck sample is reused across enemies; fight seeds remain matchup-specific.`,
    `Deck: starting deck + affinity extras (Early +${CLASS_SIM_AFFINITY_EXTRAS.early}, Mid +${CLASS_SIM_AFFINITY_EXTRAS.mid}, Late +${CLASS_SIM_AFFINITY_EXTRAS.late}). Wildcard random ${WILDCARD_SIM_DECK_SIZE.early}/${WILDCARD_SIM_DECK_SIZE.mid}/${WILDCARD_SIM_DECK_SIZE.late}. Alchemist +2 mixed potions.`,
    `Talents (tree order, including economic talents; placeholders excluded): Early none; Mid ${MID_AFFINITY_TALENT_COUNT} affinity + ${MID_OTHER_TALENT_COUNT} other; Late up to ${LATE_AFFINITY_TALENT_CAP} affinity + ${LATE_OTHER_TALENT_COUNT} other. Only individual-talent sweeps exclude meta-only talents; presets retain tree-order investments.`,
    `Gold: Early ${TIER_GOLD.early} / Mid ${TIER_GOLD.mid} / Late ${TIER_GOLD.late}, plus startGold from combat talents. Explicit config.gold overrides.`,
    `Loadout mode=${options.loadoutMode}. typical adds +1 max HP per unlocked talent (Wildcard uses the full budget equivalent), Mid 1★ / Late 2★ homestead via computeHomesteadEffects, seeded affinity gear (Mid weapon+body, Late full set), and Mid/Late core trinkets (Grove's Favor / Tattered Pages). bare keeps talent-point HP and tier gold but omits homestead, gear, and core trinkets. Gear uses a salted RNG stream from the fight seed so paired isolation sweeps stay matched. Boon/card isolation sweeps force trinketIds to the isolated set.`,
    `Difficulty: Normal (Novice, canonical modifiers). Room scaling uses scenario depth.`,
    `Class rankings weight Normal/Elite/Boss equally while retaining the underlying battle count. Isolation sweeps pair baseline and treatment by deck, matchup, and semantic seed. Delta SE uses the sample variance of per-seed win differences; deltas below 2 SE are marked noisy.`,
    `Durations count rounds actually played, including defeats and capped fights. A shorter fight can indicate an earlier defeat. Win and turn deltas use separate standard errors; category medians include noisy rows. These are screening heuristics, not multiple-comparison-adjusted significance tests.`,
    `Enemy attacks count attack actions, including blocked or dodged actions; multi-hit packets count once. Haste, crowd-control skips, and enemies defeated before attacking do not count. Ability uses count chosen card abilities, including defensive abilities. Trait activations count triggered trait effects (including reactions and conditional attack bonuses), not passive resistances, starting stats, or difficulty modifiers. Individual simulation results retain counts by trait ID and card ability ID. Wins before attack is the fraction of all battles won with zero enemy attack actions; averages include losses and timeouts.`,
    `Affix isolation: every affix × hero × tier × gauntlet × configured deck seed, one affix vs no gear. Rounded midpoint Basic rolls early/mid and Astral late; unique effects use fixed rolls, including hypothetical early access. Item ablation remains a separate rolled-item comparison.`,
    `Play policy=${options.policy} is a skill floor: dump-hand, random wishes, no holds. greedy-damage is face damage only; greedy-effective-damage also scores DoT/status/block.`,
    `Fight pacing ${options.appliesFightPacing === false ? "off" : "on"} (hidden comeback × clock scaler; ALCHEMY_BALANCE_PACING=off measures raw kit).`,
    `Not simulated: map/shop/rewards, HP carryover, Labyrinth/Wildwood traits, multi-trinket synergies beyond the typical core pair.`,
    `Enemy target bands apply to Early, Mid, and Late. Outcome counts are raw battles, even for type-weighted class rates. Iron Bear gains 1 Armor every other enemy turn.`,
  ];
}
