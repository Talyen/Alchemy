import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { beginNextPlayerTurn, createGame, endTurn, playCard } from '../src/combat'
import { ALL_CARDS } from '../src/data'
import type { CardDef, EnemyIntent, GameState } from '../src/types'

test.describe.configure({ mode: 'parallel' })

function cardById(cardId: string): CardDef {
  const card = ALL_CARDS.find(entry => entry.id === cardId)
  if (!card) throw new Error(`Unknown card id: ${cardId}`)
  return card
}

function firstHandUid(state: GameState): string {
  const first = state.hand[0]
  if (!first) throw new Error('Expected at least one card in hand.')
  return first.uid
}

function createSingleCardState(card: CardDef, trinketIds: string[] = []): GameState {
  const base = createGame(90, [], 'elite', 0, 'knight', 'ogre', trinketIds, [card], 0)
  return {
    ...base,
    mana: 10,
    maxMana: 10,
    player: {
      ...base.player,
      hp: Math.max(20, base.player.maxHp - 15),
      status: {
        ...base.player.status,
        burn: 2,
        poison: 2,
        bleed: 2,
      },
    },
    enemy: {
      ...base.enemy,
      hp: Math.max(base.enemy.hp, 90),
      maxHp: Math.max(base.enemy.maxHp, 90),
      block: 0,
      status: {
        ...base.enemy.status,
        burn: 2,
        bleed: 2,
      },
    },
  }
}

function countAilments(state: GameState): number {
  const { burn, poison, bleed, vulnerable, weak } = state.player.status
  return burn + poison + bleed + vulnerable + weak
}

for (const card of ALL_CARDS) {
  test(`card sim: ${card.id} applies declared basic mechanics`, () => {
    const before = createSingleCardState(card)
    const uid = firstHandUid(before)

    const after = playCard(before, uid)
    expect(after.lastCardPlayedId).toBe(card.id)

    if (card.type === 'upgrade') {
      expect(after.activeUpgrades.some(upgrade => upgrade.id === card.id)).toBeTruthy()
      return
    }

    let checks = 0
    const { effect } = card

    if (effect.damage !== undefined && effect.damage > 0) {
      checks += 1
      expect(after.enemy.hp).toBeLessThan(before.enemy.hp)
    }

    if (effect.block !== undefined && effect.block > 0) {
      checks += 1
      expect(after.player.block).toBeGreaterThanOrEqual(before.player.block + effect.block)
    }

    if (effect.mana !== undefined && effect.mana > 0) {
      checks += 1
      expect(after.mana).toBe(before.mana - card.cost + effect.mana)
    }

    if (effect.vulnerable !== undefined && effect.vulnerable > 0) {
      checks += 1
      expect(after.enemy.status.vulnerable).toBeGreaterThanOrEqual(before.enemy.status.vulnerable + effect.vulnerable)
    }

    if (effect.weak !== undefined && effect.weak > 0) {
      checks += 1
      expect(after.enemy.status.weak).toBeGreaterThanOrEqual(before.enemy.status.weak + effect.weak)
    }

    if (effect.armor !== undefined && effect.armor > 0) {
      checks += 1
      expect(after.player.armor).toBeGreaterThanOrEqual(before.player.armor + effect.armor)
    }

    if (effect.heal !== undefined && effect.heal > 0) {
      checks += 1
      expect(after.player.hp).toBeGreaterThan(before.player.hp)
    }

    if (effect.forge !== undefined && effect.forge > 0) {
      checks += 1
      expect(after.player.status.forge).toBeGreaterThanOrEqual(before.player.status.forge + effect.forge)
    }

    if (effect.burn !== undefined && effect.burn > 0) {
      checks += 1
      expect(after.enemy.status.burn).toBeGreaterThanOrEqual(before.enemy.status.burn + effect.burn)
    }

    if (effect.poison !== undefined && effect.poison > 0) {
      checks += 1
      expect(after.enemy.status.poison).toBeGreaterThanOrEqual(before.enemy.status.poison + effect.poison)
    }

    if (effect.bleed !== undefined && effect.bleed > 0) {
      checks += 1
      expect(after.enemy.status.bleed).toBeGreaterThanOrEqual(before.enemy.status.bleed + effect.bleed)
    }

    if (effect.chill !== undefined && effect.chill > 0) {
      checks += 1
      expect(after.enemy.status.chill).toBeGreaterThanOrEqual(before.enemy.status.chill + effect.chill)
    }

    if (effect.selfBurn !== undefined && effect.selfBurn > 0) {
      checks += 1
      expect(after.player.status.burn).toBeGreaterThanOrEqual(before.player.status.burn + effect.selfBurn)
      expect(after.player.hp).toBeLessThan(before.player.hp)
    }

    if (effect.removeSelfBleed) {
      checks += 1
      expect(after.player.status.bleed).toBe(0)
    }

    if (effect.doubleEnemyBleed) {
      checks += 1
      expect(after.enemy.status.bleed).toBe(before.enemy.status.bleed * 2)
    }

    if (effect.doubleEnemyBurn) {
      checks += 1
      expect(after.enemy.status.burn).toBe(before.enemy.status.burn * 2)
    }

    if (effect.gold !== undefined && effect.gold > 0) {
      checks += 1
      expect(after.gold).toBe(before.gold + effect.gold)
    }

    if (effect.manaCrystal !== undefined && effect.manaCrystal > 0) {
      checks += 1
      expect(after.maxMana).toBe(before.maxMana + effect.manaCrystal)
    }

    if (effect.haste !== undefined && effect.haste > 0) {
      checks += 1
      expect(after.extraTurns).toBe(before.extraTurns + effect.haste)
    }

    if (effect.cleanse !== undefined && effect.cleanse > 0) {
      checks += 1
      expect(countAilments(after)).toBeLessThan(countAilments(before))
    }

    if (effect.trap !== undefined && effect.trap > 0) {
      checks += 1
      expect(after.player.status.trap).toBeGreaterThanOrEqual(before.player.status.trap + effect.trap)
    }

    if (effect.wish !== undefined && effect.wish > 0) {
      checks += 1
      expect(after.wishOptions.length).toBe(3)
    }

    expect(checks, `No mechanic assertion executed for card '${card.id}'.`).toBeGreaterThan(0)
  })
}

