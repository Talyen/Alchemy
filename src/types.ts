export type CardType = 'attack' | 'skill' | 'power' | 'upgrade' | 'heal'

export type CardEffect = {
  damage?: number
  mana?: number
  block?: number
  vulnerable?: number
  weak?: number
  armor?: number
  heal?: number
  forge?: number
  leech?: boolean
  burn?: number      // burn stacks to apply to enemy
  poison?: number    // poison stacks to apply to enemy
  bleed?: number     // bleed stacks to apply to enemy
  selfBurn?: number  // burn stacks to apply to self
  gold?: number      // run-persistent gold gain
  manaCrystal?: number // battle-persistent max mana increase
  haste?: number     // extra turns to take after this one
  cleanse?: number   // remove negative status effects from self
  trap?: number      // trap damage stored until next incoming attack
  wish?: number      // number of wish picks to resolve
}

export type CardDef = {
  id: string
  name: string
  cost: number
  type: CardType
  description: string
  effect: CardEffect
}

export type CardInstance = CardDef & { uid: string }

export type ActiveUpgrade = {
  id: string
  name: string
  description: string
  effect: CardEffect
}

export type TrinketDef = {
  id: string
  name: string
  description: string
}

export type StatusEffects = {
  vulnerable: number // turns remaining
  weak: number
  strength: number
  forge: number      // permanent: each point adds 1 to physical damage
  burn:  number      // ticking fire DOT — deals burn damage then decrements by 1 each turn
  poison: number     // ticking DOT — deals poison damage each turn
  bleed: number      // delayed DOT — deals 2x at next turn start, then clears
  trap: number       // stored trap damage that triggers when attacked
}

export type Fighter = {
  hp: number
  maxHp: number
  block: number
  armor: number
  status: StatusEffects
}

export type EnemyIntent = {
  type: 'attack' | 'defend' | 'heal' | 'upgrade'
  value: number
  physical?: boolean  // if true, player Armor reduces this attack
}

export type EnemyState = Fighter & {
  id: string
  name: string
  pattern: EnemyIntent[]
  patternIndex: number
}

export type GamePhase = 'player_turn' | 'enemy_turn' | 'win' | 'lose'

export type MapNodeType = 'enemy' | 'elite' | 'rest' | 'shop' | 'mystery' | 'boss'

export type MapNode = {
  id: string
  type: MapNodeType
  col: number
  row: number
  connections: string[]  // ids of nodes in the next column
  visited: boolean
}

export type MapState = {
  nodes: MapNode[]
}

export type GameState = {
  characterId: string
  trinketIds: string[]
  phase: GamePhase
  turn: number
  player: Fighter
  enemy: EnemyState
  hand: CardInstance[]
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]
  mana: number
  maxMana: number
  extraTurns: number
  wishOptions: CardDef[]
  gold: number
  log: string[]
  lastCardPlayedId: string | null
  activeUpgrades: ActiveUpgrade[]
}
