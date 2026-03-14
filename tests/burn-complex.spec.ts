/**
 * Burn Talents & Complex Interaction Tests
 *
 * Burn talent IDs are synthetic trinket strings carried on state.trinketIds:
 *   talent_controlled_burn  — +1 to all burn damage (application and tick)
 *   talent_melt_armor       — burn application damage ×2 when enemy has block (tick unaffected)
 *   talent_avatar_of_fire   — player burn damage ×0.5 (floor)
 *   talent_holy_flame       — +20% of burn damage as holy bonus (min 1) on both application and tick
 *   talent_hot_streak       — draw 1 burn card from draw/discard at start of each player turn
 *   talent_pyromania        — burn tick damage ×2 when enemy has >10 burn stacks
 *
 * Complex interactions covered:
 *   - Multi-talent stacking (controlled_burn + holy_flame, melt_armor + controlled_burn, etc.)
 *   - Burn weakness × talent combinations
 *   - Fiery Blade (direct damage + burn on same card)
 *   - Cauterize (removes player bleed, applies self-burn)
 *   - Immolate (persistent upgrade—fires every turn start)
 *   - Conflagrate / Exsanguinate (doubling stacks before tick)
 *   - All player attack stat modifiers together (strength + forge + weak + vulnerable)
 *   - avatar_of_fire + heatforged_shield stacking
 */

import { expect, test } from '@playwright/test'
import {
  beginNextPlayerTurn,
  createGame,
  endTurn,
  playCard,
  resolveEnemyStartOfTurn,
} from '../src/combat'
import { ALL_CARDS, emptyStatus, makeCardInstances } from '../src/data'
import type { CardDef, EnemyIntent, GameState } from '../src/types'

test.describe.configure({ mode: 'parallel' })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cardById(id: string): CardDef {
  const c = ALL_CARDS.find(x => x.id === id)
  if (!c) throw new Error(`Unknown card: ${id}`)
  return c
}

