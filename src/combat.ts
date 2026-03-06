import type { GameState, StatusEffects } from './types'
import type { CardDef } from './types'
import { ALL_CARDS, emptyStatus, makeStartingDeck, makeCardInstances, pickEncounterEnemy, pickEncounterEnemyById } from './data'

const TRINKET_SPECIAL_DELIVERY = 'special_delivery'
const TRINKET_EQUIVALENT_EXCHANGE = 'equivalent_exchange'
const TRINKET_GREEN_THUMB = 'green_thumb'
const TRINKET_TORCH = 'torch'
const TRINKET_SPELL_TOME = 'spell_tome'

const WIZARD_CARD_IDS = ['fireball', 'defend', 'mana_crystal', 'mana_berries', 'cleanse']

// ─── Internals ───────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function calcDamage(base: number, atk: StatusEffects, def: StatusEffects): number {
  let dmg = base + atk.strength + atk.forge
  if (atk.weak > 0) dmg = Math.floor(dmg * 0.75)
  if (def.vulnerable > 0) dmg = Math.floor(dmg * 1.5)
  return Math.max(0, dmg)
}

function applyDamage<T extends { hp: number; block: number }>(target: T, damage: number): T {
  const absorbed = Math.min(target.block, damage)
  return {
    ...target,
    block: target.block - absorbed,
    hp: Math.max(0, target.hp - (damage - absorbed)),
  }
}

function tickStatus(s: StatusEffects): StatusEffects {
  return { ...s, vulnerable: Math.max(0, s.vulnerable - 1), weak: Math.max(0, s.weak - 1) }
}

function drawCards(s: GameState, count: number): GameState {
  let { drawPile, discardPile, hand } = s
  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break
      drawPile = shuffle(discardPile)
      discardPile = []
    }
    hand = [...hand, drawPile[0]]
    drawPile = drawPile.slice(1)
  }
  return { ...s, drawPile, discardPile, hand }
}

function hasTrinket(state: GameState, trinketId: string): boolean {
  return state.trinketIds.includes(trinketId)
}

function randomizeOneHandCard(state: GameState): GameState {
  if (state.hand.length === 0) return state

  const handIndex = Math.floor(Math.random() * state.hand.length)
  const current = state.hand[handIndex]
  const candidateDefs = ALL_CARDS.filter(card => card.id !== current.id)
  if (candidateDefs.length === 0) return state

  const randomDef = candidateDefs[Math.floor(Math.random() * candidateDefs.length)]
  const randomCard = makeCardInstances([randomDef])[0]
  const nextHand = [...state.hand]
  nextHand[handIndex] = randomCard

  const next = {
    ...state,
    hand: nextHand,
    lastCardPlayedId: randomCard.id,
  }

  return addLog(next, `  → Equivalent Exchange randomizes ${current.name} into ${randomDef.name}.`)
}

function applyCombatStartTrinkets(state: GameState): GameState {
  let s = state

  if (hasTrinket(s, TRINKET_TORCH)) {
    s = {
      ...s,
      enemy: {
        ...s.enemy,
        status: {
          ...s.enemy.status,
          burn: s.enemy.status.burn + 5,
        },
      },
    }
    s = addLog(s, `  → Torch scorches ${s.enemy.name} for 5 Burn.`)
  }

  if (hasTrinket(s, TRINKET_SPELL_TOME)) {
    const wizardPool = ALL_CARDS.filter(card => WIZARD_CARD_IDS.includes(card.id))
    const grantedDefs: CardDef[] = []
    for (let i = 0; i < 2; i++) {
      const picked = wizardPool[Math.floor(Math.random() * wizardPool.length)]
      if (picked) grantedDefs.push(picked)
    }
    if (grantedDefs.length > 0) {
      const grantedCards = makeCardInstances(grantedDefs)
      s = {
        ...s,
        hand: [...s.hand, ...grantedCards],
      }
      s = addLog(s, '  → Spell Tome grants 2 random Wizard cards.')
    }
  }

  if (hasTrinket(s, TRINKET_EQUIVALENT_EXCHANGE)) {
    s = randomizeOneHandCard(s)
  }

  return s
}

