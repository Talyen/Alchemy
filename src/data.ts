import type { CardDef, CardInstance, EnemyState, EnemyWeakness, StatusEffects } from './types'

export type RunCharacter = {
  id: string
  name: string
  quirk: string
  starterDeck: Array<{ cardId: string; count: number }>
}

export const emptyStatus = (): StatusEffects => ({
  vulnerable: 0,
  weak: 0,
  strength: 0,
  forge: 0,
  burn: 0,
  poison: 0,
  bleed: 0,
  chill: 0,
  trap: 0,
})

export const ALL_CARDS: CardDef[] = [
  {
    id: 'stab',
    name: 'Stab',
    cost: 1,
    type: 'attack',
    description: 'Deal 4 Pierce Damage',
    effect: { damage: 4 },
  },
  {
    id: 'slash',
    name: 'Slash',
    cost: 1,
    type: 'attack',
    description: 'Deal 4 Slash Damage',
    effect: { damage: 4 },
  },
  {
    id: 'defend',
    name: 'Defend',
    cost: 1,
    type: 'skill',
    description: 'Gain 5 Block',
    effect: { block: 5 },
  },
  {
    id: 'bash',
    name: 'Bash',
    cost: 2,
    type: 'attack',
    description: 'Deal 8 Blunt Damage',
    effect: { damage: 8 },
  },
  {
    id: 'plate_mail',
    name: 'Plate Mail',
    cost: 2,
    type: 'skill',
    description: 'Gain 2 Armor',
    effect: { armor: 2 },
  },
  {
    id: 'anvil',
    name: "Anvil",
    cost: 2,
    type: 'upgrade',
    description: 'Gain 1 Forge each turn',
    effect: { forge: 1 },
  },
  {
    id: 'health_potion',
    name: 'Health Potion',
    cost: 1,
    type: 'heal',
    description: 'Heal 10\nConsume',
    effect: { heal: 10 },
  },
  {
    id: 'panacea_potion',
    name: 'Panacea Potion',
    cost: 1,
    type: 'heal',
    description: 'Remove 1 Ailment\nConsume',
    effect: { cleanse: 1 },
  },
  {
    id: 'mana_potion',
    name: 'Mana Potion',
    cost: 1,
    type: 'skill',
    description: 'Gain 2 Mana\nConsume',
    effect: { mana: 2 },
  },
  {
    id: 'apple',
    name: 'Apple',
    cost: 0,
    type: 'heal',
    description: 'Heal 3\nConsume',
    effect: { heal: 3 },
  },
  {
    id: 'meat',
    name: 'Meat',
    cost: 2,
    type: 'heal',
    description: 'Heal 15\nConsume',
    effect: { heal: 15 },
  },
  {
    id: 'bread',
    name: 'Bread',
    cost: 1,
    type: 'heal',
    description: 'Heal 5\nConsume',
    effect: { heal: 5 },
  },
  {
    id: 'bite',
    name: 'Fangs',
    cost: 1,
    type: 'attack',
    description: 'Deal 3 Damage\nLeech',
    effect: { damage: 3, leech: true },
  },
  {
    id: 'fireball',
    name: 'Fireball',
    cost: 1,
    type: 'attack',
    description: 'Deal 3 Burn',
    effect: { burn: 3 },
  },
  {
    id: 'gold',
    name: 'Gold',
    cost: 0,
    type: 'skill',
    description: 'Gain 7 Gold\nConsume',
    effect: { gold: 7 },
  },
  {
    id: 'mana_crystal',
    name: 'Mana Crystal',
    cost: 2,
    type: 'skill',
    description: 'Gain 1 Mana Crystal',
    effect: { manaCrystal: 1 },
  },
  {
    id: 'mana_berries',
    name: 'Mana Berries',
    cost: 0,
    type: 'skill',
    description: 'Gain 1 Mana\nConsume',
    effect: { mana: 1 },
  },
  {
    id: 'poisoned_dagger',
    name: 'Poison Dagger',
    cost: 1,
    type: 'attack',
    description: 'Deal 1 Poison',
    effect: { poison: 1 },
  },
  {
    id: 'lacerate',
    name: 'Lacerate',
    cost: 1,
    type: 'attack',
    description: 'Deal 2 Bleed',
    effect: { bleed: 2 },
  },
  {
    id: 'poison_fangs',
    name: 'Poison Fangs',
    cost: 1,
    type: 'attack',
    description: 'Deal 1 Poison\nLeech',
    effect: { poison: 1, leech: true },
  },
  {
    id: 'haste',
    name: 'Scroll of Haste',
    cost: 2,
    type: 'skill',
    description: 'Gain Haste\nConsume',
    effect: { haste: 1 },
  },
  {
    id: 'heal',
    name: 'Heal',
    cost: 1,
    type: 'heal',
    description: 'Heal 5',
    effect: { heal: 5 },
  },
  {
    id: 'cleanse',
    name: 'Cleanse',
    cost: 1,
    type: 'skill',
    description: 'Remove 1 Ailment',
    effect: { cleanse: 1 },
  },
  {
    id: 'fiery_blade',
    name: 'Fiery Blade',
    cost: 2,
    type: 'attack',
    description: 'Deal 4 Pierce Damage and 4 Burn',
    effect: { damage: 4, burn: 4 },
  },
  {
    id: 'bear_trap',
    name: 'Bear Trap',
    cost: 2,
    type: 'skill',
    description: 'Deal 10 Damage\nTrap',
    effect: { trap: 10 },
  },
  {
    id: 'wish',
    name: 'Wish',
    cost: 1,
    type: 'skill',
    description: 'Wish 1\nConsume',
    effect: { wish: 1 },
  },
  {
    id: 'holy_blade',
    name: 'Holy Blade',
    cost: 2,
    type: 'attack',
    description: 'Deal 10 Holy Damage',
    effect: { damage: 10 },
  },
  {
    id: 'immolate',
    name: 'Immolate',
    cost: 1,
    type: 'upgrade',
    description: 'Deal 1 Burn to Self and Enemy each turn',
    effect: { burn: 1, selfBurn: 1 },
  },
  // ── New cards ────────────────────────────────────────────────────────────
  {
    id: 'cauterize',
    name: 'Cauterize',
    cost: 0,
    type: 'skill',
    description: 'Remove all Bleed\nBurn 1 Self',
    effect: { removeSelfBleed: true, selfBurn: 1 },
  },
  {
    id: 'blessed_aegis',
    name: 'Blessed Aegis',
    cost: 2,
    type: 'skill',
    description: 'Gain 6 Block\nDeal 4 Holy',
    effect: { block: 6, damage: 4 },
  },
  {
    id: 'steal',
    name: 'Steal',
    cost: 1,
    type: 'attack',
    description: 'Deal 2 Blunt\nGain 2 Gold',
    effect: { damage: 2, gold: 2 },
  },
  {
    id: 'exsanguinate',
    name: 'Exsanguinate',
    cost: 2,
    type: 'skill',
    description: 'Double enemy Bleed',
    effect: { doubleEnemyBleed: true },
  },
  {
    id: 'conflagrate',
    name: 'Conflagrate',
    cost: 2,
    type: 'skill',
    description: 'Double enemy Burn',
    effect: { doubleEnemyBurn: true },
  },
  {
    id: 'frostbolt',
    name: 'Frostbolt',
    cost: 1,
    type: 'attack',
    description: 'Deal 2 Chill',
    effect: { chill: 2 },
  },
]

