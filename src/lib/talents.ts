export type TalentTheme = 'burn' | 'poison' | 'gold' | 'mana' | 'holy' | 'physical' | 'block' | 'heal' | 'neutral'

export const TALENT_KEYWORDS = ['Burn', 'Poison', 'Mana', 'Gold', 'Physical', 'Block', 'Heal', 'Holy'] as const
export type TalentKeyword = (typeof TALENT_KEYWORDS)[number]

export type TalentNode = {
  id: string
  name: string
  description: string
  theme: TalentTheme
  treeKeyword?: TalentKeyword
  keywords: string[]
  row: 0 | 1 | 2
  col: 0 | 1 | 2 | 3
  x: number
  y: number
}

export type TalentBonusSet = {
  startingGold: number
  combatMaxManaBonus: number
  combatStartingBlockBonus: number
  runMaxHpBonus: number
  burnCardBonus: number
  burnDamageBonus: number
  burnVsBlockDouble: boolean
  burnDamageTakenHalf: boolean
  holyFromBurnPercent: number
  drawExtraBurnCardPerTurn: number
  pyromania: boolean
  poisonCardBonus: number
  healCardBonus: number
  damageCardBonus: number
}

export const TALENT_ROOT_ID = 'origin'

const TREE_DEFS: Record<TalentKeyword, {
  theme: TalentTheme
  leftTier1: Omit<TalentNode, 'id' | 'treeKeyword' | 'x' | 'y' | 'row' | 'col'>
  rightTier1: Omit<TalentNode, 'id' | 'treeKeyword' | 'x' | 'y' | 'row' | 'col'>
  tier2: Array<Omit<TalentNode, 'id' | 'treeKeyword' | 'x' | 'y' | 'row' | 'col'>>
}> = {
  Burn: {
    theme: 'burn',
    leftTier1: { name: 'Controlled Burn', description: '+1 Burn Damage.', theme: 'burn', keywords: ['Burn'] },
    rightTier1: { name: 'Melt Armor', description: 'Burn deals double Damage against Block.', theme: 'burn', keywords: ['Burn', 'Armor'] },
    tier2: [
      { name: 'Avatar of Fire', description: 'Reduce Burn Damage taken by half.', theme: 'burn', keywords: ['Burn'] },
      { name: 'Holy Flame', description: 'Deal Holy Damage equal to 20% of Burn Damage.', theme: 'holy', keywords: ['Holy', 'Burn'] },
      { name: 'Hot Streak', description: 'Draw an extra Burn card each turn.', theme: 'burn', keywords: ['Burn'] },
      { name: 'Pyromania', description: 'Enemies with more than 10 Burn take double Burn damage.', theme: 'burn', keywords: ['Burn'] },
    ],
  },
  Poison: {
    theme: 'poison',
    leftTier1: { name: 'Poison Seed', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
    rightTier1: { name: 'Venom Thread', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
    tier2: [
      { name: 'Toxic Bloom', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
      { name: 'Noxious Ring', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
      { name: 'Fume Pulse', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
      { name: 'Nightshade Crown', description: '+1 Poison on cards that apply Poison.', theme: 'poison', keywords: ['Poison'] },
    ],
  },
  Mana: {
    theme: 'mana',
    leftTier1: { name: 'Arcane Well', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana'] },
    rightTier1: { name: 'Crystal Lattice', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana Crystal'] },
    tier2: [
      { name: 'Astral Reservoir', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana'] },
      { name: 'Blue Current', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana'] },
      { name: 'Gem Chorus', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana Crystal'] },
      { name: 'Leykeeper', description: '+1 Max Mana at the start of each combat.', theme: 'mana', keywords: ['Mana'] },
    ],
  },
  Gold: {
    theme: 'gold',
    leftTier1: { name: 'Golden Cache', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
    rightTier1: { name: 'Coin Sense', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
    tier2: [
      { name: 'Gilded Palm', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
      { name: 'Mint Whisper', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
      { name: 'Treasure Habit', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
      { name: 'Royal Tithe', description: '+3 starting Gold each run.', theme: 'gold', keywords: ['Gold'] },
    ],
  },
  Physical: {
    theme: 'physical',
    leftTier1: { name: 'Physical Training', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Slash', 'Pierce'] },
    rightTier1: { name: 'Blunt Training', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Blunt'] },
    tier2: [
      { name: 'Ranger Focus', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Pierce'] },
      { name: 'Steel Rhythm', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Slash'] },
      { name: 'Forge Technique', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Forge'] },
      { name: 'Trapcraft', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', keywords: ['Trap'] },
    ],
  },
  Block: {
    theme: 'block',
    leftTier1: { name: 'Wall Training', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Block'] },
    rightTier1: { name: 'Armor Doctrine', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Armor'] },
    tier2: [
      { name: 'Iron Bastion', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Block', 'Armor'] },
      { name: 'Bulwark Form', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Block'] },
      { name: 'Brace Instinct', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Armor'] },
      { name: 'Shield Circuit', description: '+2 Block at the start of each combat.', theme: 'block', keywords: ['Block'] },
    ],
  },
  Heal: {
    theme: 'heal',
    leftTier1: { name: 'Holy Light', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Heal', 'Holy'] },
    rightTier1: { name: 'Restorative Light', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Heal'] },
    tier2: [
      { name: 'Healing Chalice', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Heal'] },
      { name: 'Mercy Well', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Heal'] },
      { name: 'Leech Ritual', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Leech'] },
      { name: 'Sanctuary Tide', description: '+1 Heal on cards that Heal.', theme: 'heal', keywords: ['Heal'] },
    ],
  },
  Holy: {
    theme: 'holy',
    leftTier1: { name: 'Wish Anchor', description: 'Holy specialization node.', theme: 'holy', keywords: ['Wish', 'Holy'] },
    rightTier1: { name: 'Wish Conduit', description: 'Holy specialization node.', theme: 'holy', keywords: ['Wish', 'Holy'] },
    tier2: [
      { name: 'Light Compass', description: 'Holy specialization node.', theme: 'holy', keywords: ['Holy'] },
      { name: 'Radiant Choir', description: 'Holy specialization node.', theme: 'holy', keywords: ['Holy'] },
      { name: 'Blessed Engine', description: 'Holy specialization node.', theme: 'holy', keywords: ['Holy'] },
      { name: 'Celestial Mark', description: 'Holy specialization node.', theme: 'holy', keywords: ['Holy'] },
    ],
  },
}

function nodeId(keyword: TalentKeyword, tier: 't1' | 't2', index: number): string {
  return `${keyword.toLowerCase()}_${tier}_${index}`
}

function buildKeywordTree(keyword: TalentKeyword): TalentNode[] {
  const def = TREE_DEFS[keyword]
  return [
    {
      ...def.leftTier1,
      id: nodeId(keyword, 't1', 0),
      treeKeyword: keyword,
      row: 1,
      col: 0,
      x: 0,
      y: 0,
    },
    {
      ...def.rightTier1,
      id: nodeId(keyword, 't1', 1),
      treeKeyword: keyword,
      row: 1,
      col: 1,
      x: 0,
      y: 0,
    },
    ...def.tier2.map((tierNode, index) => ({
      ...tierNode,
      id: nodeId(keyword, 't2', index),
      treeKeyword: keyword,
      row: 2 as const,
      col: index as 0 | 1 | 2 | 3,
      x: 0,
      y: 0,
    })),
  ]
}

export const TALENT_NODES: TalentNode[] = [
  {
    id: TALENT_ROOT_ID,
    name: 'Origin',
    description: 'Start here, then branch upward.',
    theme: 'neutral',
    keywords: ['Wish'],
    row: 0,
    col: 0,
    x: 0,
    y: 0,
  },
  ...TALENT_KEYWORDS.flatMap(buildKeywordTree),
]

export const TALENT_LINKS: Array<[string, string]> = TALENT_KEYWORDS.flatMap(keyword => [
  [TALENT_ROOT_ID, nodeId(keyword, 't1', 0)],
  [TALENT_ROOT_ID, nodeId(keyword, 't1', 1)],
  [nodeId(keyword, 't1', 0), nodeId(keyword, 't2', 0)],
  [nodeId(keyword, 't1', 0), nodeId(keyword, 't2', 1)],
  [nodeId(keyword, 't1', 1), nodeId(keyword, 't2', 2)],
  [nodeId(keyword, 't1', 1), nodeId(keyword, 't2', 3)],
])

export function getTalentThemeClasses(theme: TalentTheme): { ring: string; text: string; glow: string } {
  switch (theme) {
    case 'burn':
      return { ring: 'border-orange-500/70', text: 'text-orange-300', glow: 'rgba(249,115,22,0.24)' }
    case 'poison':
      return { ring: 'border-emerald-500/70', text: 'text-emerald-300', glow: 'rgba(16,185,129,0.24)' }
    case 'gold':
      return { ring: 'border-amber-500/70', text: 'text-amber-300', glow: 'rgba(245,158,11,0.24)' }
    case 'mana':
      return { ring: 'border-sky-500/70', text: 'text-sky-300', glow: 'rgba(14,165,233,0.24)' }
    case 'holy':
      return { ring: 'border-yellow-300/70', text: 'text-yellow-200', glow: 'rgba(253,224,71,0.24)' }
    case 'physical':
      return { ring: 'border-rose-500/70', text: 'text-rose-300', glow: 'rgba(244,63,94,0.24)' }
    case 'block':
      return { ring: 'border-indigo-500/70', text: 'text-indigo-300', glow: 'rgba(99,102,241,0.24)' }
    case 'heal':
      return { ring: 'border-lime-500/70', text: 'text-lime-300', glow: 'rgba(132,204,22,0.24)' }
    case 'neutral':
      return { ring: 'border-zinc-500/70', text: 'text-zinc-200', glow: 'rgba(113,113,122,0.24)' }
    default:
      return { ring: 'border-zinc-600', text: 'text-zinc-300', glow: 'rgba(113,113,122,0.2)' }
  }
}

function nodeById(nodeId: string, nodes: TalentNode[]): TalentNode | undefined {
  return nodes.find(node => node.id === nodeId)
}

function neighborsOf(nodeId: string, links: Array<[string, string]>): string[] {
  const neighbors: string[] = []
  for (const [a, b] of links) {
    if (a === nodeId) neighbors.push(b)
    if (b === nodeId) neighbors.push(a)
  }
  return neighbors
}

export function getTalentNodesForKeyword(keyword: TalentKeyword): TalentNode[] {
  const nodes = TALENT_NODES.filter(node => node.id === TALENT_ROOT_ID || node.treeKeyword === keyword)
  if (keyword !== 'Burn') return nodes
  return nodes.map(node => {
    if (node.id !== TALENT_ROOT_ID) return node
    return {
      ...node,
      name: 'Novice Arsonist',
      description: 'Apply an additional Burn.',
      theme: 'burn',
      keywords: ['Burn'],
    }
  })
}

export function getTalentLinksForNodes(nodes: TalentNode[]): Array<[string, string]> {
  const validNodeIds = new Set(nodes.map(node => node.id))
  return TALENT_LINKS.filter(([from, to]) => validNodeIds.has(from) && validNodeIds.has(to))
}

export function canUnlockTalent(nodeId: string, unlockedNodeIds: Set<string>, nodes = TALENT_NODES, links = TALENT_LINKS): boolean {
  if (!nodeById(nodeId, nodes)) return false
  if (unlockedNodeIds.has(nodeId)) return false

  // First purchase must start at center.
  if (unlockedNodeIds.size === 0) return nodeId === TALENT_ROOT_ID
  return neighborsOf(nodeId, links).some(neighbor => unlockedNodeIds.has(neighbor))
}

export type UnlockedTalentNodeIdsByKeyword = Record<TalentKeyword, Set<string>>

export function getEmptyUnlockedTalentNodeIdsByKeyword(): UnlockedTalentNodeIdsByKeyword {
  return {
    Burn: new Set(),
    Poison: new Set(),
    Mana: new Set(),
    Gold: new Set(),
    Physical: new Set(),
    Block: new Set(),
    Heal: new Set(),
    Holy: new Set(),
  }
}

export function flattenUnlockedTalentNodeIds(unlockedByKeyword: UnlockedTalentNodeIdsByKeyword): Set<string> {
  const flattened = new Set<string>()
  for (const keyword of TALENT_KEYWORDS) {
    for (const nodeId of unlockedByKeyword[keyword]) {
      flattened.add(nodeId)
    }
  }
  return flattened
}

export function getTalentBonuses(unlockedNodeIds: Set<string>): TalentBonusSet {
  const bonuses: TalentBonusSet = {
    startingGold: 25,
    combatMaxManaBonus: 0,
    combatStartingBlockBonus: 0,
    runMaxHpBonus: 0,
    burnCardBonus: 0,
    burnDamageBonus: 0,
    burnVsBlockDouble: false,
    burnDamageTakenHalf: false,
    holyFromBurnPercent: 0,
    drawExtraBurnCardPerTurn: 0,
    pyromania: false,
    poisonCardBonus: 0,
    healCardBonus: 0,
    damageCardBonus: 0,
  }

  for (const keyword of TALENT_KEYWORDS) {
    if (unlockedNodeIds.has(nodeId(keyword, 't1', 0))) {
      if (keyword === 'Burn') bonuses.burnCardBonus += 1
      if (keyword === 'Poison') bonuses.poisonCardBonus += 1
      if (keyword === 'Mana') bonuses.combatMaxManaBonus += 1
      if (keyword === 'Gold') bonuses.startingGold += 3
      if (keyword === 'Physical') bonuses.damageCardBonus += 1
      if (keyword === 'Block') bonuses.combatStartingBlockBonus += 2
      if (keyword === 'Heal') bonuses.healCardBonus += 1
    }

    if (unlockedNodeIds.has(nodeId(keyword, 't1', 1))) {
      if (keyword === 'Burn') bonuses.burnCardBonus += 1
      if (keyword === 'Poison') bonuses.poisonCardBonus += 1
      if (keyword === 'Mana') bonuses.combatMaxManaBonus += 1
      if (keyword === 'Gold') bonuses.startingGold += 3
      if (keyword === 'Physical') bonuses.damageCardBonus += 1
      if (keyword === 'Block') bonuses.combatStartingBlockBonus += 2
      if (keyword === 'Heal') bonuses.healCardBonus += 1
    }

    for (let tier2Index = 0; tier2Index < 4; tier2Index += 1) {
      if (!unlockedNodeIds.has(nodeId(keyword, 't2', tier2Index))) continue
      if (keyword === 'Burn') bonuses.burnCardBonus += 1
      if (keyword === 'Poison') bonuses.poisonCardBonus += 1
      if (keyword === 'Mana') bonuses.combatMaxManaBonus += 1
      if (keyword === 'Gold') bonuses.startingGold += 3
      if (keyword === 'Physical') bonuses.damageCardBonus += 1
      if (keyword === 'Block') bonuses.combatStartingBlockBonus += 2
      if (keyword === 'Heal') bonuses.healCardBonus += 1
    }
  }

  return bonuses
}

export function getTalentBonusesFromKeywordTrees(unlockedByKeyword: UnlockedTalentNodeIdsByKeyword): TalentBonusSet {
  const bonuses = getTalentBonuses(flattenUnlockedTalentNodeIds(unlockedByKeyword))
  const burnUnlocked = unlockedByKeyword.Burn

  if (burnUnlocked.has(TALENT_ROOT_ID)) bonuses.burnCardBonus += 1
  if (burnUnlocked.has('burn_t1_0')) bonuses.burnDamageBonus += 1
  if (burnUnlocked.has('burn_t1_1')) bonuses.burnVsBlockDouble = true
  if (burnUnlocked.has('burn_t2_0')) bonuses.burnDamageTakenHalf = true
  if (burnUnlocked.has('burn_t2_1')) bonuses.holyFromBurnPercent = 0.2
  if (burnUnlocked.has('burn_t2_2')) bonuses.drawExtraBurnCardPerTurn += 1
  if (burnUnlocked.has('burn_t2_3')) bonuses.pyromania = true

  return bonuses
}