function applyTurnStartTrinkets(state: GameState): GameState {
  let s = state

  if (hasTrinket(s, TRINKET_SPECIAL_DELIVERY)) {
    s = drawCards(s, 1)
    s = addLog(s, '  → Special Delivery draws 1 extra card.')
  }

  if (hasTrinket(s, TRINKET_EQUIVALENT_EXCHANGE)) {
    s = randomizeOneHandCard(s)
  }

  return s
}

function addLog(s: GameState, ...lines: string[]): GameState {
  return { ...s, log: [...s.log, ...lines].slice(-10) }
}

function removeAilments(status: StatusEffects, count: number): { status: StatusEffects; removed: number } {
  if (count <= 0) return { status, removed: 0 }
  const order: Array<keyof StatusEffects> = ['burn', 'poison', 'bleed', 'vulnerable', 'weak']
  let remaining = count
  let removed = 0
  const next = { ...status }

  for (const key of order) {
    if (remaining <= 0) break
    if (next[key] > 0) {
      next[key] -= 1
      remaining -= 1
      removed += 1
    }
  }

  return { status: next, removed }
}

type AppliedEffects = {
  player: GameState['player']
  enemy: GameState['enemy']
  gold: number
  state: GameState
}

function applyCardEffects(state: GameState, player: GameState['player'], enemy: GameState['enemy'], effect: CardDef['effect'], sourceName: string): AppliedEffects {
  let s = state
  let nextPlayer = player
  let nextEnemy = enemy
  let nextGold = state.gold

  if (effect.damage !== undefined) {
    const dmg = calcDamage(effect.damage, nextPlayer.status, nextEnemy.status)
    nextEnemy = applyDamage(nextEnemy, dmg)
    s = addLog(s, `  → ${dmg} damage to ${nextEnemy.name}${nextEnemy.block > 0 ? ' (blocked some)' : ''}.`)
    if (effect.leech && dmg > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + dmg) }
      s = addLog(s, `  → Leech heals you for ${dmg}.`)
    }
  }
  if (effect.block !== undefined) {
    nextPlayer = { ...nextPlayer, block: nextPlayer.block + effect.block }
    s = addLog(s, `  → Gain ${effect.block} block.`)
  }
  if (effect.mana !== undefined) {
    const manaGained = Math.max(0, effect.mana)
    s = { ...s, mana: s.mana + manaGained }
    s = addLog(s, `  → Gain ${manaGained} Mana.`)
  }
  if (effect.vulnerable !== undefined) {
    nextEnemy = { ...nextEnemy, status: { ...nextEnemy.status, vulnerable: nextEnemy.status.vulnerable + effect.vulnerable } }
    s = addLog(s, `  → ${nextEnemy.name} is Vulnerable (${effect.vulnerable}).`)
  }
  if (effect.weak !== undefined) {
    nextEnemy = { ...nextEnemy, status: { ...nextEnemy.status, weak: nextEnemy.status.weak + effect.weak } }
    s = addLog(s, `  → ${nextEnemy.name} is Weak (${effect.weak}).`)
  }
  if (effect.armor !== undefined) {
    nextPlayer = { ...nextPlayer, armor: nextPlayer.armor + effect.armor }
    s = addLog(s, `  → Gain ${effect.armor} armor.`)
  }
  if (effect.heal !== undefined) {
    const healBonus = hasTrinket(state, TRINKET_GREEN_THUMB) ? 1 : 0
    const totalHeal = effect.heal + healBonus
    const healed = Math.min(totalHeal, nextPlayer.maxHp - nextPlayer.hp)
    nextPlayer = { ...nextPlayer, hp: nextPlayer.hp + healed }
    s = addLog(s, `  → Heal ${healed} HP.`)
  }
  if (effect.forge !== undefined) {
    nextPlayer = { ...nextPlayer, status: { ...nextPlayer.status, forge: nextPlayer.status.forge + effect.forge } }
    s = addLog(s, `  → Gain ${effect.forge} Forge.`)
  }
  if (effect.burn !== undefined) {
    const burnApplied = effect.burn
    nextEnemy = {
      ...nextEnemy,
      hp: Math.max(0, nextEnemy.hp - burnApplied),
      status: { ...nextEnemy.status, burn: nextEnemy.status.burn + burnApplied },
    }
    s = addLog(s, `  → ${sourceName}: ${nextEnemy.name} gains ${burnApplied} Burn and burns for ${burnApplied}.`)
    if (effect.leech && burnApplied > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + burnApplied) }
      s = addLog(s, `  → Leech heals you for ${burnApplied}.`)
    }
  }
  if (effect.poison !== undefined) {
    const poisonApplied = effect.poison
    nextEnemy = {
      ...nextEnemy,
      hp: Math.max(0, nextEnemy.hp - poisonApplied),
      status: { ...nextEnemy.status, poison: nextEnemy.status.poison + poisonApplied },
    }
    s = addLog(s, `  → ${sourceName}: ${nextEnemy.name} gains ${poisonApplied} Poison and takes ${poisonApplied} damage.`)
    if (effect.leech && poisonApplied > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + poisonApplied) }
      s = addLog(s, `  → Leech heals you for ${poisonApplied}.`)
    }
  }
  if (effect.bleed !== undefined) {
    const bleedApplied = effect.bleed
    nextEnemy = {
      ...nextEnemy,
      hp: Math.max(0, nextEnemy.hp - bleedApplied),
      status: { ...nextEnemy.status, bleed: nextEnemy.status.bleed + bleedApplied },
    }
    s = addLog(s, `  → ${sourceName}: ${nextEnemy.name} gains ${bleedApplied} Bleed and takes ${bleedApplied} physical damage.`)
    if (effect.leech && bleedApplied > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + bleedApplied) }
      s = addLog(s, `  → Leech heals you for ${bleedApplied}.`)
    }
  }
  if (effect.selfBurn !== undefined) {
    const selfBurnApplied = effect.selfBurn
    nextPlayer = {
      ...nextPlayer,
      hp: Math.max(0, nextPlayer.hp - selfBurnApplied),
      status: { ...nextPlayer.status, burn: nextPlayer.status.burn + selfBurnApplied },
    }
    s = addLog(s, `  → ${sourceName}: You gain ${selfBurnApplied} Burn and burn for ${selfBurnApplied}.`)
  }

  if (effect.gold !== undefined) {
    nextGold += effect.gold
    s = addLog(s, `  → Gain ${effect.gold} Gold.`)
  }

  if (effect.manaCrystal !== undefined) {
    const crystals = effect.manaCrystal
    s = {
      ...s,
      maxMana: s.maxMana + crystals,
    }
    s = addLog(s, `  → Gain ${crystals} Mana Crystal.`)
  }

  if (effect.haste !== undefined) {
    const gained = Math.max(0, effect.haste)
    s = { ...s, extraTurns: s.extraTurns + gained }
    s = addLog(s, `  → Gain ${gained} Haste.`)
  }

  if (effect.cleanse !== undefined) {
    const cleanseCount = Math.max(0, effect.cleanse)
    const { status, removed } = removeAilments(nextPlayer.status, cleanseCount)
    nextPlayer = { ...nextPlayer, status }
    s = addLog(s, removed > 0 ? `  → Cleansed ${removed} Ailment.` : '  → No Ailments to cleanse.')
  }

  if (effect.trap !== undefined) {
    const trapDamage = Math.max(0, effect.trap)
    nextPlayer = {
      ...nextPlayer,
      status: { ...nextPlayer.status, trap: nextPlayer.status.trap + trapDamage },
    }
    s = addLog(s, `  → Set a Trap for ${trapDamage} damage.`)
  }

  if (effect.wish !== undefined) {
    const wishCount = Math.max(0, effect.wish)
    if (wishCount > 0) {
      const options = shuffle(ALL_CARDS).slice(0, 3)
      s = { ...s, wishOptions: options }
      s = addLog(s, `  → Wish ${wishCount}: choose 1 of 3 cards.`)
    }
  }

  return { player: nextPlayer, enemy: nextEnemy, gold: nextGold, state: s }
}