function trinketCoverageIdsFromAppSource(): string[] {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const start = appSource.indexOf('const ALL_TRINKET_OFFERS: ShopTrinketOffer[] = [')
  const end = appSource.indexOf(']\n\nfunction getPreviewMode()', start)
  if (start < 0 || end < 0) {
    throw new Error('Failed to locate ALL_TRINKET_OFFERS in App.tsx')
  }
  const block = appSource.slice(start, end)
  return [...block.matchAll(/id:\s*'([^']+)'/g)].map(match => match[1])
}

const TRINKET_IDS_UNDER_TEST = [
  'special_delivery',
  'mail_delivery',
  'campfire',
  'equivalent_exchange',
  'green_thumb',
  'torch',
  'spell_tome',
  'holy_lantern',
  'scales_of_justice',
  'lucky_coin',
  'emerald',
  'ruby',
  'sapphire',
  'flash_fire',
  'hidden_blade',
  'shield_of_faith',
  'camp_kit',
  'mana_crystal_trinket',
  'wardstone_shard',
  'shieldbreaker',
  'heatforged_shield',
  'golden_flail',
  'golden_great_axe',
  'cloak_of_flames',
] as const

test('trinket sim coverage stays in sync with ALL_TRINKET_OFFERS', () => {
  const fromApp = trinketCoverageIdsFromAppSource().sort()
  const fromTests = [...TRINKET_IDS_UNDER_TEST].sort()
  expect(fromTests).toEqual(fromApp)
})

function runSpecialDeliveryRateProbe(extraTrinketId: string, predicate: (card: CardDef) => boolean, samples = 900): number {
  let hits = 0
  let observed = 0

  for (let i = 0; i < samples; i += 1) {
    let state = createGame(120, [], 'basic', 0, 'knight', 'goblin', ['special_delivery', extraTrinketId], [cardById('defend')], 0)
    state = endTurn({ ...state, mana: 10, maxMana: 10 })
    const logLine = [...state.log].reverse().find(line => line.includes('Special Delivery creates '))
    if (!logLine) continue

    const nameMatch = logLine.match(/Special Delivery creates (.+)\./)
    if (!nameMatch) continue

    const name = nameMatch[1]
    const created = ALL_CARDS.find(card => card.name === name)
    if (!created) continue

    observed += 1
    if (predicate(created)) hits += 1
  }

  return observed === 0 ? 0 : hits / observed
}

function withSingleCardTrinketState(cardId: string, trinketId: string): GameState {
  const card = cardById(cardId)
  const game = createSingleCardState(card, [trinketId])
  return {
    ...game,
    mana: 3,
    maxMana: 3,
    gold: 10,
  }
}

function forceSingleDebuffIntent(state: GameState, debuff: EnemyIntent['type'], value = 2): GameState {
  return {
    ...state,
    enemy: {
      ...state.enemy,
      pattern: [{ type: debuff, value }],
    },
  }
}

