/**
 * Enemy Simulation Tests
 *
 * Validates enemy combat mechanics using direct simulation:
 *   - Basic attack, armor, and block absorption
 *   - Vulnerable / Weak / Strength / Forge modifiers
 *   - Enemy weaknesses (Burn → orcs/frost_imp, Blunt → skeleton)
 *   - Enemy DOT ticks: burn (decrement), poison (persistent), bleed (2× then clear)
 *   - Player DOT ticks (same rules from beginNextPlayerTurn)
 *   - Enemy-specific abilities: Bleed, Poison, Burn, Chill, Leech, Upgrade, Defend, Heal
 *   - Freeze mechanic (enemy chill ≥ 20 % maxHp → loses action)
 *   - Trap (player trap triggers on next enemy attack)
 *   - Every enemy in the bestiary can be spawned without error
 */

import { expect, test } from '@playwright/test'
import {
  beginNextPlayerTurn,
  createGame,
  endTurn,
  playCard,
  resolveEnemyAction,
  resolveEnemyStartOfTurn,
} from '../src/combat'
import { ALL_CARDS, BESTIARY_ENEMIES, emptyStatus } from '../src/data'
import type { CardDef, EnemyIntent, GameState } from '../src/types'

test.describe.configure({ mode: 'parallel' })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cardById(id: string): CardDef {
  const c = ALL_CARDS.find(x => x.id === id)
  if (!c) throw new Error(`Unknown card: ${id}`)
  return c
}

/**
 * Create a clean, deterministic game state. Player and enemy both start fresh
 * with no ailments, full block cleared, and a controlled HP value.
 */
function cleanState(
  enemyId: string,
  deckCards: CardDef[] = [cardById('defend')],
  trinketIds: string[] = [],
): GameState {
  const base = createGame(60, [], 'elite', 0, 'knight', enemyId, trinketIds, deckCards, 0)
  return {
    ...base,
    mana: 10,
    maxMana: 10,
    extraTurns: 0,
    player: {
      ...base.player,
      hp: 50,
      maxHp: 50,
      block: 0,
      armor: 0,
      status: emptyStatus(),
    },
    enemy: {
      ...base.enemy,
      hp: 80,
      maxHp: 80,
      block: 0,
      armor: 0,
      status: emptyStatus(),
    },
  }
}

/** Replace the enemy's entire action pattern with a single deterministic intent. */
function forceIntent(state: GameState, intent: EnemyIntent): GameState {
  return { ...state, enemy: { ...state.enemy, pattern: [intent] } }
}

/**
 * Transition to enemy_turn phase without calling startEnemyTurn.
 * Useful for testing DOT ticks and beginNextPlayerTurn in isolation.
 */
function toEnemyPhase(state: GameState): GameState {
  return {
    ...state,
    phase: 'enemy_turn' as const,
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    lastCardPlayedId: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic attack mechanics
// ─────────────────────────────────────────────────────────────────────────────

test('enemy attack: basic physical damage reduces player HP', () => {
  const s = forceIntent(cleanState('goblin'), { type: 'attack', value: 10, physical: true })
  const after = endTurn(s)
  // calcDamage(10, emptyStatus, emptyStatus) = 10; armor=0, block=0
  expect(after.player.hp).toBe(40)
})

test('enemy attack: player ARMOR absorbs physical attack damage', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, player: { ...base.player, armor: 3 } },
    { type: 'attack', value: 10, physical: true },
  )
  const after = endTurn(s)
  // rawDmg=10, armorReduction=3, dmg=7
  expect(after.player.hp).toBe(43)
})

test('enemy attack: player BLOCK absorbs attack damage first', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, player: { ...base.player, block: 5 } },
    { type: 'attack', value: 8, physical: true },
  )
  const after = endTurn(s)
  // absorbed=5, player.hp -= (8-5)=3
  expect(after.player.hp).toBe(47)
  expect(after.player.block).toBe(0)
})

