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
  x: number
  y: number
}

export type TalentBonusSet = {
  startingGold: number
  combatMaxManaBonus: number
  combatStartingBlockBonus: number
  runMaxHpBonus: number
  burnCardBonus: number
  poisonCardBonus: number
  healCardBonus: number
  damageCardBonus: number
}

export const TALENT_ROOT_ID = 'origin'

export const TALENT_NODES: TalentNode[] = [
  { id: TALENT_ROOT_ID, name: 'Origin', description: 'Center of your passive tree. Branch outward from here.', theme: 'neutral', keywords: ['Wish'], x: 760, y: 430 },

  // Upper-left: Holy, Burn, Heal
  { id: 'holy_light', name: 'Holy Light', description: '+1 Heal on cards that Heal.', theme: 'holy', treeKeyword: 'Holy', keywords: ['Holy', 'Heal'], x: 560, y: 290 },
  { id: 'burn_spark', name: 'Burn Spark', description: '+1 Burn on cards that apply Burn.', theme: 'burn', treeKeyword: 'Burn', keywords: ['Burn'], x: 430, y: 190 },
  { id: 'healing_chalice', name: 'Healing Chalice', description: 'Holy effects are not yet implemented. Placeholder node.', theme: 'heal', treeKeyword: 'Heal', keywords: ['Holy', 'Heal'], x: 450, y: 340 },
  { id: 'cinder_mastery', name: 'Cinder Mastery', description: '+1 Burn on cards that apply Burn.', theme: 'burn', treeKeyword: 'Burn', keywords: ['Burn'], x: 300, y: 150 },
  { id: 'restorative_light', name: 'Restorative Light', description: '+1 Heal on cards that Heal.', theme: 'heal', treeKeyword: 'Heal', keywords: ['Heal', 'Holy'], x: 310, y: 360 },

  // Upper: Mana, Mana Crystal
  { id: 'mana_well', name: 'Arcane Well', description: '+1 Max Mana at the start of each combat.', theme: 'mana', treeKeyword: 'Mana', keywords: ['Mana'], x: 760, y: 240 },
  { id: 'mana_crystal_lattice', name: 'Crystal Lattice', description: '+1 Max Mana at the start of each combat.', theme: 'mana', treeKeyword: 'Mana', keywords: ['Mana Crystal'], x: 760, y: 110 },
  { id: 'astral_reservoir', name: 'Astral Reservoir', description: '+1 Max Mana at the start of each combat.', theme: 'mana', treeKeyword: 'Mana', keywords: ['Mana'], x: 760, y: 20 },

  // Upper-right: Poison, Pierce, Bleed, Leech
  { id: 'poison_seed', name: 'Poison Seed', description: '+1 Poison on cards that apply Poison.', theme: 'poison', treeKeyword: 'Poison', keywords: ['Poison'], x: 960, y: 290 },
  { id: 'venom_bloom', name: 'Venom Bloom', description: '+1 Poison on cards that apply Poison.', theme: 'poison', treeKeyword: 'Poison', keywords: ['Poison'], x: 1120, y: 290 },
  { id: 'pierce_edge', name: 'Pierce Edge', description: 'Pierce specialization is not yet implemented. Placeholder node.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Pierce'], x: 1080, y: 190 },
  { id: 'bleed_lattice', name: 'Bleed Lattice', description: 'Bleed specialization is not yet implemented. Placeholder node.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Bleed'], x: 1220, y: 220 },
  { id: 'leech_ritual', name: 'Leech Ritual', description: 'Leech specialization is not yet implemented. Placeholder node.', theme: 'heal', treeKeyword: 'Heal', keywords: ['Leech'], x: 1170, y: 360 },

  // Lower-left: Physical, Blunt, Forge, Block, Armor
  { id: 'physical_training', name: 'Physical Training', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Slash', 'Pierce'], x: 560, y: 580 },
  { id: 'blunt_training', name: 'Blunt Training', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Blunt'], x: 430, y: 690 },
  { id: 'forge_technique', name: 'Forge Technique', description: 'Forge specialization is not yet implemented. Placeholder node.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Forge'], x: 300, y: 760 },
  { id: 'wall_training', name: 'Wall Training', description: '+2 Block at the start of each combat.', theme: 'block', treeKeyword: 'Block', keywords: ['Block'], x: 560, y: 740 },
  { id: 'armor_doctrine', name: 'Armor Doctrine', description: '+2 Block at the start of each combat.', theme: 'block', treeKeyword: 'Block', keywords: ['Armor'], x: 420, y: 820 },
  { id: 'iron_bastion', name: 'Iron Bastion', description: '+2 Block at the start of each combat.', theme: 'block', treeKeyword: 'Block', keywords: ['Armor', 'Block'], x: 300, y: 900 },

  // Lower: Gold, Slash, Wish, Consume
  { id: 'gold_cache', name: 'Golden Cache', description: '+3 starting Gold each run.', theme: 'gold', treeKeyword: 'Gold', keywords: ['Gold'], x: 760, y: 640 },
  { id: 'coin_sense', name: 'Coin Sense', description: '+3 starting Gold each run.', theme: 'gold', treeKeyword: 'Gold', keywords: ['Gold'], x: 760, y: 840 },
  { id: 'slash_rhythm', name: 'Slash Rhythm', description: 'Slash specialization is not yet implemented. Placeholder node.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Slash'], x: 640, y: 760 },
  { id: 'wish_anchor', name: 'Wish Anchor', description: 'Wish specialization is not yet implemented. Placeholder node.', theme: 'holy', treeKeyword: 'Holy', keywords: ['Wish'], x: 880, y: 760 },
  { id: 'consume_rite', name: 'Consume Rite', description: 'Consume specialization is not yet implemented. Placeholder node.', theme: 'gold', treeKeyword: 'Gold', keywords: ['Consume'], x: 760, y: 920 },
  { id: 'wish_conduit', name: 'Wish Conduit', description: 'Wish specialization is not yet implemented. Placeholder node.', theme: 'holy', treeKeyword: 'Holy', keywords: ['Wish'], x: 970, y: 900 },

  // Lower-right: Archery, trap, and utility branch
  { id: 'archery_form', name: 'Archery Form', description: 'Archery is not yet implemented. Placeholder node.', theme: 'neutral', treeKeyword: 'Physical', keywords: ['Pierce'], x: 960, y: 580 },
  { id: 'ranger_focus', name: 'Ranger Focus', description: '+1 Damage on cards that deal direct damage.', theme: 'physical', treeKeyword: 'Physical', keywords: ['Pierce'], x: 1110, y: 660 },
  { id: 'trapcraft', name: 'Trapcraft', description: 'Trap specialization is not yet implemented. Placeholder node.', theme: 'neutral', treeKeyword: 'Physical', keywords: ['Trap'], x: 1120, y: 780 },
  { id: 'snare_line', name: 'Snare Line', description: 'Trap specialization is not yet implemented. Placeholder node.', theme: 'neutral', treeKeyword: 'Physical', keywords: ['Trap'], x: 1260, y: 880 },
]