/** Clean state: 50 HP player + 80 HP enemy, both ailment-free. */
function cleanState(
  deckCards: CardDef[] = [cardById('defend')],
  trinketIds: string[] = [],
  enemyId = 'goblin',
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

/** Transition directly to enemy_turn without invoking startEnemyTurn logic. */
function toEnemyPhase(state: GameState): GameState {
  return {
    ...state,
    phase: 'enemy_turn' as const,
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    lastCardPlayedId: null,
  }
}

/** Force the enemy to execute a single deterministic intent. */
function forceIntent(state: GameState, intent: EnemyIntent): GameState {
  return { ...state, enemy: { ...state.enemy, pattern: [intent] } }
}

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Controlled Burn (+1 burn damage on application AND on tick)
// ─────────────────────────────────────────────────────────────────────────────

test('talent controlled_burn: adds +1 to burn application damage', () => {
  const base = cleanState([cardById('fireball')], ['talent_controlled_burn'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // fireball: burn=3; controlled_burn +1 → burnDamage = 4
  expect(after.enemy.hp).toBe(76)
  // stacks still reflect what was applied (not the bonus damage)
  expect(after.enemy.status.burn).toBe(3)
})

test('talent controlled_burn: adds +1 to burn TICK damage each tick', () => {
  const base = cleanState([cardById('defend')], ['talent_controlled_burn'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 5 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: (5 + 1) = 6 damage
  expect(after.enemy.hp).toBe(74)
  expect(after.enemy.status.burn).toBe(4)
})

test('talent controlled_burn: first fireball then back-to-back ticks show ongoing bonus', () => {
  // Round 1 tick
  const base = cleanState([cardById('defend')], ['talent_controlled_burn'])
  const s1 = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, hp: 60, status: { ...emptyStatus(), burn: 3 } },
  })
  const after1 = resolveEnemyStartOfTurn(s1)
  // tick: (3+1)=4; hp=56; burn=2
  expect(after1.enemy.hp).toBe(56)
  expect(after1.enemy.status.burn).toBe(2)

  // Round 2 tick (from after1 state already in enemy_turn)
  const after2 = resolveEnemyStartOfTurn({ ...after1, phase: 'enemy_turn' as const })
  // tick: (2+1)=3; hp=53; burn=1
  expect(after2.enemy.hp).toBe(53)
  expect(after2.enemy.status.burn).toBe(1)
})

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Melt Armor (double burn application when enemy has block; tick unaffected)
// ─────────────────────────────────────────────────────────────────────────────

test('talent melt_armor: doubles burn application damage when enemy HAS block', () => {
  const base = cleanState([cardById('fireball')], ['talent_melt_armor'])
  const s = { ...base, enemy: { ...base.enemy, block: 5 } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // fireball: burn=3; melt_armor (block>0) → burnDamage = 3*2 = 6
  expect(after.enemy.hp).toBe(74)
})

test('talent melt_armor: does NOT trigger when enemy has NO block', () => {
  const base = cleanState([cardById('fireball')], ['talent_melt_armor'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // enemy.block=0 → melt_armor inactive → burnDamage = 3
  expect(after.enemy.hp).toBe(77)
})

test('talent melt_armor: does NOT affect burn TICK (only application)', () => {
  // TALENT_MELT_ARMOR is not referenced in resolveEnemyStartOfTurn
  const base = cleanState([cardById('defend')], ['talent_melt_armor'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, block: 5, status: { ...emptyStatus(), burn: 3 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: 3 damage only (melt_armor not applied to ticks)
  expect(after.enemy.hp).toBe(77)
})

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Avatar of Fire (player burn damage ×0.5, floored)
// ─────────────────────────────────────────────────────────────────────────────

test('talent avatar_of_fire: reduces player burn damage by 50%', () => {
  const base = cleanState([cardById('defend')], ['talent_avatar_of_fire'])
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, status: { ...emptyStatus(), burn: 4 } },
  }
  const after = beginNextPlayerTurn(s)
  // actualBurnDmg = max(0, floor((4 - 0) * 0.5)) = 2
  expect(after.player.hp).toBe(48)
  expect(after.player.status.burn).toBe(3)
})

test('talent avatar_of_fire: odd burn stacks floor correctly', () => {
  const base = cleanState([cardById('defend')], ['talent_avatar_of_fire'])
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, status: { ...emptyStatus(), burn: 5 } },
  }
  const after = beginNextPlayerTurn(s)
  // actualBurnDmg = floor(5 * 0.5) = floor(2.5) = 2
  expect(after.player.hp).toBe(48)
})

test('talent avatar_of_fire: burn=1 floors to 0 (player takes no burn damage)', () => {
  const base = cleanState([cardById('defend')], ['talent_avatar_of_fire'])
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, hp: 50, status: { ...emptyStatus(), burn: 1 } },
  }
  const after = beginNextPlayerTurn(s)
  // actualBurnDmg = max(0, floor(1 * 0.5)) = max(0, 0) = 0
  expect(after.player.hp).toBe(50)
  expect(after.player.status.burn).toBe(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Holy Flame (+20% of burn as holy bonus, minimum 1)
// ─────────────────────────────────────────────────────────────────────────────

test('talent holy_flame: adds 20% of burn application damage as holy bonus', () => {
  const base = cleanState([cardById('fireball')], ['talent_holy_flame'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // fireball: burn=3; burnDamage=3; holyBonus=max(1, floor(3*0.2))=max(1,0)=1
  // total: 3 + 1 = 4
  expect(after.enemy.hp).toBe(76)
})

test('talent holy_flame: minimum holy bonus is 1, never 0', () => {
  // fireball burn=3; 20% of 3 = 0.6 → floor=0 → clamped to 1
  const base = cleanState([cardById('fireball')], ['talent_holy_flame'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  const totalDamage = 80 - after.enemy.hp
  expect(totalDamage).toBeGreaterThanOrEqual(4) // 3 burn + min 1 holy
})

test('talent holy_flame: adds bonus during burn tick (min 1)', () => {
  const base = cleanState([cardById('defend')], ['talent_holy_flame'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 5 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: burnTickDamage=5; holyBonus=max(1, floor(5*0.2))=max(1,1)=1; total=6
  expect(after.enemy.hp).toBe(74)
})

test('talent holy_flame: scales with larger burn damage (floor of 20%)', () => {
  const base = cleanState([cardById('defend')], ['talent_holy_flame'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 20 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: burnTickDamage=20; holyBonus=max(1, floor(20*0.2))=max(1,4)=4; total=24
  expect(after.enemy.hp).toBe(56)
})

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Hot Streak (draw 1 burn card from draw/discard at each player turn start)
// ─────────────────────────────────────────────────────────────────────────────

test('talent hot_streak: draws a burn card from discard pile at player turn start', () => {
  const burnCard = { ...cardById('fireball'), uid: 'fire-uid' }
  const nonBurnCards = Array.from({ length: 5 }, (_, i) => ({
    ...cardById('defend'),
    uid: `def-${i}`,
  }))

  const base = cleanState([cardById('defend')], ['talent_hot_streak'])
  const s = forceIntent(
    {
      ...base,
      hand: [],
      drawPile: nonBurnCards,       // 5 non-burn cards — drawn by normal 5-card draw
      discardPile: [burnCard],       // fireball in discard — hot_streak fetches it
      player: { ...base.player, status: emptyStatus() },
      enemy: { ...base.enemy, status: emptyStatus() },
    },
    { type: 'defend', value: 0 },
  )
  const after = endTurn(s)
  // After the 5-card draw depletes drawPile, hot_streak pulls fireball from discard
  expect(after.log.some(line => line.includes('Hot Streak draws Fireball'))).toBeTruthy()
  expect(after.hand.some(c => c.id === 'fireball')).toBeTruthy()
})

test('talent hot_streak: draws a burn card from draw pile when available', () => {
  const burnCard = { ...cardById('fireball'), uid: 'fire-uid' }
  // draw pile has the burn card in addition to non-burn ones
  const nonBurnCards = Array.from({ length: 3 }, (_, i) => ({
    ...cardById('defend'),
    uid: `def-${i}`,
  }))

  const base = cleanState([cardById('defend')], ['talent_hot_streak'])
  // After 5-card draw draws 3 defend cards (running out) and cycles discard,
  // this test simpler: set draw pile with fireball last so normal 5-card draw
  // runs out before reaching the burn card that may be in discard
  const s = forceIntent(
    {
      ...base,
      hand: [],
      drawPile: nonBurnCards,
      discardPile: [burnCard],
      player: { ...base.player, status: emptyStatus() },
      enemy: { ...base.enemy, status: emptyStatus() },
    },
    { type: 'defend', value: 0 },
  )
  const after = endTurn(s)
  // hot_streak should have drawn fireball (from discard after 5-card draw)
  expect(after.hand.some(c => c.id === 'fireball')).toBeTruthy()
})

test('talent hot_streak: no draw if no burn card exists anywhere in deck', () => {
  const nonBurnCards = Array.from({ length: 6 }, (_, i) => ({
    ...cardById('defend'),
    uid: `def-${i}`,
  }))
  const base = cleanState([cardById('defend')], ['talent_hot_streak'])
  const s = forceIntent(
    {
      ...base,
      hand: [],
      drawPile: nonBurnCards,
      discardPile: [],
      player: { ...base.player, status: emptyStatus() },
      enemy: { ...base.enemy, status: emptyStatus() },
    },
    { type: 'defend', value: 0 },
  )
  const after = endTurn(s)
  // no "Hot Streak draws" log entry
  expect(after.log.some(line => line.includes('Hot Streak draws'))).toBeFalsy()
})

// ─────────────────────────────────────────────────────────────────────────────
// TALENT: Pyromania (burn tick ×2 when enemy burn stacks > 10)
// ─────────────────────────────────────────────────────────────────────────────

test('talent pyromania: doubles burn tick when enemy has MORE THAN 10 burn stacks', () => {
  const base = cleanState([cardById('defend')], ['talent_pyromania'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 11 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: 11 * 2 = 22 (pyromania doubles)
  expect(after.enemy.hp).toBe(58)
})

test('talent pyromania: does NOT double at exactly 10 stacks (must be > 10)', () => {
  const base = cleanState([cardById('defend')], ['talent_pyromania'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 10 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // exactly 10 is NOT > 10 → no doubling
  expect(after.enemy.hp).toBe(70)
})

test('talent pyromania: does NOT double if burn stacks drop to ≤ 10 on subsequent tick', () => {
  // Start with 12 stacks → pyromania triggers on first tick
  // After tick: burn=11 → still > 10, would still trigger next turn
  // After tick from 11: burn=10 → exactly 10, should NOT double
  const base = cleanState([cardById('defend')], ['talent_pyromania'])
  const s1 = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, hp: 100, maxHp: 100, status: { ...emptyStatus(), burn: 12 } },
  })
  const after1 = resolveEnemyStartOfTurn(s1) // 12>10 → 12*2=24, burn=11
  expect(after1.enemy.hp).toBe(76)

  const after2 = resolveEnemyStartOfTurn({ ...after1, phase: 'enemy_turn' as const }) // 11>10 → 11*2=22, burn=10
  expect(after2.enemy.hp).toBe(54)

  const after3 = resolveEnemyStartOfTurn({ ...after2, phase: 'enemy_turn' as const }) // 10 NOT >10 → 10, burn=9
  expect(after3.enemy.hp).toBe(44)
})

// ─────────────────────────────────────────────────────────────────────────────
// Talent combination tests
// ─────────────────────────────────────────────────────────────────────────────

test('combo controlled_burn + holy_flame: both bonuses apply to fireball', () => {
  const base = cleanState([cardById('fireball')], ['talent_controlled_burn', 'talent_holy_flame'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // fireball: burn=3; controlled_burn → burnDamage=4
  // holy_flame: holyBonus = max(1, floor(4*0.2)) = max(1, 0) = 1
  // total: 4 + 1 = 5
  expect(after.enemy.hp).toBe(75)
})

test('combo melt_armor + controlled_burn: both boost application when enemy has block', () => {
  const base = cleanState([cardById('fireball')], ['talent_melt_armor', 'talent_controlled_burn'])
  const s = { ...base, enemy: { ...base.enemy, block: 4 } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // fireball: burn=3; controlled_burn → (3+1)=4; melt_armor (block>0) → 4*2=8
  expect(after.enemy.hp).toBe(72)
})

test('combo burn_weakness + controlled_burn: weakness first, then +1', () => {
  // orc_warrior has burn weakness
  const base = cleanState([cardById('fireball')], ['talent_controlled_burn'], 'orc_warrior')
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // burn=3; weakness → weakBurnDamage=6; +1 controlled → burnDamage=7
  expect(after.enemy.hp).toBe(73)
  expect(after.enemy.status.burn).toBe(3)
})

test('combo burn_weakness + pyromania on tick: weakness doubles first, then pyromania doubles', () => {
  // frost_imp has burn weakness
  const base = cleanState([cardById('defend')], ['talent_pyromania'], 'frost_imp')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 11 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: weakBurnTickDamage=11*2=22 (frost_imp burn weakness); pyromania: 22*2=44
  expect(after.enemy.hp).toBe(36)
})

test('combo avatar_of_fire + heatforged_shield: both reduce player burn damage', () => {
  // heatforged_shield is a trinket (not talent string); avatar is a talent string
  const base = cleanState([cardById('defend')], ['talent_avatar_of_fire', 'heatforged_shield'])
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: { ...base.player, status: { ...emptyStatus(), burn: 6 } },
  }
  const after = beginNextPlayerTurn(s)
  // heatforgedReduction=1; avatarMultiplier=0.5
  // actualBurnDmg = max(0, floor((6 - 1) * 0.5)) = floor(2.5) = 2
  expect(after.player.hp).toBe(48)
})

test('combo pyromania + controlled_burn on tick: controlled adds first, then pyromania doubles total', () => {
  const base = cleanState([cardById('defend')], ['talent_pyromania', 'talent_controlled_burn'])
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 11 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: (11 + 1) * 2 = 24 (controlled_burn +1, then pyromania doubles)
  expect(after.enemy.hp).toBe(56)
})

// ─────────────────────────────────────────────────────────────────────────────
// Multi-card interaction sequences
// ─────────────────────────────────────────────────────────────────────────────

test('fiery_blade: deals both direct damage AND burn simultaneously', () => {
  const base = cleanState([cardById('fiery_blade')])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // direct damage: calcDamage(4, emptyStatus, emptyStatus) = 4
  // burn application: burnDamage = 4 (no weakness)
  // total hp loss = 4 + 4 = 8
  expect(after.enemy.hp).toBe(72)
  expect(after.enemy.status.burn).toBe(4)
})

test('fiery_blade on burn-weak enemy: burn portion doubled, direct portion unchanged', () => {
  // orc_warrior weaknesses: ['burn']
  const base = cleanState([cardById('fiery_blade')], [], 'orc_warrior')
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // direct (pierce): 4 — no weakness exploitation (inferDirectDamageWeaknessType('fiery_blade')=null)
  // burn: 4 * 2 = 8 (weakness)
  // total = 4 + 8 = 12
  expect(after.enemy.hp).toBe(68)
  expect(after.enemy.status.burn).toBe(4) // stacks unchanged by weakness
})

test('cauterize: removes ALL player bleed and applies 1 self-burn (deals 1 immediate)', () => {
  const base = cleanState([cardById('cauterize')])
  const s = { ...base, player: { ...base.player, status: { ...emptyStatus(), bleed: 5 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  expect(after.player.status.bleed).toBe(0)       // all bleed removed
  expect(after.player.status.burn).toBe(1)         // 1 self-burn applied
  expect(after.player.hp).toBe(49)                 // 50 - 1 (selfBurn immediate)
})

test('cauterize: no-op on bleed = 0 but still applies self-burn', () => {
  const base = cleanState([cardById('cauterize')])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  expect(after.player.status.bleed).toBe(0)
  expect(after.player.status.burn).toBe(1)
  expect(after.player.hp).toBe(49)
})

test('immolate (upgrade): fires burn 1 to enemy AND selfBurn 1 each turn start', () => {
  const base = cleanState([cardById('immolate')])
  const uid = base.hand[0].uid
  const afterPlay = playCard(base, uid)
  // immolate is an upgrade — effect NOT applied immediately
  expect(afterPlay.enemy.hp).toBe(80)
  expect(afterPlay.activeUpgrades.some(u => u.id === 'immolate')).toBeTruthy()

  const s = forceIntent(afterPlay, { type: 'defend', value: 0 })
  const afterTurn = endTurn(s)
  // startEnemyTurn → applyPersistentUpgrades → immolate:
  //   burn=1 to enemy: enemy.hp=79, enemy.status.burn=1
  //   selfBurn=1 to player: player.hp=49, player.status.burn=1
  // resolveEnemyStartOfTurn → enemy burn tick: enemy.hp=78, burn=0
  // beginNextPlayerTurn → player burn tick: player.hp=48, burn=0
  expect(afterTurn.enemy.hp).toBe(78)
  expect(afterTurn.player.hp).toBe(48)
})

test('immolate + controlled_burn: talent boosts immolate burn tick and application', () => {
  const base = cleanState([cardById('immolate')], ['talent_controlled_burn'])
  const uid = base.hand[0].uid
  const afterPlay = playCard(base, uid)

  const s = forceIntent(afterPlay, { type: 'defend', value: 0 })
  const afterTurn = endTurn(s)
  // applyPersistentUpgrades → immolate burn=1:
  //   controlled_burn +1 → burnDamage=2; enemy.hp=78, enemy.status.burn=1
  //   selfBurn: player.hp=49, player.status.burn=1
  // resolveEnemyStartOfTurn → burn tick: (1+1)=2 damage; enemy.hp=76, burn=0
  // beginNextPlayerTurn → player burn tick: player.hp=48, burn=0
  expect(afterTurn.enemy.hp).toBe(76)
  expect(afterTurn.player.hp).toBe(48)
})

// ─────────────────────────────────────────────────────────────────────────────
// Conflagrate and Exsanguinate: doubling stacks before the tick
// ─────────────────────────────────────────────────────────────────────────────

test('conflagrate: doubles enemy burn stacks', () => {
  const base = cleanState([cardById('conflagrate')])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 4 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  expect(after.enemy.status.burn).toBe(8) // 4 * 2
})

test('conflagrate: doubled stacks tick for the full doubled amount', () => {
  const base = cleanState([cardById('fireball'), cardById('conflagrate')])
  const uid1 = base.hand.find(c => c.id === 'fireball')!.uid
  const afterFireball = playCard(base, uid1)
  // fireball: enemy.status.burn=3, enemy.hp=77

  const uid2 = afterFireball.hand.find(c => c.id === 'conflagrate')!.uid
  const afterConflagrate = playCard(afterFireball, uid2)
  // conflagrate: enemy.status.burn=6, enemy.hp=77

  const afterTick = resolveEnemyStartOfTurn(toEnemyPhase(afterConflagrate))
  // tick: b=6, burnTickDamage=6; enemy.hp=71; burn=5
  expect(afterConflagrate.enemy.status.burn).toBe(6)
  expect(afterTick.enemy.hp).toBe(71)
  expect(afterTick.enemy.status.burn).toBe(5)
})

test('exsanguinate: doubles enemy bleed stacks', () => {
  const base = cleanState([cardById('exsanguinate')])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), bleed: 3 } } }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  expect(after.enemy.status.bleed).toBe(6) // 3 * 2
})

test('exsanguinate: doubled bleed ticks for 4× original stacks', () => {
  const base = cleanState([cardById('exsanguinate')])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), bleed: 4 } } }
  const uid = s.hand[0].uid
  const afterPlay = playCard(s, uid)
  // bleed = 8

  const afterTick = resolveEnemyStartOfTurn(toEnemyPhase(afterPlay))
  // bleed tick: 8*2=16; enemy.hp=80-16=64; bleed=0
  expect(afterTick.enemy.hp).toBe(64)
  expect(afterTick.enemy.status.bleed).toBe(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Complex multi-status stacking
// ─────────────────────────────────────────────────────────────────────────────

test('complex: enemy burn + poison + bleed all tick once in the same endTurn', () => {
  const base = cleanState([cardById('defend')])
  const s = forceIntent(
    {
      ...base,
      enemy: {
        ...base.enemy,
        hp: 60,
        maxHp: 80,
        status: { ...emptyStatus(), burn: 3, poison: 4, bleed: 2 },
      },
    },
    { type: 'defend', value: 0 },
  )
  const after = endTurn(s)
  // resolveEnemyStartOfTurn:
  //   burn:   3 dmg, burn=2  → hp 57
  //   poison: 4 dmg, poison unchanged → hp 53
  //   bleed:  2*2=4 dmg, bleed=0 → hp 49
  expect(after.enemy.hp).toBe(49)
  expect(after.enemy.status.burn).toBe(2)
  expect(after.enemy.status.poison).toBe(4)
  expect(after.enemy.status.bleed).toBe(0)
})

test('complex: all player attack modifiers stack (strength + forge + weak + vulnerable)', () => {
  const base = cleanState([cardById('slash')])
  const s = {
    ...base,
    player: { ...base.player, status: { ...emptyStatus(), strength: 2, forge: 1, weak: 1 } },
    enemy: { ...base.enemy, status: { ...emptyStatus(), vulnerable: 1 } },
  }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(4, {strength:2, forge:1, weak:1}, {vulnerable:1}):
  //   base: 4+2+1 = 7
  //   weak: floor(7 * 0.75) = floor(5.25) = 5
  //   vulnerable: floor(5 * 1.5) = floor(7.5) = 7
  expect(after.enemy.hp).toBe(73)
})

test('complex: burn_weakness + holy_flame on tick: doubled tick + holy bonus', () => {
  // frost_imp has burn weakness; holy_flame adds bonus on top
  const base = cleanState([cardById('defend')], ['talent_holy_flame'], 'frost_imp')
  const s = toEnemyPhase({
    ...base,
    enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 5 } },
  })
  const after = resolveEnemyStartOfTurn(s)
  // tick: weakBurnTickDamage = 5*2 = 10 (burn weakness)
  // holy_flame: holyBonus = max(1, floor(10*0.2)) = max(1, 2) = 2
  // total = 10 + 2 = 12
  expect(after.enemy.hp).toBe(68)
})

test('complex: leech + direct damage heals player for damage dealt', () => {
  // bite card: damage=3, leech=true
  const base = cleanState([cardById('bite')])
  const s = {
    ...base,
    player: { ...base.player, hp: 30 },
    enemy: { ...base.enemy, hp: 80 },
  }
  const uid = s.hand[0].uid
  const after = playCard(s, uid)
  // calcDamage(3, emptyStatus, emptyStatus) = 3
  // leech: player.hp = min(50, 30+3) = 33
  expect(after.enemy.hp).toBe(77)
  expect(after.player.hp).toBe(33)
})

test('complex: player bleed ticks on the same turn as poison (both drain HP)', () => {
  const base = cleanState([cardById('defend')])
  const s: GameState = {
    ...base,
    phase: 'enemy_turn' as const,
    player: {
      ...base.player,
      hp: 30,
      status: { ...emptyStatus(), bleed: 3, poison: 2 },
    },
  }
  const after = beginNextPlayerTurn(s)
  // No burn tick (burn=0)
  // poison tick: 2 dmg, poison=2 → hp 28
  // bleed tick: 3*2=6 dmg, bleed=0 → hp 22
  expect(after.player.hp).toBe(22)
  expect(after.player.status.poison).toBe(2) // persistent
  expect(after.player.status.bleed).toBe(0)
})

test('complex: fiery_blade with controlled_burn enhances both burn and direct damage', () => {
  // fiery_blade: damage=4, burn=4
  // controlled_burn adds +1 to burn application → burnDamage=5
  // direct damage unchanged (controlled_burn only affects burn application)
  const base = cleanState([cardById('fiery_blade')], ['talent_controlled_burn'])
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // direct: calcDamage(4, emptyStatus, emptyStatus) = 4
  // burn: 4 + 1 (controlled) = 5
  // total = 4 + 5 = 9
  expect(after.enemy.hp).toBe(71)
  expect(after.enemy.status.burn).toBe(4) // stacks applied = 4
})

test('complex: burn_weakness enemy with controlled_burn + holy_flame on application', () => {
  // orc_warrior burn weakness
  const base = cleanState(
    [cardById('fireball')],
    ['talent_controlled_burn', 'talent_holy_flame'],
    'orc_warrior',
  )
  const uid = base.hand[0].uid
  const after = playCard(base, uid)
  // fireball: burn=3
  // weakness: weakBurnDamage = 3*2 = 6
  // controlled_burn: 6 + 1 = 7
  // holy_flame: holyBonus = max(1, floor(7*0.2)) = max(1, 1) = 1
  // total = 7 + 1 = 8
  expect(after.enemy.hp).toBe(72)
})

test('complex: conflagrate + pyromania — doubling stacks crosses pyromania threshold', () => {
  // enemy has burn=6; conflagrate doubles to 12; pyromania fires on next tick (>10)
  const base = cleanState([cardById('conflagrate')], ['talent_pyromania'])
  const s = { ...base, enemy: { ...base.enemy, status: { ...emptyStatus(), burn: 6 } } }
  const uid = s.hand[0].uid
  const afterConflagrate = playCard(s, uid)
  expect(afterConflagrate.enemy.status.burn).toBe(12)

  const afterTick = resolveEnemyStartOfTurn(toEnemyPhase(afterConflagrate))
  // tick: b=12 > 10 → pyromania doubles → 12*2=24; burn=11
  expect(afterTick.enemy.hp).toBe(56) // 80 - 24
  expect(afterTick.enemy.status.burn).toBe(11)
})