test('enemy attack: player ARMOR does NOT reduce non-physical intent damage', () => {
  const base = cleanState('goblin')
  // burn intent is non-physical; armor must not reduce it
  const s = forceIntent(
    { ...base, player: { ...base.player, armor: 3 } },
    { type: 'burn', value: 4 },
  )
  const after = endTurn(s)
  // burn intent → player gains 4 burn; beginNextPlayerTurn ticks burn: 4 dmg, burn→3
  // armor does NOT apply to the burn tick
  expect(after.player.hp).toBe(46) // 50 - 4 burn tick (no armor absorption)
  expect(after.player.status.burn).toBe(3) // 4 applied, ticks to 3
})

test('enemy attack: enemy STRENGTH boosts attack damage', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), strength: 2 } } },
    { type: 'attack', value: 6, physical: true },
  )
  const after = endTurn(s)
  // calcDamage(6, {strength:2}, emptyStatus) = 6+2 = 8
  expect(after.player.hp).toBe(42)
})

// ─────────────────────────────────────────────────────────────────────────────
// Status effect modifiers on player attacks
// ─────────────────────────────────────────────────────────────────────────────

test('player attack: enemy VULNERABLE → 1.5× damage', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), vulnerable: 1 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, emptyStatus, {vulnerable:1}): 4 → floor(4*1.5)=6
  expect(after.enemy.hp).toBe(74)
})

test('player attack: player WEAK → 0.75× damage', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = { ...base, player: { ...base.player, status: { ...emptyStatus(), weak: 1 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, {weak:1}, emptyStatus): floor(4*0.75)=3
  expect(after.enemy.hp).toBe(77)
})

test('player attack: WEAK + VULNERABLE partially cancel (4 → 3 → floor 4)', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = {
    ...base,
    player: { ...base.player, status: { ...emptyStatus(), weak: 1 } },
    enemy: { ...base.enemy, status: { ...emptyStatus(), vulnerable: 1 } },
  }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // 4 → weak: floor(4*0.75)=3 → vulnerable: floor(3*1.5)=4
  expect(after.enemy.hp).toBe(76)
})

test('player attack: VULNERABLE does NOT affect burn damage (only weaknesses array does)', () => {
  // vulnerable multiplies calcDamage; burn uses applyEnemyWeaknessMultiplier instead
  const base = cleanState('goblin', [cardById('fireball')])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), vulnerable: 1 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // fireball: burn=3; goblin has no burn weakness → burnDamage=3 (vulnerable ignored)
  expect(after.enemy.hp).toBe(77)
})

