// Simulator policy. Currently shares the live autoplay scoring so offline
// reports match the skill floor. Game-design owns live weights in
// src/lib/battle/autoplay-policy.ts — fork a sim-local copy here if reports
// need independent tuning instead of editing live behavior.
export {
  AUTOPLAY_EFFECT_SCORE as EFFECT_SCORE,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "@/lib/battle";
