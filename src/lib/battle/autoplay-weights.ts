// Live autoplay scoring. Game-design owned: changing these weights changes
// autoplay and Wish picks in real runs. The balance simulator imports this
// policy today so reports match the skill floor; if the simulator needs its own
// tuning, fork a copy under src/lib/balance instead of editing these weights.
export const AUTOPLAY_EFFECT_SCORE = {
  defense: 0.5,
  cleanse: 3,
  draw: 2,
  mana: 2,
  summon: 6,
  criticalHit: 4,
  repeatCard: 5,
  wish: 3,
} as const;