export const TALENT_LINKS: Array<[string, string]> = [
  [TALENT_ROOT_ID, 'holy_light'],
  [TALENT_ROOT_ID, 'mana_well'],
  [TALENT_ROOT_ID, 'poison_seed'],
  [TALENT_ROOT_ID, 'physical_training'],
  [TALENT_ROOT_ID, 'gold_cache'],
  [TALENT_ROOT_ID, 'archery_form'],

  ['holy_light', 'burn_spark'],
  ['holy_light', 'healing_chalice'],
  ['burn_spark', 'cinder_mastery'],
  ['healing_chalice', 'restorative_light'],

  ['mana_well', 'mana_crystal_lattice'],
  ['mana_crystal_lattice', 'astral_reservoir'],

  ['poison_seed', 'venom_bloom'],
  ['poison_seed', 'pierce_edge'],
  ['pierce_edge', 'bleed_lattice'],
  ['bleed_lattice', 'leech_ritual'],

  ['physical_training', 'blunt_training'],
  ['blunt_training', 'forge_technique'],
  ['physical_training', 'wall_training'],
  ['wall_training', 'armor_doctrine'],
  ['armor_doctrine', 'iron_bastion'],

  ['gold_cache', 'slash_rhythm'],
  ['gold_cache', 'wish_anchor'],
  ['gold_cache', 'coin_sense'],
  ['slash_rhythm', 'consume_rite'],
  ['wish_anchor', 'consume_rite'],
  ['wish_anchor', 'wish_conduit'],
  ['consume_rite', 'wish_conduit'],

  ['archery_form', 'ranger_focus'],
  ['archery_form', 'trapcraft'],
  ['trapcraft', 'snare_line'],
]

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
  return TALENT_NODES.filter(node => node.id === TALENT_ROOT_ID || node.treeKeyword === keyword)
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
    startingGold: 0,
    combatMaxManaBonus: 0,
    combatStartingBlockBonus: 0,
    runMaxHpBonus: 0,
    burnCardBonus: 0,
    poisonCardBonus: 0,
    healCardBonus: 0,
    damageCardBonus: 0,
  }

  if (unlockedNodeIds.has('burn_spark')) bonuses.burnCardBonus += 1
  if (unlockedNodeIds.has('cinder_mastery')) bonuses.burnCardBonus += 1
  if (unlockedNodeIds.has('poison_seed')) bonuses.poisonCardBonus += 1
  if (unlockedNodeIds.has('venom_bloom')) bonuses.poisonCardBonus += 1
  if (unlockedNodeIds.has('gold_cache')) bonuses.startingGold += 3
  if (unlockedNodeIds.has('coin_sense')) bonuses.startingGold += 3
  if (unlockedNodeIds.has('mana_well')) bonuses.combatMaxManaBonus += 1
  if (unlockedNodeIds.has('mana_crystal_lattice')) bonuses.combatMaxManaBonus += 1
  if (unlockedNodeIds.has('astral_reservoir')) bonuses.combatMaxManaBonus += 1
  if (unlockedNodeIds.has('holy_light')) bonuses.healCardBonus += 1
  if (unlockedNodeIds.has('restorative_light')) bonuses.healCardBonus += 1
  if (unlockedNodeIds.has('physical_training')) bonuses.damageCardBonus += 1
  if (unlockedNodeIds.has('blunt_training')) bonuses.damageCardBonus += 1
  if (unlockedNodeIds.has('ranger_focus')) bonuses.damageCardBonus += 1
  if (unlockedNodeIds.has('wall_training')) bonuses.combatStartingBlockBonus += 2
  if (unlockedNodeIds.has('armor_doctrine')) bonuses.combatStartingBlockBonus += 2
  if (unlockedNodeIds.has('iron_bastion')) bonuses.combatStartingBlockBonus += 2

  return bonuses
}

export function getTalentBonusesFromKeywordTrees(unlockedByKeyword: UnlockedTalentNodeIdsByKeyword): TalentBonusSet {
  return getTalentBonuses(flattenUnlockedTalentNodeIds(unlockedByKeyword))
}