function applyPersistentUpgrades(state: GameState): GameState {
  if (state.activeUpgrades.length === 0) return state

  let s = state
  let player = s.player
  let enemy = s.enemy
  let gold = s.gold

  for (const upgrade of s.activeUpgrades) {
    const applied = applyCardEffects(s, player, enemy, upgrade.effect, upgrade.name)
    s = { ...applied.state, lastCardPlayedId: upgrade.id }
    player = applied.player
    enemy = applied.enemy
    gold = applied.gold

    if (enemy.hp <= 0) {
      return { ...s, enemy, player, phase: 'win' }
    }
    if (player.hp <= 0) {
      return { ...s, enemy, player, phase: 'lose' }
    }
  }

  return { ...s, player, enemy, gold }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createGame(
  persistHp = 30,
  extraCards: CardDef[] = [],
  encounterTier: 'basic' | 'elite' = 'basic',
  persistGold = 0,
  characterId = 'knight',
  forcedEnemyId?: string,
  trinketIds: string[] = [],
): GameState {
  const deck = shuffle([...makeStartingDeck(characterId), ...makeCardInstances(extraCards)])
  const encounterEnemy = forcedEnemyId
    ? pickEncounterEnemyById(forcedEnemyId)
    : pickEncounterEnemy(encounterTier)
  const base: GameState = {
    characterId,
    trinketIds,
    phase: 'player_turn',
    turn: 1,
    player: { hp: Math.min(persistHp, 30), maxHp: 30, block: 0, armor: 0, status: emptyStatus() },
    enemy: encounterEnemy,
    hand: [],
    drawPile: deck,
    discardPile: [],
    exhaustPile: [],
    mana: 3,
    maxMana: 3,
    extraTurns: 0,
    wishOptions: [],
    gold: persistGold,
    log: ['Combat begins!'],
    lastCardPlayedId: null,
    activeUpgrades: [],
  }
  const startingDraw = 5 + (trinketIds.includes(TRINKET_SPECIAL_DELIVERY) ? 1 : 0)
  let s = drawCards(addLog(base, `Turn 1 — draw ${startingDraw} cards.`), startingDraw)
  s = applyCombatStartTrinkets(s)
  return s
}

export function playCard(state: GameState, cardUid: string): GameState {
  if (state.phase !== 'player_turn') return state
  const card = state.hand.find(c => c.uid === cardUid)
  if (!card || state.mana < card.cost) return state

  let { player, enemy } = state
  let gold = state.gold
  let s = addLog({ ...state, mana: state.mana - card.cost }, `You play ${card.name}.`)

  const isPersistentUpgrade = card.type === 'upgrade'
  const isConsumed = /\bconsume\b/i.test(card.description)

  if (!isPersistentUpgrade) {
    const applied = applyCardEffects(s, player, enemy, card.effect, card.name)
    s = applied.state
    player = applied.player
    enemy = applied.enemy
    gold = applied.gold
  }

  // Upgrade/Consume cards are removed from the fight, not discarded
  const removeAfterUse = isPersistentUpgrade || isConsumed
  s = {
    ...s,
    player,
    enemy,
    hand: state.hand.filter(c => c.uid !== cardUid),
    discardPile: removeAfterUse ? state.discardPile : [...state.discardPile, card],
    exhaustPile: removeAfterUse ? [...state.exhaustPile, card] : state.exhaustPile,
    activeUpgrades: isPersistentUpgrade
      ? [...state.activeUpgrades, { id: card.id, name: card.name, description: card.description, effect: card.effect }]
      : state.activeUpgrades,
    mana: s.mana,
    wishOptions: s.wishOptions,
    gold,
    lastCardPlayedId: card.id,
  }

  if (isPersistentUpgrade) {
    s = addLog(s, `  → ${card.name} is now active.`)
  } else if (isConsumed) {
    s = addLog(s, `  → ${card.name} is consumed.`)
  }

  if (enemy.hp <= 0) {
    return addLog({ ...s, enemy, phase: 'win' }, '⚔ Victory!')
  }
  if (player.hp <= 0) {
    return addLog({ ...s, player, phase: 'lose' }, '☠ Defeated.')
  }
  return { ...s, enemy }
}

export function applyCompanionStrike(state: GameState, baseDamage: number, sourceName: string): GameState {
  if (state.phase !== 'player_turn') return state

  const damage = calcDamage(baseDamage, emptyStatus(), state.enemy.status)
  const enemy = applyDamage(state.enemy, damage)
  const next = addLog({ ...state, enemy, lastCardPlayedId: 'lizard_scout_collar' }, `  → ${sourceName} strikes for ${damage}.`)

  if (enemy.hp <= 0) {
    return addLog({ ...next, phase: 'win' }, '⚔ Victory!')
  }

  return next
}

export function endTurn(state: GameState): GameState {
  let s = startEnemyTurn(state)
  s = resolveEnemyStartOfTurn(s)
  if (s.phase !== 'enemy_turn') return s

  s = resolveEnemyAction(s)
  if (s.phase !== 'enemy_turn') return s

  return beginNextPlayerTurn(s)
}

export function startExtraTurnTransition(state: GameState): GameState {
  if (state.phase !== 'player_turn') return state
  if (state.extraTurns <= 0) return state

  let extraTurnState: GameState = {
    ...state,
    phase: 'enemy_turn',
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    extraTurns: state.extraTurns - 1,
    lastCardPlayedId: null,
  }

  extraTurnState = addLog(extraTurnState, 'Haste grants an extra turn.')
  return extraTurnState
}

export function startEnemyTurn(state: GameState): GameState {
  if (state.phase !== 'player_turn') return state

  if (state.extraTurns > 0) {
    return beginNextPlayerTurn(startExtraTurnTransition(state))
  }

  let s: GameState = {
    ...state,
    phase: 'enemy_turn',
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    lastCardPlayedId: null,
  }

  s = addLog(s, `${s.enemy.name}'s turn:`)
  s = applyPersistentUpgrades(s)
  if (s.phase === 'win') return addLog(s, '⚔ Victory!')
  if (s.phase === 'lose') return addLog(s, '☠ Defeated.')
  return s
}

export function resolveEnemyStartOfTurn(state: GameState): GameState {
  if (state.phase !== 'enemy_turn') return state

  let s: GameState = { ...state, lastCardPlayedId: null }
  let enemy = s.enemy

  if (enemy.status.burn > 0) {
    const b = enemy.status.burn
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - b), status: { ...enemy.status, burn: b - 1 } }
    s = addLog({ ...s, enemy }, `  → ${enemy.name} burns for ${b}.`)
    if (enemy.hp <= 0) return addLog({ ...s, enemy, phase: 'win' }, '⚔ Victory!')
  }

  if (enemy.status.poison > 0) {
    const p = enemy.status.poison
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - p) }
    s = addLog({ ...s, enemy }, `  → ${enemy.name} is poisoned for ${p}.`)
    if (enemy.hp <= 0) return addLog({ ...s, enemy, phase: 'win' }, '⚔ Victory!')
  }

  if (enemy.status.bleed > 0) {
    const b = enemy.status.bleed
    const bleedDmg = b * 2
    enemy = {
      ...enemy,
      hp: Math.max(0, enemy.hp - bleedDmg),
      status: { ...enemy.status, bleed: 0 },
    }
    s = addLog({ ...s, enemy }, `  → ${enemy.name} bleeds for ${bleedDmg}.`)
    if (enemy.hp <= 0) return addLog({ ...s, enemy, phase: 'win' }, '⚔ Victory!')
  }

  return { ...s, enemy }
}

