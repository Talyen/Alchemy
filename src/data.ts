import type { CardDef, CardInstance, EnemyState, StatusEffects } from './types'

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
    id: 'forge',
    name: 'Forge',
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
    description: 'Heal 5 Remove 1 Ailment\nConsume',
    effect: { heal: 5, cleanse: 1 },
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
    description: 'Heal 10\nConsume',
    effect: { heal: 10 },
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
    name: 'Haste',
    cost: 3,
    type: 'skill',
    description: 'Gain Haste',
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
      { cardId: 'forge', count: 1 },
      { cardId: 'meat', count: 1 },
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

export const GOBLIN: EnemyState = {
  id: 'goblin',
  name: 'Goblin',
  hp: 30,
  maxHp: 30,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 6, physical: true },
    { type: 'attack', value: 6, physical: true },
    { type: 'defend', value: 5 },
  ],
  patternIndex: 0,
}

const CHOMP: EnemyState = {
  id: 'chort',
  name: 'Chomp',
  hp: 34,
  maxHp: 34,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 7, physical: true },
    { type: 'defend', value: 5 },
    { type: 'attack', value: 8, physical: true },
  ],
  patternIndex: 0,
}

const IMP: EnemyState = {
  id: 'imp',
  name: 'Imp',
  hp: 26,
  maxHp: 26,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 5, physical: true },
    { type: 'attack', value: 6, physical: true },
    { type: 'defend', value: 4 },
  ],
  patternIndex: 0,
}

const MIMIC: EnemyState = {
  id: 'mimic',
  name: 'Mimic',
  hp: 38,
  maxHp: 38,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'defend', value: 7 },
    { type: 'attack', value: 8, physical: true },
    { type: 'attack', value: 7, physical: true },
  ],
  patternIndex: 0,
}

const LIZARD_F: EnemyState = {
  id: 'lizard_f',
  name: 'Lizard Scout',
  hp: 29,
  maxHp: 29,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 6, physical: true },
    { type: 'defend', value: 4 },
    { type: 'attack', value: 7, physical: true },
  ],
  patternIndex: 0,
}

const LIZARD_M: EnemyState = {
  id: 'lizard_m',
  name: 'Lizard Raider',
  hp: 32,
  maxHp: 32,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 7, physical: true },
    { type: 'attack', value: 6, physical: true },
    { type: 'defend', value: 5 },
  ],
  patternIndex: 0,
}

const MASKED_ORC: EnemyState = {
  id: 'masked_orc',
  name: 'Masked Orc',
  hp: 36,
  maxHp: 36,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 8, physical: true },
    { type: 'defend', value: 5 },
    { type: 'attack', value: 8, physical: true },
  ],
  patternIndex: 0,
}

const MUD_ELEMENTAL: EnemyState = {
  id: 'muddy',
  name: 'Mud Elemental',
  hp: 40,
  maxHp: 40,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'defend', value: 8 },
    { type: 'attack', value: 7, physical: true },
    { type: 'attack', value: 7, physical: true },
  ],
  patternIndex: 0,
}

const NECROMANCER: EnemyState = {
  id: 'necromancer',
  name: 'Necromancer',
  hp: 33,
  maxHp: 33,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'defend', value: 6 },
    { type: 'attack', value: 9, physical: false },
    { type: 'attack', value: 7, physical: false },
  ],
  patternIndex: 0,
}

const ORC_SHAMAN: EnemyState = {
  id: 'orc_shaman',
  name: 'Orc Shaman',
  hp: 35,
  maxHp: 35,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'defend', value: 6 },
    { type: 'attack', value: 8, physical: false },
    { type: 'attack', value: 7, physical: true },
  ],
  patternIndex: 0,
}

const ORC_WARRIOR: EnemyState = {
  id: 'orc_warrior',
  name: 'Orc Warrior',
  hp: 42,
  maxHp: 42,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 9, physical: true },
    { type: 'attack', value: 8, physical: true },
    { type: 'defend', value: 6 },
  ],
  patternIndex: 0,
}

const SKELET: EnemyState = {
  id: 'skelet',
  name: 'Skeleton',
  hp: 31,
  maxHp: 31,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 6, physical: true },
    { type: 'defend', value: 4 },
    { type: 'attack', value: 7, physical: true },
  ],
  patternIndex: 0,
}

const SLUG: EnemyState = {
  id: 'slug',
  name: 'Slug',
  hp: 28,
  maxHp: 28,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 5, physical: true },
    { type: 'defend', value: 5 },
    { type: 'attack', value: 6, physical: true },
  ],
  patternIndex: 0,
}

const SWAMPY: EnemyState = {
  id: 'swampy',
  name: 'Swampy',
  hp: 37,
  maxHp: 37,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'defend', value: 6 },
    { type: 'attack', value: 8, physical: true },
    { type: 'attack', value: 8, physical: true },
  ],
  patternIndex: 0,
}

const PLAGUE_DOCTOR: EnemyState = {
  id: 'doc',
  name: 'Plague Doctor',
  hp: 34,
  maxHp: 34,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 7, physical: false },
    { type: 'defend', value: 5 },
    { type: 'attack', value: 8, physical: false },
  ],
  patternIndex: 0,
}

const DEMON: EnemyState = {
  id: 'big_demon',
  name: 'Demon',
  hp: 58,
  maxHp: 58,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 11, physical: false },
    { type: 'attack', value: 10, physical: true },
    { type: 'defend', value: 8 },
  ],
  patternIndex: 0,
}

const OGRE: EnemyState = {
  id: 'ogre',
  name: 'Ogre',
  hp: 64,
  maxHp: 64,
  block: 0,
  armor: 0,
  status: emptyStatus(),
  pattern: [
    { type: 'attack', value: 12, physical: true },
    { type: 'defend', value: 9 },
    { type: 'attack', value: 10, physical: true },
  ],
  patternIndex: 0,
}

const BASIC_ENEMY_TEMPLATES: EnemyState[] = [
  GOBLIN,
  CHOMP,
  IMP,
  MIMIC,
  LIZARD_F,
  LIZARD_M,
  MASKED_ORC,
  MUD_ELEMENTAL,
  NECROMANCER,
  ORC_SHAMAN,
  ORC_WARRIOR,
  SKELET,
  SLUG,
  SWAMPY,
  PLAGUE_DOCTOR,
]

const ELITE_ENEMY_TEMPLATES: EnemyState[] = [
  DEMON,
  OGRE,
]

function cloneEnemy(template: EnemyState): EnemyState {
  return {
    ...template,
    hp: template.maxHp,
    block: 0,
    armor: template.armor,
    status: emptyStatus(),
    pattern: [...template.pattern],
    patternIndex: 0,
  }
}

export function pickEncounterEnemy(tier: 'basic' | 'elite' = 'basic'): EnemyState {
  const pool = tier === 'elite' ? ELITE_ENEMY_TEMPLATES : BASIC_ENEMY_TEMPLATES
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  return cloneEnemy(chosen)
}