export const RUN_CHARACTERS: RunCharacter[] = [
  {
    id: 'knight',
    name: 'Knight',
    quirk: 'Well-rounded fighter with sturdy armor and steady sustain.',
    starterDeck: [
      { cardId: 'slash', count: 2 },
      { cardId: 'bash', count: 1 },
      { cardId: 'defend', count: 2 },
      { cardId: 'plate_mail', count: 1 },
      { cardId: 'anvil', count: 1 },
      { cardId: 'meat', count: 1 },
    ],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    quirk: 'Fast striker who stacks poison and bleed while weaving in and out of danger.',
    starterDeck: [
      { cardId: 'stab', count: 2 },
      { cardId: 'health_potion', count: 1 },
      { cardId: 'apple', count: 1 },
      { cardId: 'poisoned_dagger', count: 2 },
      { cardId: 'haste', count: 1 },
      { cardId: 'lacerate', count: 1 },
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    quirk: 'Arcane specialist who controls tempo with mana growth and steady spell pressure.',
    starterDeck: [
      { cardId: 'fireball', count: 3 },
      { cardId: 'defend', count: 2 },
      { cardId: 'mana_crystal', count: 1 },
      { cardId: 'mana_berries', count: 1 },
      { cardId: 'cleanse', count: 1 },
    ],
  },
]

let _uid = 0
const nextUid = () => String(++_uid)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getCardById(cardId: string): CardDef {
  const card = ALL_CARDS.find(def => def.id === cardId)
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`)
  }
  return card
}

export function getRunCharacter(characterId: string): RunCharacter {
  const character = RUN_CHARACTERS.find(entry => entry.id === characterId)
  if (!character) {
    throw new Error(`Unknown character id: ${characterId}`)
  }
  return character
}

export function getCharacterStarterCards(characterId: string): CardDef[] {
  const character = getRunCharacter(characterId)
  return character.starterDeck.flatMap(({ cardId, count }) => Array.from({ length: count }, () => getCardById(cardId)))
}

export function makeStartingDeck(characterId = 'knight'): CardInstance[] {
  const starterCards = getCharacterStarterCards(characterId)
  return shuffle(starterCards).map(def => ({ ...def, uid: nextUid() }))
}

export function makeCardInstances(defs: CardDef[]): CardInstance[] {
  return defs.map(def => ({ ...def, uid: nextUid() }))
}

type EnemyTier = 'basic' | 'elite'

type EnemyTemplate = {
  id: string
  name: string
  tier: EnemyTier
  weaknesses?: EnemyWeakness[]
}

const BASIC_ATTACK_RANGE_BY_TIER: Record<EnemyTier, { min: number; max: number }> = {
  basic: { min: 3, max: 5 },
  elite: { min: 5, max: 8 },
}

const BASE_HP_RANGE_BY_TIER: Record<EnemyTier, { min: number; max: number }> = {
  basic: { min: 20, max: 30 },
  elite: { min: 40, max: 50 },
}

const BITE_ENEMY_IDS = new Set(['chort', 'mimic', 'greater_mimic', 'big_demon'])
const POISON_ENEMY_IDS = new Set(['muddy', 'swampy', 'greater_slime', 'slug', 'doc', 'snake'])
const BURN_ENEMY_IDS = new Set(['flaming_skull', 'prismatic_skull'])
const CHILL_ENEMY_IDS = new Set(['frost_imp'])
const LEECH_ENEMY_IDS = new Set(['blood_goblin', 'blood_shaman'])
const STEAL_GOLD_ENEMY_IDS = new Set<string>()
const RANDOM_DAMAGE_ENEMY_IDS = new Set([
  'prismatic_slug', 'prismatic_skull', 'prismatic_shade',
  'prismatic_greater_mimic', 'prismatic_greater_slime'
])

const BASIC_ENEMY_TEMPLATES: EnemyTemplate[] = [
  { id: 'goblin', name: 'Goblin', tier: 'basic' },
  { id: 'chort', name: 'Chomp', tier: 'basic' },
  { id: 'imp', name: 'Imp', tier: 'basic' },
  { id: 'frost_imp', name: 'Frost Imp', tier: 'basic', weaknesses: ['burn'] },
  { id: 'mimic', name: 'Mimic', tier: 'basic' },
  { id: 'lizard_f', name: 'Lizard Scout', tier: 'basic' },
  { id: 'lizard_m', name: 'Lizard Raider', tier: 'basic' },
  { id: 'masked_orc', name: 'Masked Orc', tier: 'basic', weaknesses: ['burn'] },
  { id: 'muddy', name: 'Mud Elemental', tier: 'basic' },
  { id: 'necromancer', name: 'Necromancer', tier: 'basic' },
  { id: 'orc_shaman', name: 'Orc Shaman', tier: 'basic', weaknesses: ['burn'] },
  { id: 'orc_warrior', name: 'Orc Warrior', tier: 'basic', weaknesses: ['burn'] },
  { id: 'skelet', name: 'Skeleton', tier: 'basic', weaknesses: ['blunt'] },
  { id: 'slug', name: 'Slug', tier: 'basic' },
  { id: 'swampy', name: 'Slime', tier: 'basic' },
  { id: 'doc', name: 'Plague Doctor', tier: 'basic' },
  { id: 'snake', name: 'Snake', tier: 'basic' },
  // New variants
  { id: 'blood_goblin', name: 'Blood Goblin', tier: 'basic' },
  { id: 'blood_shaman', name: 'Blood Shaman', tier: 'basic', weaknesses: ['burn'] },
  { id: 'mirror_shade', name: 'Mirror Shade', tier: 'basic' },
  { id: 'prismatic_slug', name: 'Prismatic Slug', tier: 'basic' },
]

const ELITE_ENEMY_TEMPLATES: EnemyTemplate[] = [
  { id: 'big_demon', name: 'Maw Demon', tier: 'elite' },
  { id: 'ogre', name: 'Orc Chieftain', tier: 'elite', weaknesses: ['burn'] },
  { id: 'greater_mimic', name: 'Greater Mimic', tier: 'elite' },
  { id: 'greater_slime', name: 'Greater Slime', tier: 'elite' },
  { id: 'flaming_skull', name: 'Flaming Skull', tier: 'elite' },
  { id: 'shade', name: 'Shade', tier: 'elite' },
  // New elite variants
  { id: 'prismatic_skull', name: 'Prismatic Skull', tier: 'elite' },
  { id: 'prismatic_shade', name: 'Prismatic Shade', tier: 'elite' },
  { id: 'prismatic_greater_mimic', name: 'Prismatic Greater Mimic', tier: 'elite' },
  { id: 'prismatic_greater_slime', name: 'Prismatic Greater Slime', tier: 'elite' },
]

export type BestiaryEnemy = {
  id: string
  name: string
  tier: 'basic' | 'elite'
  weaknesses: EnemyWeakness[]
  abilities: string[]
}

export const BESTIARY_ENEMIES: BestiaryEnemy[] = [
  ...BASIC_ENEMY_TEMPLATES.map(enemy => ({
    id: enemy.id,
    name: enemy.name,
    tier: 'basic' as const,
    weaknesses: enemy.weaknesses ?? [],
    abilities: [],
  })),
  ...ELITE_ENEMY_TEMPLATES.map(enemy => ({
    id: enemy.id,
    name: enemy.name,
    tier: 'elite' as const,
    weaknesses: enemy.weaknesses ?? [],
    abilities: [],
  })),
]

const BESTIARY_ABILITY_LABELS_BY_ENEMY_ID: Partial<Record<string, string[]>> = {
  frost_imp: ['Chilling Claws'],
  chort: ['Bleeding Bite'],
  mimic: ['Bleeding Bite'],
  greater_mimic: ['Bleeding Bite'],
  big_demon: ['Bleeding Bite'],
  muddy: ['Poison Spit'],
  swampy: ['Poison Spit'],
  greater_slime: ['Poison Spit'],
  slug: ['Poison Spit'],
  doc: ['Poison Spit'],
  snake: ['Poison Spit'],
  flaming_skull: ['Burning Hex'],
  blood_goblin: ['Leeching Strike'],
  blood_shaman: ['Leeching Strike'],
  mirror_shade: ['Mirror Image'],
  prismatic_slug: ['Random Element'],
  prismatic_skull: ['Random Element'],
  prismatic_shade: ['Random Element'],
  prismatic_greater_mimic: ['Random Element'],
  prismatic_greater_slime: ['Random Element'],
}

function withBestiaryDetails(enemy: BestiaryEnemy): BestiaryEnemy {
  return {
    ...enemy,
    abilities: BESTIARY_ABILITY_LABELS_BY_ENEMY_ID[enemy.id] ?? [],
  }
}

for (let i = 0; i < BESTIARY_ENEMIES.length; i++) {
  BESTIARY_ENEMIES[i] = withBestiaryDetails(BESTIARY_ENEMIES[i])
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function scaleByFloor(baseValue: number, floorsCleared: number): number {
  const additiveScale = 1 + floorsCleared * 0.05
  return Math.max(1, Math.round(baseValue * additiveScale))
}

function buildEnemySkillset(enemyId: string, baseAttackDamage: number): EnemyState['pattern'] {
  const pattern: EnemyState['pattern'] = [
    { type: 'attack', value: baseAttackDamage, physical: true },
  ]

  if (BITE_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'bleed', value: Math.max(1, Math.floor(baseAttackDamage / 2)) })
  }

  if (POISON_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'poison', value: Math.max(1, Math.floor(baseAttackDamage / 3)) })
  }

  if (BURN_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'burn', value: Math.max(1, Math.floor(baseAttackDamage / 2)) })
  }

  if (CHILL_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'chill', value: Math.max(1, Math.floor(baseAttackDamage / 2)) })
  }

  if (LEECH_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'leech', value: Math.max(1, Math.floor(baseAttackDamage * 0.8)) })
  }

  if (STEAL_GOLD_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'steal_gold', value: Math.max(1, Math.ceil(baseAttackDamage / 2)) })
  }

  if (RANDOM_DAMAGE_ENEMY_IDS.has(enemyId)) {
    pattern.push({ type: 'random_damage', value: Math.max(1, Math.floor(baseAttackDamage * 0.7)) })
  }

  if (enemyId === 'mirror_shade') {
    pattern.push({ type: 'random_damage', value: Math.max(1, Math.floor(baseAttackDamage * 0.9)) })
  }

  return pattern
}

function makeEnemyFromTemplate(template: EnemyTemplate, floorsCleared: number): EnemyState {
  const hpRange = BASE_HP_RANGE_BY_TIER[template.tier]
  const attackRange = BASIC_ATTACK_RANGE_BY_TIER[template.tier]
  const baseHp = randomInt(hpRange.min, hpRange.max)
  const baseAttackDamage = randomInt(attackRange.min, attackRange.max)

  const maxHp = scaleByFloor(baseHp, floorsCleared)
  const scaledAttackDamage = scaleByFloor(baseAttackDamage, floorsCleared)

  return {
    id: template.id,
    name: template.name,
    tier: template.tier,
    hp: maxHp,
    maxHp,
    block: 0,
    armor: 0,
    status: emptyStatus(),
    weaknesses: template.weaknesses ?? [],
    pattern: buildEnemySkillset(template.id, scaledAttackDamage),
    patternIndex: 0,
  }
}

export function pickEncounterEnemy(tier: EnemyTier = 'basic', floorsCleared = 0): EnemyState {
  const pool = tier === 'elite' ? ELITE_ENEMY_TEMPLATES : BASIC_ENEMY_TEMPLATES
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  return makeEnemyFromTemplate(chosen, floorsCleared)
}

export function pickEncounterEnemyById(enemyId: string, floorsCleared = 0): EnemyState {
  const allTemplates = [...BASIC_ENEMY_TEMPLATES, ...ELITE_ENEMY_TEMPLATES]
  const template = allTemplates.find(enemy => enemy.id === enemyId)
  if (!template) {
    return pickEncounterEnemy('basic', floorsCleared)
  }
  return makeEnemyFromTemplate(template, floorsCleared)
}