export function resolveEnemyAction(state: GameState): GameState {
  if (state.phase !== 'enemy_turn') return state

  let s: GameState = { ...state, lastCardPlayedId: null }
  let { player, enemy } = s
  const intent = enemy.pattern[enemy.patternIndex]

  if (intent.type === 'attack') {
    const rawDmg = calcDamage(intent.value, enemy.status, player.status)
    const armorReduction = intent.physical ? player.armor : 0
    const dmg = Math.max(0, rawDmg - armorReduction)
    player = applyDamage(player, dmg)
    const armorNote = armorReduction > 0 ? ` (${armorReduction} absorbed by armor)` : ''
    s = addLog(s, `  → Attacks for ${rawDmg} damage${armorNote}.`)

    if (player.status.trap > 0) {
      const trapDamage = player.status.trap
      enemy = applyDamage(enemy, trapDamage)
      player = {
        ...player,
        status: { ...player.status, trap: 0 },
      }
      s = addLog(s, `  → Trap triggers for ${trapDamage} damage.`)
      if (enemy.hp <= 0) {
        return addLog({ ...s, player, enemy, phase: 'win' }, '⚔ Victory!')
      }
    }
  } else if (intent.type === 'defend') {
    enemy = { ...enemy, block: enemy.block + intent.value }
    s = addLog(s, `  → Gains ${intent.value} block.`)
  } else if (intent.type === 'heal') {
    const healed = Math.min(intent.value, enemy.maxHp - enemy.hp)
    enemy = { ...enemy, hp: enemy.hp + healed }
    s = addLog(s, `  → Heals for ${healed}.`)
  } else if (intent.type === 'upgrade') {
    enemy = {
      ...enemy,
      armor: enemy.armor + intent.value,
      status: { ...enemy.status, strength: enemy.status.strength + 1 },
    }
    s = addLog(s, `  → Fortifies (+${intent.value} Armor, +1 Strength).`)
  }

  enemy = {
    ...enemy,
    patternIndex: (enemy.patternIndex + 1) % enemy.pattern.length,
    status: tickStatus(enemy.status),
  }
  s = { ...s, player, enemy }

  if (player.hp <= 0) {
    return addLog({ ...s, phase: 'lose' }, '☠ Defeated.')
  }

  return s
}

