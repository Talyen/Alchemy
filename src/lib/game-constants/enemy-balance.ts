export const ENEMY_PROGRESSION_DEPTH_LIMIT = 24;
export const ENEMY_BOSS_HEALTH_SCALE = 0.9;

export const ENEMY_BALANCE_BY_TYPE = {
  normal: {
    health: { base: 1.8, linear: 0.06, quadratic: 0.009 },
    pressure: { base: 1.5, linear: 0.17, quadratic: -0.0034 },
  },
  elite: {
    health: { base: 1.75, linear: 0.06, quadratic: 0.006 },
    pressure: { base: 0.9, linear: 0.25, quadratic: -0.005 },
  },
  boss: {
    health: { base: 1.9, linear: 0.06, quadratic: 0.0045 },
    pressure: { base: 0.2, linear: 0.24, quadratic: -0.005 },
  },
} as const;

export const ENEMY_PRESSURE_OVERRIDES: Readonly<
  Record<string, number | { base: number; linear: number; max: number }>
> = {
  bandit: { base: 0.9, linear: 0.01, max: 1 },
  "dire-wolf": 1.25,
  "earth-elemental": 1.1,
  "fire-imp": { base: 0.8, linear: 0.03, max: 1.5 },
  goblin: 1.1,
  skeleton: 1.2,
  "winter-wolf": { base: 0.9, linear: 0.03, max: 1.3 },
  banshee: 1.05,
  mimic: 1.05,
  "mud-elemental": { base: 0.6, linear: 0.03, max: 0.95 },
  "plague-doctor": { base: 0.35, linear: 0.045, max: 1.05 },
  "fire-elemental": { base: 0.3, linear: 0.02, max: 0.75 },
  "frost-elemental": 1.25,
  "will-o-wisp": 0.9,
  "giant-snake": { base: 0.35, linear: 0.045, max: 1.05 },
  paladin: 1.15,
  "ice-wraith": 1.25,
  yeti: 1.05,
  brawler: 1.15,
  "stone-golem": 1.2,
  ogre: 0.85,
  hellhound: 0.9,
  "blood-cultist": 0.95,
  vampire: { base: 0.55, linear: 0.02, max: 0.9 },
  slime: { base: 0.9, linear: 0.0125, max: 1.05 },
  "giant-spider": { base: 0.65, linear: 0.03, max: 1 },
  pyromancer: 0.75,
  cleric: 0.85,
  "blight-treant": 0.9,
  "forge-golem": { base: 0.25, linear: 0.05, max: 0.8 },
};

export const ENEMY_HEALTH_OVERRIDES: Readonly<Record<string, number>> = {
  vampire: 1.08,
  "forge-golem": 0.95,
  frostwarden: 0.95,
};
