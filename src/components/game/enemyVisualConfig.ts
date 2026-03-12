const ENLARGED_ENEMY_IDS = new Set(['shade', 'mirror_shade', 'prismatic_shade', 'big_demon', 'ogre', 'flaming_skull', 'prismatic_skull'])

export const PRISMATIC_ENEMY_IDS = new Set([
  'prismatic_slug',
  'prismatic_skull',
  'prismatic_shade',
  'prismatic_greater_mimic',
  'prismatic_greater_slime',
])

const EXTRA_SIZE_MULTIPLIER: Partial<Record<string, number>> = {
  chort: 1.3,
  masked_orc: 1.4,
  orc_shaman: 1.4,
  orc_warrior: 1.4,
  mimic: 0.75,
  greater_mimic: 1.02,
  muddy: 0.8,
  swampy: 0.8,
  greater_slime: 1.28,
  doc: 1.2,
  flaming_skull: 1.3,
  prismatic_skull: 1.3,
  shade: 1.4,
  mirror_shade: 1.4,
  prismatic_shade: 1.4,
}

export function getEnemyRelativeScale(enemyId: string): number {
  const base = ENLARGED_ENEMY_IDS.has(enemyId) ? 1.5 : 1
  return base * (EXTRA_SIZE_MULTIPLIER[enemyId] ?? 1)
}

export const BESTIARY_Y_OFFSET: Partial<Record<string, number>> = {
  shade: 19,
  mirror_shade: 19,
  prismatic_shade: 19,
}

export const BESTIARY_HORIZONTAL_FLIP_IDS = new Set<string>()