export function beginNextPlayerTurn(state: GameState): GameState {
  if (state.phase !== 'enemy_turn') return state

  let s = state
  const newTurn = s.turn + 1
  s = {
    ...s,
    phase: 'player_turn',
    turn: newTurn,
    mana: s.maxMana,
    player: { ...s.player, status: tickStatus(s.player.status) },
    enemy: { ...s.enemy },
    lastCardPlayedId: null,
  }

  if (s.player.status.burn > 0) {
    const b = s.player.status.burn
    s = {
      ...s,
      player: {
        ...s.player,
        hp: Math.max(0, s.player.hp - b),
        status: { ...s.player.status, burn: b - 1 },
      },
    }
    s = addLog(s, `  → You burn for ${b}.`)
    if (s.player.hp <= 0) {
      return addLog({ ...s, phase: 'lose' }, '☠ Defeated.')
    }
  }

  if (s.player.status.poison > 0) {
    const p = s.player.status.poison
    s = {
      ...s,
      player: {
        ...s.player,
        hp: Math.max(0, s.player.hp - p),
      },
    }
    s = addLog(s, `  → You are poisoned for ${p}.`)
    if (s.player.hp <= 0) {
      return addLog({ ...s, phase: 'lose' }, '☠ Defeated.')
    }
  }

  if (s.player.status.bleed > 0) {
    const b = s.player.status.bleed
    const rawBleed = b * 2
    const armorReduction = s.player.armor
    const bleedDmg = Math.max(0, rawBleed - armorReduction)
    s = {
      ...s,
      player: {
        ...applyDamage(s.player, bleedDmg),
        status: { ...s.player.status, bleed: 0 },
      },
    }
    const armorNote = armorReduction > 0 ? ` (${armorReduction} absorbed by armor)` : ''
    s = addLog(s, `  → You bleed for ${rawBleed}${armorNote}.`)
    if (s.player.hp <= 0) {
      return addLog({ ...s, phase: 'lose' }, '☠ Defeated.')
    }
  }

  s = addLog(s, `Turn ${newTurn} — draw 5 cards.`)
  s = drawCards(s, 5)
  return applyTurnStartTrinkets(s)
}