for (const trinketId of TRINKET_IDS_UNDER_TEST) {
  test(`trinket sim: ${trinketId} basic mechanic works`, () => {
    if (trinketId === 'mail_delivery') {
      const game = createGame(100, [], 'basic', 0, 'knight', 'goblin', ['mail_delivery'], [cardById('defend')], 0)
      expect(game.hand.length).toBe(1)
      return
    }

    if (trinketId === 'special_delivery') {
      const game = createGame(120, [], 'basic', 0, 'knight', 'goblin', ['special_delivery'], [cardById('defend')], 0)
      const next = endTurn(game)
      expect(next.log.some(line => line.includes('Special Delivery creates '))).toBeTruthy()
      return
    }

    if (trinketId === 'equivalent_exchange') {
      const game = createGame(120, [], 'basic', 0, 'knight', 'goblin', ['equivalent_exchange'], [cardById('defend')], 0)
      expect(game.hand[0]?.id).not.toBe('defend')
      return
    }

    if (trinketId === 'green_thumb') {
      const card = cardById('heal')
      const baseBefore = createSingleCardState(card)
      const boostedBefore = createSingleCardState(card, ['green_thumb'])
      const baseAfter = playCard(baseBefore, firstHandUid(baseBefore))
      const boostedAfter = playCard(boostedBefore, firstHandUid(boostedBefore))
      expect(boostedAfter.player.hp - boostedBefore.player.hp).toBe((baseAfter.player.hp - baseBefore.player.hp) + 1)
      return
    }

    if (trinketId === 'torch') {
      const game = createGame(100, [], 'basic', 0, 'knight', 'goblin', ['torch'], [cardById('defend')], 0)
      expect(game.enemy.status.burn).toBeGreaterThanOrEqual(5)
      return
    }

    if (trinketId === 'spell_tome') {
      const game = createGame(100, [], 'basic', 0, 'knight', 'goblin', ['spell_tome'], [cardById('defend')], 0)
      expect(game.log.some(line => line.includes('Spell Tome grants'))).toBeTruthy()
      expect(game.hand.length).toBeGreaterThanOrEqual(1)
      return
    }

    if (trinketId === 'holy_lantern') {
      const card = cardById('holy_blade')
      const baseBefore = {
        ...createSingleCardState(card),
        enemy: {
          ...createSingleCardState(card).enemy,
          status: { ...createSingleCardState(card).enemy.status, burn: 4 },
        },
      }
      const bonusBefore = {
        ...createSingleCardState(card, ['holy_lantern']),
        enemy: {
          ...createSingleCardState(card, ['holy_lantern']).enemy,
          status: { ...createSingleCardState(card, ['holy_lantern']).enemy.status, burn: 4 },
        },
      }
      const baseAfter = playCard(baseBefore, firstHandUid(baseBefore))
      const bonusAfter = playCard(bonusBefore, firstHandUid(bonusBefore))
      const baseDamage = baseBefore.enemy.hp - baseAfter.enemy.hp
      const bonusDamage = bonusBefore.enemy.hp - bonusAfter.enemy.hp
      expect(bonusDamage).toBeGreaterThan(baseDamage)
      return
    }

    if (trinketId === 'scales_of_justice') {
      const card = cardById('holy_blade')
      const before = {
        ...createSingleCardState(card, ['scales_of_justice']),
        player: { ...createSingleCardState(card, ['scales_of_justice']).player, hp: 30, maxHp: 90 },
      }
      const after = playCard(before, firstHandUid(before))
      expect(after.player.hp).toBe(before.player.hp + 1)
      return
    }

    if (trinketId === 'lucky_coin') {
      const baseline = runSpecialDeliveryRateProbe('campfire', card => /gold|holy/i.test(`${card.name} ${card.description}`))
      const boosted = runSpecialDeliveryRateProbe('lucky_coin', card => /gold|holy/i.test(`${card.name} ${card.description}`))
      expect(boosted).toBeGreaterThan(baseline + 0.008)
      return
    }

    if (trinketId === 'emerald') {
      const baseline = runSpecialDeliveryRateProbe('campfire', card => /poison|heal/i.test(`${card.name} ${card.description}`))
      const boosted = runSpecialDeliveryRateProbe('emerald', card => /poison|heal/i.test(`${card.name} ${card.description}`))
      expect(boosted).toBeGreaterThan(baseline + 0.008)
      return
    }

    if (trinketId === 'ruby') {
      const baseline = runSpecialDeliveryRateProbe('campfire', card => /burn|leech/i.test(`${card.name} ${card.description}`))
      const boosted = runSpecialDeliveryRateProbe('ruby', card => /burn|leech/i.test(`${card.name} ${card.description}`))
      expect(boosted).toBeGreaterThan(baseline + 0.008)
      return
    }

    if (trinketId === 'sapphire') {
      const baseline = runSpecialDeliveryRateProbe('campfire', card => /mana|block/i.test(`${card.name} ${card.description}`))
      const boosted = runSpecialDeliveryRateProbe('sapphire', card => /mana|block/i.test(`${card.name} ${card.description}`))
      expect(boosted).toBeGreaterThan(baseline + 0.008)
      return
    }

    if (trinketId === 'flash_fire') {
      const before = withSingleCardTrinketState('fireball', 'flash_fire')
      const cast = playCard({ ...before, mana: 0 }, firstHandUid(before))
      expect(cast.lastCardPlayedId).toBe('fireball')
      expect(cast.mana).toBe(0)
      return
    }

    if (trinketId === 'hidden_blade') {
      const before = withSingleCardTrinketState('stab', 'hidden_blade')
      const cast = playCard({ ...before, mana: 0 }, firstHandUid(before))
      expect(cast.lastCardPlayedId).toBe('stab')
      expect(cast.mana).toBe(0)
      return
    }

    if (trinketId === 'shield_of_faith') {
      const before = withSingleCardTrinketState('blessed_aegis', 'shield_of_faith')
      const after = playCard(before, firstHandUid(before))
      expect(after.player.block - before.player.block).toBeGreaterThanOrEqual((cardById('blessed_aegis').effect.block ?? 0) + 1)
      return
    }

    if (trinketId === 'mana_crystal_trinket') {
      const game = createGame(100, [], 'basic', 0, 'knight', 'goblin', ['mana_crystal_trinket'], [cardById('defend')], 0)
      expect(game.maxMana).toBe(4)
      expect(game.mana).toBe(4)
      return
    }

    if (trinketId === 'wardstone_shard') {
      const base = withSingleCardTrinketState('defend', 'wardstone_shard')
      const before = forceSingleDebuffIntent({
        ...base,
        player: {
          ...base.player,
          status: {
            ...base.player.status,
            burn: 0,
            poison: 0,
            bleed: 0,
            vulnerable: 0,
            weak: 0,
          },
        },
      }, 'burn', 3)
      const after = endTurn(before)
      expect(after.battleUsedTrinkets).toContain('wardstone_shard')
      expect(after.player.status.burn).toBe(0)
      return
    }

    if (trinketId === 'shieldbreaker') {
      const card = cardById('stab')
      const baseBefore = {
        ...createSingleCardState(card),
        enemy: { ...createSingleCardState(card).enemy, block: 6 },
      }
      const bonusBefore = {
        ...createSingleCardState(card, ['shieldbreaker']),
        enemy: { ...createSingleCardState(card, ['shieldbreaker']).enemy, block: 6 },
      }
      const baseAfter = playCard(baseBefore, firstHandUid(baseBefore))
      const bonusAfter = playCard(bonusBefore, firstHandUid(bonusBefore))
      const baseDamage = baseBefore.enemy.hp - baseAfter.enemy.hp
      const bonusDamage = bonusBefore.enemy.hp - bonusAfter.enemy.hp
      expect(bonusDamage).toBeGreaterThan(baseDamage)
      return
    }

    if (trinketId === 'heatforged_shield') {
      const base = withSingleCardTrinketState('defend', 'heatforged_shield')
      const before = {
        ...base,
        phase: 'enemy_turn' as const,
        player: {
          ...base.player,
          hp: 40,
          status: {
            ...base.player.status,
            burn: 3,
            poison: 0,
            bleed: 0,
            vulnerable: 0,
            weak: 0,
          },
        },
      }
      const after = beginNextPlayerTurn(before)
      expect(after.player.hp).toBe(38)
      return
    }

    if (trinketId === 'golden_flail') {
      const before = withSingleCardTrinketState('bash', 'golden_flail')
      const after = playCard(before, firstHandUid(before))
      expect(after.gold).toBe(before.gold + 1)
      return
    }

    if (trinketId === 'golden_great_axe') {
      const before = withSingleCardTrinketState('slash', 'golden_great_axe')
      const after = playCard(before, firstHandUid(before))
      expect(after.gold).toBe(before.gold + 1)
      return
    }

    if (trinketId === 'cloak_of_flames') {
      const before = withSingleCardTrinketState('defend', 'cloak_of_flames')
      const after = endTurn(before)
      expect(after.enemy.status.burn).toBeGreaterThan(0)
      return
    }

    if (trinketId === 'campfire' || trinketId === 'camp_kit') {
      const before = withSingleCardTrinketState('defend', trinketId)
      const after = endTurn(before)
      expect(after.phase).toBe('player_turn')
      return
    }

    throw new Error(`No trinket test handler for '${trinketId}'.`)
  })
}
