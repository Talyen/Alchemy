import { test, expect } from '@playwright/test'
import { createGame, playCard, endTurn } from '../src/combat'
import { ALL_CARDS } from '../src/data'

function getOnlyHandCardUid(state: ReturnType<typeof createGame>): string {
  const card = state.hand[0]
  if (!card) {
    throw new Error('Expected at least one card in hand')
  }
  return card.uid
}

function cardById(cardId: string) {
  const card = ALL_CARDS.find(entry => entry.id === cardId)
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`)
  }
  return card
}

test.describe('Combat Logic', () => {
  test('renames elite ogre to Orc Chieftain', () => {
    const game = createGame(30, [], 'elite', 0, 'knight', 'ogre', [], undefined, 0)
    expect(game.enemy.name).toBe('Orc Chieftain')
  })

  test('skeleton has blunt weakness', () => {
    const game = createGame(30, [], 'basic', 0, 'knight', 'skelet', [], undefined, 0)
    expect(game.enemy.weaknesses).toContain('blunt')
  })

  test('orc enemies have burn weakness', () => {
    const maskedOrc = createGame(30, [], 'basic', 0, 'knight', 'masked_orc', [], undefined, 0)
    const orcShaman = createGame(30, [], 'basic', 0, 'knight', 'orc_shaman', [], undefined, 0)
    const orcWarrior = createGame(30, [], 'basic', 0, 'knight', 'orc_warrior', [], undefined, 0)
    const orcChieftain = createGame(30, [], 'elite', 0, 'knight', 'ogre', [], undefined, 0)

    expect(maskedOrc.enemy.weaknesses).toContain('burn')
    expect(orcShaman.enemy.weaknesses).toContain('burn')
    expect(orcWarrior.enemy.weaknesses).toContain('burn')
    expect(orcChieftain.enemy.weaknesses).toContain('burn')
  })

  test('blunt damage is doubled against skeleton', () => {
    const bash = cardById('bash')
    const game = createGame(30, [], 'basic', 0, 'knight', 'skelet', [], [bash], 0)

    const startHp = game.enemy.hp
    const next = playCard(game, getOnlyHandCardUid(game))

    expect(startHp - next.enemy.hp).toBe(16)
  })

  test('burn application damage is doubled against burn-weak orcs', () => {
    const fireball = cardById('fireball')
    const game = createGame(30, [], 'basic', 0, 'wizard', 'masked_orc', [], [fireball], 0)

    const startHp = game.enemy.hp
    const afterCard = playCard(game, getOnlyHandCardUid(game))

    expect(startHp - afterCard.enemy.hp).toBe(6)
    expect(afterCard.enemy.status.burn).toBe(3)
  })

  test('burn tick damage is doubled against burn-weak orcs', () => {
    const fireball = cardById('fireball')
    const game = createGame(30, [], 'basic', 0, 'wizard', 'masked_orc', [], [fireball], 0)

    const afterCard = playCard(game, getOnlyHandCardUid(game))
    const beforeTurnHp = afterCard.enemy.hp
    const afterTurn = endTurn(afterCard)

    expect(beforeTurnHp - afterTurn.enemy.hp).toBe(6)
    expect(afterTurn.enemy.status.burn).toBe(2)
  })
})