test('player attack: player STRENGTH adds to damage', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = { ...base, player: { ...base.player, status: { ...emptyStatus(), strength: 3 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, {strength:3, forge:0}, emptyStatus) = 7
  expect(after.enemy.hp).toBe(73)
})

test('player attack: player FORGE adds to damage', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = { ...base, player: { ...base.player, status: { ...emptyStatus(), forge: 2 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, {forge:2, strength:0}, emptyStatus) = 6
  expect(after.enemy.hp).toBe(74)
})

test('player attack: STRENGTH + FORGE stack additively', () => {
  const base = cleanState('goblin', [cardById('slash')])
  const s = { ...base, player: { ...base.player, status: { ...emptyStatus(), strength: 2, forge: 3 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, {strength:2, forge:3}, emptyStatus) = 9
  expect(after.enemy.hp).toBe(71)
})

// ─────────────────────────────────────────────────────────────────────────────
// Enemy weaknesses: Burn
// ─────────────────────────────────────────────────────────────────────────────

test('burn weakness: applying burn deals 2× immediate damage', () => {
  // orc_warrior weaknesses: ['burn']
  const s = cleanState('orc_warrior', [cardById('fireball')])
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // fireball burn=3; weakness → burnDamage = 3*2 = 6
  expect(after.enemy.hp).toBe(74)
  // burn STACKS are never doubled by weakness
  expect(after.enemy.status.burn).toBe(3)
})

test('burn weakness: burn TICK also deals 2× damage on burn-weak enemy', () => {
  // frost_imp weaknesses: ['burn']
  const base = cleanState('frost_imp')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, hp: 50, maxHp: 80, status: { ...emptyStatus(), burn: 4 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // applyEnemyWeaknessMultiplier(frost_imp, 4, 'burn') → 4*2=8
  expect(after.enemy.hp).toBe(42)
  expect(after.enemy.status.burn).toBe(3)
})

test('burn weakness: non-burn attack cards are NOT doubled on burn-weak enemy', () => {
  // orc_warrior has burn weakness only
  const s = cleanState('orc_warrior', [cardById('slash')])
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // slash: pierce damage; inferDirectDamageWeaknessType('slash') = null
  expect(after.enemy.hp).toBe(76)
})

// ─────────────────────────────────────────────────────────────────────────────
// Enemy weaknesses: Blunt
// ─────────────────────────────────────────────────────────────────────────────

test('blunt weakness: bash doubles damage against skeleton', () => {
  // skelet weaknesses: ['blunt']
  const s = cleanState('skelet', [cardById('bash')])
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(8, emptyStatus, emptyStatus)=8; bash → blunt weakness → 8*2=16
  expect(after.enemy.hp).toBe(64)
})

test('blunt weakness: slash does NOT exploit blunt weakness (pierce, not blunt)', () => {
  const s = cleanState('skelet', [cardById('slash')])
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // inferDirectDamageWeaknessType('slash') = null → no doubling
  expect(after.enemy.hp).toBe(76)
})

test('blunt weakness: burn cards are NOT doubled by blunt weakness', () => {
  // skeleton has blunt weakness, not burn weakness
  const s = cleanState('skelet', [cardById('fireball')])
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // fireball: burnDamage=3 (no burn weakness on skeleton)
  expect(after.enemy.hp).toBe(77)
})

// ─────────────────────────────────────────────────────────────────────────────
// Enemy DOT ticks (resolveEnemyStartOfTurn)
// ─────────────────────────────────────────────────────────────────────────────

test('enemy DOT: burn ticks for burn stacks then DECREMENTS by 1', () => {
  const base = cleanState('goblin')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 5 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  expect(after.enemy.hp).toBe(75)
  expect(after.enemy.status.burn).toBe(4)
})

test('enemy DOT: poison ticks for poison stacks but does NOT decrement', () => {
  const base = cleanState('goblin')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), poison: 3 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  expect(after.enemy.hp).toBe(77)
  expect(after.enemy.status.poison).toBe(3) // persistent — no decrement
})

test('enemy DOT: bleed ticks for 2× stacks then CLEARS to 0', () => {
  const base = cleanState('goblin')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), bleed: 4 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  expect(after.enemy.hp).toBe(72) // 4*2=8
  expect(after.enemy.status.bleed).toBe(0)
})

test('enemy DOT: burn → poison → bleed resolve in order', () => {
  const base = cleanState('goblin')
  const s = toEnemyPhase({
    ...base,
    enemy: {
      ...base.enemy,
      hp: 60,
      maxHp: 80,
      status: { ...emptyStatus(), burn: 3, poison: 4, bleed: 2 },
    },
  })
  const after = resolveEnemyStartOfTurn(s)
  // burn tick  : 3 dmg, burn=2 → hp 57
  // poison tick: 4 dmg, poison=4 (persistent) → hp 53
  // bleed tick : 2*2=4 dmg, bleed=0 → hp 49
  expect(after.enemy.hp).toBe(49)
  expect(after.enemy.status.burn).toBe(2)
  expect(after.enemy.status.poison).toBe(4)
  expect(after.enemy.status.bleed).toBe(0)
})

test('enemy DOT: burn can kill the enemy before their action (phase → win)', () => {
  const base = cleanState('goblin')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, hp: 3, maxHp: 80, status: { ...emptyStatus(), burn: 5 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  expect(after.phase).toBe('win')
})

// ─────────────────────────────────────────────────────────────────────────────
// Player DOT ticks (beginNextPlayerTurn)
// ─────────────────────────────────────────────────────────────────────────────

test('player DOT: burn ticks for burn stacks then DECREMENTS by 1', () => {
  const base = cleanState('goblin')
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, hp: 50, status: { ...emptyStatus(), burn: 4 } },
  }
  const after = beginNextPlayerTurn(s)
  // actualBurnDmg = floor((4 - 0) * 1) = 4
  expect(after.player.hp).toBe(46)
  expect(after.player.status.burn).toBe(3)
})

test('player DOT: poison ticks for poison stacks but does NOT decrement', () => {
  const base = cleanState('goblin')
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, hp: 50, status: { ...emptyStatus(), poison: 6 } },
  }
  const after = beginNextPlayerTurn(s)
  expect(after.player.hp).toBe(44)
  expect(after.player.status.poison).toBe(6) // persistent
})

test('player DOT: bleed ticks for 2× stacks then CLEARS to 0', () => {
  const base = cleanState('goblin')
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, hp: 50, status: { ...emptyStatus(), bleed: 3 } },
  }
  const after = beginNextPlayerTurn(s)
  // rawBleed=3*2=6; armor=0; bleedDmg=6
  expect(after.player.hp).toBe(44)
  expect(after.player.status.bleed).toBe(0)
})

test('player DOT: ARMOR reduces player bleed damage', () => {
  const base = cleanState('goblin')
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, hp: 50, armor: 2, status: { ...emptyStatus(), bleed: 3 } },
  }
  const after = beginNextPlayerTurn(s)
  // rawBleed=6, armorReduction=2, bleedDmg=4
  expect(after.player.hp).toBe(46)
})

test('player DOT: burn → poison → bleed all tick in the same turn-start', () => {
  const base = cleanState('goblin')
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: {
      ...base.player,
      hp: 40,
      status: { ...emptyStatus(), burn: 2, poison: 3, bleed: 1 },
    },
  }
  const after = beginNextPlayerTurn(s)
  // burn tick  : floor(2*1)=2, burn=1 → hp 38
  // poison tick: 3 dmg, poison=3 → hp 35
  // bleed tick : 1*2=2 dmg, bleed=0 → hp 33
  expect(after.player.hp).toBe(33)
  expect(after.player.status.burn).toBe(1)
  expect(after.player.status.poison).toBe(3)
  expect(after.player.status.bleed).toBe(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Enemy-specific ability intents
// ─────────────────────────────────────────────────────────────────────────────

test('enemy bleed intent (chort/bite): inflicts bleed on player', () => {
  // Call resolveEnemyAction directly to observe bleed stacks before
  // beginNextPlayerTurn would tick+clear them.
  const base = forceIntent(cleanState('chort'), { type: 'bleed', value: 3 })
  const inEnemyPhase = toEnemyPhase(base)
  // no enemy ailments → resolveEnemyStartOfTurn is a no-op
  const afterStart = resolveEnemyStartOfTurn(inEnemyPhase)
  const afterAction = resolveEnemyAction(afterStart)
  expect(afterAction.player.status.bleed).toBe(3)
})

test('enemy poison intent (muddy): inflicts poison on player', () => {
  const s = forceIntent(cleanState('muddy'), { type: 'poison', value: 2 })
  const after = endTurn(s)
  expect(after.player.status.poison).toBe(2)
})

test('enemy burn intent (flaming_skull): inflicts burn on player', () => {
  // burn is applied, then beginNextPlayerTurn ticks it once (4→3, player takes 4 dmg)
  const s = forceIntent(cleanState('flaming_skull'), { type: 'burn', value: 4 })
  const after = endTurn(s)
  expect(after.player.status.burn).toBe(3) // 4 applied then ticked to 3
  expect(after.player.hp).toBe(46)         // 50 - 4 burn tick
})

test('enemy chill intent (frost_imp): inflicts chill stacks on player', () => {
  const s = forceIntent(cleanState('frost_imp'), { type: 'chill', value: 3 })
  const after = endTurn(s)
  // player chill is stored (but has no freeze mechanic for players, only enemies)
  expect(after.player.status.chill).toBe(3)
})

test('enemy leech intent (blood_goblin): damages player AND heals self', () => {
  const base = cleanState('blood_goblin')
  const s = forceIntent(
    { ...base, enemy: { ...base.enemy, hp: 70, maxHp: 80 } },
    { type: 'leech', value: 5 },
  )
  const after = endTurn(s)
  // calcDamage(5, emptyStatus, emptyStatus)=5; player.hp-=5; enemy.hp=min(80, 70+5)=75
  expect(after.player.hp).toBe(45)
  expect(after.enemy.hp).toBe(75)
})

test('enemy defend intent: enemy gains block', () => {
  const s = forceIntent(cleanState('goblin'), { type: 'defend', value: 6 })
  const after = endTurn(s)
  expect(after.enemy.block).toBe(6)
})

test('enemy heal intent: enemy heals but cannot exceed maxHp', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, enemy: { ...base.enemy, hp: 70, maxHp: 80 } },
    { type: 'heal', value: 15 },
  )
  const after = endTurn(s)
  // healed = min(15, 80-70) = 10
  expect(after.enemy.hp).toBe(80)
})

test('enemy upgrade intent: enemy gains armor and +1 strength', () => {
  const s = forceIntent(cleanState('goblin'), { type: 'upgrade', value: 2 })
  const after = endTurn(s)
  expect(after.enemy.armor).toBe(2)
  expect(after.enemy.status.strength).toBe(1)
})

test('enemy random_damage (prismatic enemies): always reduces player HP in some way', () => {
  // random_damage picks one of: attack / burn / poison / bleed
  // all four options reduce player HP either directly or via DOT tick in beginNextPlayerTurn
  const s = forceIntent(cleanState('prismatic_slug'), { type: 'random_damage', value: 6 })
  const after = endTurn(s)
  expect(after.player.hp).toBeLessThan(50)
})

// ─────────────────────────────────────────────────────────────────────────────
// Chill freeze mechanic
// ─────────────────────────────────────────────────────────────────────────────

test('chill freeze: enemy loses their action when chill ≥ 20% of maxHp', () => {
  const base = cleanState('goblin')
  // freeze threshold = ceil(20 * 0.2) = 4
  const s = forceIntent(
    {
      ...base,
      enemy: {
        ...base.enemy,
        hp: 20,
        maxHp: 20,
        status: { ...emptyStatus(), chill: 4 }, // at threshold
      },
    },
    { type: 'attack', value: 15, physical: true }, // would hit hard if it fires
  )
  const after = endTurn(s)
  // enemy froze → attack never resolved → player HP unchanged
  expect(after.player.hp).toBe(50)
  expect(after.enemy.status.chill).toBe(0)
})

test('chill freeze: enemy below threshold still attacks normally', () => {
  const base = cleanState('goblin')
  // threshold for maxHp=20 is 4; chill=3 is under threshold
  const s = forceIntent(
    {
      ...base,
      enemy: {
        ...base.enemy,
        hp: 20,
        maxHp: 20,
        status: { ...emptyStatus(), chill: 3 },
      },
    },
    { type: 'attack', value: 6, physical: true },
  )
  const after = endTurn(s)
  // enemy NOT frozen → attack fires → player HP reduced
  expect(after.player.hp).toBe(44)
})

test('frostbolt (player): applies immediate chill damage AND stacks to enemy', () => {
  const base = cleanState('goblin', [cardById('frostbolt')])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // chill: immediate damage = chillApplied; stack added
  expect(after.enemy.hp).toBe(78)            // 80 - 2 immediate chill damage
  expect(after.enemy.status.chill).toBe(2)   // stacks applied
})

// ─────────────────────────────────────────────────────────────────────────────
// Trap mechanic
// ─────────────────────────────────────────────────────────────────────────────

test('player trap: triggers when enemy attacks, damages enemy, then clears', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, player: { ...base.player, status: { ...emptyStatus(), trap: 10 } } },
    { type: 'attack', value: 5, physical: true },
  )
  const after = endTurn(s)
  // enemy attacks for 5 → player.hp 45; trap triggers → enemy.hp 80-10=70; trap=0
  expect(after.player.hp).toBe(45)
  expect(after.enemy.hp).toBe(70)
  expect(after.player.status.trap).toBe(0)
})

test('player trap: does NOT trigger on non-attack intents', () => {
  const base = cleanState('goblin')
  const s = forceIntent(
    { ...base, player: { ...base.player, status: { ...emptyStatus(), trap: 10 } } },
    { type: 'defend', value: 0 },
  )
  const after = endTurn(s)
  // enemy defends → no attack → trap stays intact → enemy HP unchanged
  expect(after.enemy.hp).toBe(80)
  expect(after.player.status.trap).toBe(10) // trap persists (was never triggered)
})

// ─────────────────────────────────────────────────────────────────────────────
// Block absorption on enemy (player attacking shielded enemy)
// ─────────────────────────────────────────────────────────────────────────────

test('enemy block: absorbs incoming player attack damage', () => {
  const base = cleanState('goblin', [cardById('bash')])
  const s = { ...base, enemy: { ...base.enemy, block: 5 } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // bash: calcDamage(8, emptyStatus, emptyStatus)=8; block absorbs 5; enemy.hp -= 3
  expect(after.enemy.hp).toBe(77)
  expect(after.enemy.block).toBe(0)
})

test('enemy block: full absorption when attack cannot pierce block', () => {
  const base = cleanState('goblin', [cardById('stab')])
  const s = { ...base, enemy: { ...base.enemy, block: 10 } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // stab: calcDamage(4)=4; block 10 fully absorbs 4; enemy.hp unchanged
  expect(after.enemy.hp).toBe(80)
  expect(after.enemy.block).toBe(6) // 10 - 4
})

// ─────────────────────────────────────────────────────────────────────────────
// Bestiary coverage: every enemy in the registry can be spawned
// ─────────────────────────────────────────────────────────────────────────────

for (const entry of BESTIARY_ENEMIES) {
  test(`bestiary spawn: ${entry.id} creates a valid game state`, () => {
    const s = createGame(50, [], 'elite', 0, 'knight', entry.id, [], [cardById('defend')], 0)
    expect(s.enemy.id).toBe(entry.id)
    expect(s.enemy.hp).toBeGreaterThan(0)
    expect(s.enemy.maxHp).toBeGreaterThan(0)
    expect(s.enemy.pattern.length).toBeGreaterThan(0)
    expect(s.phase).toBe('player_turn')
  })
}

test('bestiary weaknesses: all enemies with listed weaknesses match BESTIARY_ENEMIES', () => {
  // Hard-coded expectations from the template definitions
  const burnWeakIds = ['frost_imp', 'masked_orc', 'orc_shaman', 'orc_warrior', 'blood_shaman', 'ogre']
  const bluntWeakIds = ['skelet']

  for (const id of burnWeakIds) {
    const entry = BESTIARY_ENEMIES.find(e => e.id === id)
    expect(entry, `${id} should be in BESTIARY_ENEMIES`).toBeDefined()
    expect(entry!.weaknesses, `${id} should have burn weakness`).toContain('burn')
  }
  for (const id of bluntWeakIds) {
    const entry = BESTIARY_ENEMIES.find(e => e.id === id)
    expect(entry, `${id} should be in BESTIARY_ENEMIES`).toBeDefined()
    expect(entry!.weaknesses, `${id} should have blunt weakness`).toContain('blunt')
  }
})
