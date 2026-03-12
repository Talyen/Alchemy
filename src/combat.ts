import type { EnemyWeakness, GameState, StatusEffects } from './types'
import type { CardDef } from './types'
import { ALL_CARDS, emptyStatus, makeStartingDeck, makeCardInstances, pickEncounterEnemy, pickEncounterEnemyById } from './data'

const TRINKET_SPECIAL_DELIVERY = 'special_delivery'
const TRINKET_MAIL_DELIVERY = 'mail_delivery'
const TRINKET_EQUIVALENT_EXCHANGE = 'equivalent_exchange'
const TRINKET_GREEN_THUMB = 'green_thumb'
const TRINKET_TORCH = 'torch'
const TRINKET_SPELL_TOME = 'spell_tome'
const TRINKET_HOLY_LANTERN = 'holy_lantern'
const TRINKET_SCALES_OF_JUSTICE = 'scales_of_justice'

const TRINKET_LUCKY_COIN = 'lucky_coin'
const TRINKET_EMERALD = 'emerald'
const TRINKET_RUBY = 'ruby'
const TRINKET_SAPPHIRE = 'sapphire'

// New trinkets
const TRINKET_FLASH_FIRE = 'flash_fire'
const TRINKET_HIDDEN_BLADE = 'hidden_blade'
const TRINKET_SHIELD_OF_FAITH = 'shield_of_faith'
const TRINKET_MANA_CRYSTAL_TRINKET = 'mana_crystal_trinket'
const TRINKET_WARDSTONE_SHARD = 'wardstone_shard'
const TRINKET_SHIELDBREAKER = 'shieldbreaker'
const TRINKET_HEATFORGED_SHIELD = 'heatforged_shield'
const TRINKET_GOLDEN_FLAIL = 'golden_flail'
const TRINKET_GOLDEN_GREAT_AXE = 'golden_great_axe'
const TRINKET_CLOAK_OF_FLAMES = 'cloak_of_flames'

// Talent flags carried as synthetic trinket IDs
const TALENT_CONTROLLED_BURN = 'talent_controlled_burn'
const TALENT_MELT_ARMOR = 'talent_melt_armor'
const TALENT_AVATAR_OF_FIRE = 'talent_avatar_of_fire'
const TALENT_HOLY_FLAME = 'talent_holy_flame'
const TALENT_HOT_STREAK = 'talent_hot_streak'
const TALENT_PYROMANIA = 'talent_pyromania'

const WIZARD_CARD_IDS = ['fireball', 'defend', 'mana_crystal', 'mana_berries', 'cleanse']
const HAND_SIZE_LIMIT = 7

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

function applyEnemyWeaknessMultiplier(
  enemy: GameState['enemy'],
  damage: number,
  weaknessType: EnemyWeakness | null,
): { damage: number; doubled: boolean } {
  if (!weaknessType || damage <= 0) {
    return { damage, doubled: false }
  }
  if (!enemy.weaknesses.includes(weaknessType)) {
    return { damage, doubled: false }
  }
  return { damage: damage * 2, doubled: true }
}

function inferDirectDamageWeaknessType(cardId?: string): EnemyWeakness | null {
  if (!cardId) return null
  if (cardId === 'bash' || cardId === 'steal') return 'blunt'
  return null
}

function isHolyDamageSource(cardId?: string, sourceName?: string): boolean {
  if (cardId === 'holy_blade' || cardId === 'blessed_aegis') return true
  if (!sourceName) return false
  return sourceName.toLowerCase().includes('holy')
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
  let overflowCount = 0
  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break
      drawPile = shuffle(discardPile)
      discardPile = []
    }
    const nextCard = drawPile[0]
    if (hand.length >= HAND_SIZE_LIMIT) {
      // Over-cap draws are mechanically discarded and surfaced to UI as dissolve FX.
      discardPile = [...discardPile, nextCard]
      overflowCount += 1
    } else {
      hand = [...hand, nextCard]
    }
    drawPile = drawPile.slice(1)
  }

  const nextState = { ...s, drawPile, discardPile, hand }
  if (overflowCount <= 0) return nextState

  return addLog({
    ...nextState,
    overflowDiscardFxToken: s.overflowDiscardFxToken + 1,
    overflowDiscardFxCount: overflowCount,
  }, `  → ${overflowCount} card${overflowCount === 1 ? '' : 's'} dissolved from overflow and went to discard.`)
}

function addCardsToHandWithLimit(state: GameState, cards: ReturnType<typeof makeCardInstances>, sourceLabel: string): GameState {
  if (cards.length === 0) return state

  const availableSlots = Math.max(0, HAND_SIZE_LIMIT - state.hand.length)
  const toHand = cards.slice(0, availableSlots)
  const overflow = cards.slice(availableSlots)

  let nextState: GameState = {
    ...state,
    hand: [...state.hand, ...toHand],
    discardPile: [...state.discardPile, ...overflow],
  }

  if (overflow.length > 0) {
    nextState = addLog({
      ...nextState,
      overflowDiscardFxToken: state.overflowDiscardFxToken + 1,
      overflowDiscardFxCount: overflow.length,
    }, `  → ${sourceLabel}: ${overflow.length} card${overflow.length === 1 ? '' : 's'} dissolved from hand overflow.`)
  }

  return nextState
}

function hasTrinket(state: GameState, trinketId: string): boolean {
  return state.trinketIds.includes(trinketId)
}

function cardContainsKeyword(card: CardDef, keyword: string): boolean {
  const haystack = `${card.name} ${card.description}`.toLowerCase()
  return haystack.includes(keyword.toLowerCase())
}

function weightedCardChanceMultiplier(card: CardDef, trinketIds: string[]): number {
  let multiplier = 1
  if (trinketIds.includes(TRINKET_LUCKY_COIN) && (cardContainsKeyword(card, 'Gold') || cardContainsKeyword(card, 'Holy'))) {
    multiplier *= 2
  }
  if (trinketIds.includes(TRINKET_EMERALD) && (cardContainsKeyword(card, 'Poison') || cardContainsKeyword(card, 'Heal'))) {
    multiplier *= 2
  }
  if (trinketIds.includes(TRINKET_RUBY) && (cardContainsKeyword(card, 'Burn') || cardContainsKeyword(card, 'Leech'))) {
    multiplier *= 2
  }
  if (trinketIds.includes(TRINKET_SAPPHIRE) && (cardContainsKeyword(card, 'Mana') || cardContainsKeyword(card, 'Block') || cardContainsKeyword(card, 'Mana Crystal'))) {
    multiplier *= 2
  }
  return multiplier
}

function weightedPickCardDef(pool: CardDef[], trinketIds: string[]): CardDef | null {
  if (pool.length === 0) return null
  const weighted = pool.map(card => ({ card, weight: weightedCardChanceMultiplier(card, trinketIds) }))
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return weighted[0].card
  let roll = Math.random() * total
  for (const entry of weighted) {
    roll -= entry.weight
    if (roll <= 0) return entry.card
  }
  return weighted[weighted.length - 1].card
}

function weightedPickDistinctCards(pool: CardDef[], count: number, trinketIds: string[]): CardDef[] {
  const picks: CardDef[] = []
  const nextPool = [...pool]
  for (let i = 0; i < count && nextPool.length > 0; i++) {
    const picked = weightedPickCardDef(nextPool, trinketIds)
    if (!picked) break
    picks.push(picked)
    const index = nextPool.findIndex(card => card.id === picked.id)
    if (index >= 0) nextPool.splice(index, 1)
  }
  return picks
}

function randomizeOneHandCard(state: GameState): GameState {
  if (state.hand.length === 0) return state

  const handIndex = Math.floor(Math.random() * state.hand.length)
  const current = state.hand[handIndex]
  const candidateDefs = ALL_CARDS.filter(card => card.id !== current.id)
  if (candidateDefs.length === 0) return state

  const randomDef = weightedPickCardDef(candidateDefs, state.trinketIds)
  if (!randomDef) return state
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
      const picked = weightedPickCardDef(wizardPool, s.trinketIds)
      if (picked) grantedDefs.push(picked)
    }
    if (grantedDefs.length > 0) {
      const grantedCards = makeCardInstances(grantedDefs)
      s = addCardsToHandWithLimit(s, grantedCards, 'Spell Tome')
      s = addLog(s, '  → Spell Tome grants 2 random Wizard cards.')
    }
  }

  if (hasTrinket(s, TRINKET_EQUIVALENT_EXCHANGE)) {
    s = randomizeOneHandCard(s)
  }

  // Mana Crystal trinket: +1 max mana each combat
  if (hasTrinket(s, TRINKET_MANA_CRYSTAL_TRINKET)) {
    s = { ...s, maxMana: s.maxMana + 1, mana: s.mana + 1 }
    s = addLog(s, '  → Mana Crystal grants +1 Max Mana this combat.')
  }

  return s
}

function applyTurnStartTrinkets(state: GameState): GameState {
  let s = state

  if (hasTrinket(s, TRINKET_MAIL_DELIVERY)) {
    s = drawCards(s, 1)
    s = addLog(s, '  → Mail Delivery draws 1 extra card.')
  }

  if (hasTrinket(s, TRINKET_SPECIAL_DELIVERY)) {
    const createdDef = weightedPickCardDef(ALL_CARDS, s.trinketIds)
    if (createdDef) {
      s = addCardsToHandWithLimit(s, makeCardInstances([createdDef]), 'Special Delivery')
      s = addLog(s, `  → Special Delivery creates ${createdDef.name}.`)
    }
  }

  if (hasTrinket(s, TRINKET_EQUIVALENT_EXCHANGE)) {
    s = randomizeOneHandCard(s)
  }

  // Cloak of Flames: deal 1 Burn to enemy each turn
  if (hasTrinket(s, TRINKET_CLOAK_OF_FLAMES)) {
    s = {
      ...s,
      enemy: { ...s.enemy, status: { ...s.enemy.status, burn: s.enemy.status.burn + 1 } },
    }
    s = addLog(s, `  → Cloak of Flames scorches ${s.enemy.name} for 1 Burn.`)
  }

  return s
}

function isBurnCard(card: GameState['hand'][number]): boolean {
  return (card.effect.burn ?? 0) > 0 || /\bburn\b/i.test(card.description)
}

function drawOneBurnCard(state: GameState): GameState {
  if (state.hand.length >= HAND_SIZE_LIMIT) return state

  const drawIndex = state.drawPile.findIndex(isBurnCard)
  if (drawIndex >= 0) {
    const card = state.drawPile[drawIndex]
    const drawPile = [...state.drawPile.slice(0, drawIndex), ...state.drawPile.slice(drawIndex + 1)]
    return addLog({ ...state, drawPile, hand: [...state.hand, card] }, `  → Hot Streak draws ${card.name}.`)
  }

  const discardIndex = state.discardPile.findIndex(isBurnCard)
  if (discardIndex >= 0) {
    const card = state.discardPile[discardIndex]
    const discardPile = [...state.discardPile.slice(0, discardIndex), ...state.discardPile.slice(discardIndex + 1)]
    return addLog({ ...state, discardPile, hand: [...state.hand, card] }, `  → Hot Streak draws ${card.name}.`)
  }

  return state
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

function applyCardEffects(
  state: GameState,
  player: GameState['player'],
  enemy: GameState['enemy'],
  effect: CardDef['effect'],
  sourceName: string,
  sourceCardId?: string,
): AppliedEffects {
  let s = state
  let nextPlayer = player
  let nextEnemy = enemy
  let nextGold = state.gold

  if (effect.damage !== undefined) {
    const baseDamage = calcDamage(effect.damage, nextPlayer.status, nextEnemy.status)
    const weaknessType = inferDirectDamageWeaknessType(sourceCardId)
    const { damage: weakAdjustedDamage, doubled } = applyEnemyWeaknessMultiplier(nextEnemy, baseDamage, weaknessType)
    const isHolyDamage = isHolyDamageSource(sourceCardId, sourceName)
    const holyLanternBonus = isHolyDamage && hasTrinket(state, TRINKET_HOLY_LANTERN) && nextEnemy.status.burn > 0
    // Shieldbreaker: double damage if enemy has block
    const shieldbreakerBonus = hasTrinket(state, TRINKET_SHIELDBREAKER) && nextEnemy.block > 0
    let dmg = holyLanternBonus ? weakAdjustedDamage * 2 : weakAdjustedDamage
    if (shieldbreakerBonus) dmg = dmg * 2
    nextEnemy = applyDamage(nextEnemy, dmg)
    const weaknessNote = doubled ? ' (weakness exploited)' : ''
    const holyLanternNote = holyLanternBonus ? ' (Holy Lantern)' : ''
    const shieldbreakerNote = shieldbreakerBonus ? ' (Shieldbreaker)' : ''
    s = addLog(s, `  → ${dmg} damage to ${nextEnemy.name}${nextEnemy.block > 0 ? ' (blocked some)' : ''}${weaknessNote}${holyLanternNote}${shieldbreakerNote}.`)

    if (isHolyDamage && hasTrinket(state, TRINKET_SCALES_OF_JUSTICE)) {
      const target = nextPlayer.hp <= nextEnemy.hp ? 'player' : 'enemy'
      if (target === 'player') {
        nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + 1) }
        s = addLog(s, '  → Scales of Justice heals you for 1.')
      } else {
        nextEnemy = { ...nextEnemy, hp: Math.min(nextEnemy.maxHp, nextEnemy.hp + 1) }
        s = addLog(s, `  → Scales of Justice heals ${nextEnemy.name} for 1.`)
      }
    }

    if (effect.leech && dmg > 0) {
      nextPlayer = { ...nextPlayer, hp: Math.min(nextPlayer.maxHp, nextPlayer.hp + dmg) }
      s = addLog(s, `  → Leech heals you for ${dmg}.`)
    }

    // Golden Flail: blunt damage earns gold
    if (hasTrinket(state, TRINKET_GOLDEN_FLAIL) && weaknessType === 'blunt' && dmg > 0) {
      nextGold += 1
      s = addLog(s, '  → Golden Flail earns 1 Gold.')
    }
    // Golden Great Axe: slash damage earns gold
    if (hasTrinket(state, TRINKET_GOLDEN_GREAT_AXE) && (sourceCardId === 'slash') && dmg > 0) {
      nextGold += 1
      s = addLog(s, '  → Golden Great Axe earns 1 Gold.')
    }
  }
  if (effect.block !== undefined) {
    nextPlayer = { ...nextPlayer, block: nextPlayer.block + effect.block }
    // Shield of Faith: holy cards grant +1 Block
    const isHolyCard = isHolyDamageSource(sourceCardId, sourceName)
    const shieldFaithBonus = hasTrinket(state, TRINKET_SHIELD_OF_FAITH) && isHolyCard ? 1 : 0
    if (shieldFaithBonus > 0) {
      nextPlayer = { ...nextPlayer, block: nextPlayer.block + shieldFaithBonus }
      s = addLog(s, `  → Gain ${effect.block + shieldFaithBonus} block (Shield of Faith +1).`)
    } else {
      s = addLog(s, `  → Gain ${effect.block} block.`)
    }
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
    const { damage: weakBurnDamage, doubled } = applyEnemyWeaknessMultiplier(nextEnemy, burnApplied, 'burn')
    const controlledBonus = hasTrinket(state, TALENT_CONTROLLED_BURN) ? 1 : 0
    const meltArmorBonus = hasTrinket(state, TALENT_MELT_ARMOR) && nextEnemy.block > 0
    let burnDamage = weakBurnDamage + controlledBonus
    if (meltArmorBonus) burnDamage *= 2
    nextEnemy = {
      ...nextEnemy,
      hp: Math.max(0, nextEnemy.hp - burnDamage),
      status: { ...nextEnemy.status, burn: nextEnemy.status.burn + burnApplied },
    }
    const weaknessNote = doubled ? ' (weakness exploited)' : ''
    const controlledNote = controlledBonus > 0 ? ' (Controlled Burn)' : ''
    const meltArmorNote = meltArmorBonus ? ' (Melt Armor)' : ''
    s = addLog(s, `  → ${sourceName}: ${nextEnemy.name} gains ${burnApplied} Burn and burns for ${burnDamage}${weaknessNote}${controlledNote}${meltArmorNote}.`)

    if (hasTrinket(state, TALENT_HOLY_FLAME) && burnDamage > 0) {
      const holyBonusDamage = Math.max(1, Math.floor(burnDamage * 0.2))
      nextEnemy = { ...nextEnemy, hp: Math.max(0, nextEnemy.hp - holyBonusDamage) }
      s = addLog(s, `  → Holy Flame deals ${holyBonusDamage} Holy damage.`)
    }
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
  if (effect.chill !== undefined) {
    const chillApplied = effect.chill
    const chillDamage = chillApplied // immediate damage equal to chill stacks
    nextEnemy = {
      ...nextEnemy,
      hp: Math.max(0, nextEnemy.hp - chillDamage),
      status: { ...nextEnemy.status, chill: nextEnemy.status.chill + chillApplied },
    }
    const threshold = Math.ceil(nextEnemy.maxHp * 0.2)
    const willFreeze = nextEnemy.status.chill + chillApplied >= threshold
    const freezeNote = willFreeze ? ' (will freeze on next turn!)' : ''
    s = addLog(s, `  → ${sourceName}: ${nextEnemy.name} gains ${chillApplied} Chill${freezeNote}.`)
  }
  if (effect.removeSelfBleed) {
    const bleedRemoved = nextPlayer.status.bleed
    nextPlayer = { ...nextPlayer, status: { ...nextPlayer.status, bleed: 0 } }
    if (bleedRemoved > 0) s = addLog(s, `  → Removed ${bleedRemoved} Bleed from yourself.`)
    else s = addLog(s, '  → No Bleed to remove.')
  }
  if (effect.doubleEnemyBleed) {
    const newBleed = nextEnemy.status.bleed * 2
    nextEnemy = { ...nextEnemy, status: { ...nextEnemy.status, bleed: newBleed } }
    s = addLog(s, `  → ${nextEnemy.name}'s Bleed doubled to ${newBleed}.`)
  }
  if (effect.doubleEnemyBurn) {
    const newBurn = nextEnemy.status.burn * 2
    nextEnemy = { ...nextEnemy, status: { ...nextEnemy.status, burn: newBurn } }
    s = addLog(s, `  → ${nextEnemy.name}'s Burn doubled to ${newBurn}.`)
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
      const options = weightedPickDistinctCards(ALL_CARDS, 3, state.trinketIds)
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
    const applied = applyCardEffects(s, player, enemy, upgrade.effect, upgrade.name, upgrade.id)
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
  deckOverride?: CardDef[],
  floorsCleared = 0,
): GameState {
  const deck = deckOverride && deckOverride.length > 0
    ? shuffle(makeCardInstances(deckOverride))
    : shuffle([...makeStartingDeck(characterId), ...makeCardInstances(extraCards)])
  const encounterEnemy = forcedEnemyId
    ? pickEncounterEnemyById(forcedEnemyId, floorsCleared)
    : pickEncounterEnemy(encounterTier, floorsCleared)
  const base: GameState = {
    characterId,
    trinketIds,
    phase: 'player_turn',
    turn: 1,
    player: { hp: persistHp, maxHp: persistHp, block: 0, armor: 0, status: emptyStatus() },
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
    overflowDiscardFxToken: 0,
    overflowDiscardFxCount: 0,
    battleUsedTrinkets: [],
  }
  const startingDraw = 5 + (trinketIds.includes(TRINKET_MAIL_DELIVERY) ? 1 : 0)
  let s = drawCards(addLog(base, `Turn 1 — draw ${startingDraw} cards.`), startingDraw)
  s = applyCombatStartTrinkets(s)
  return s
}

export function grantCardsToHand(state: GameState, defs: CardDef[], sourceLabel = 'Effect'): GameState {
  const instances = makeCardInstances(defs)
  return addCardsToHandWithLimit(state, instances, sourceLabel)
}

export function playCard(state: GameState, cardUid: string): GameState {
  if (state.phase !== 'player_turn') return state
  const card = state.hand.find(c => c.uid === cardUid)
  if (!card) return state

  // Determine effective cost (may be reduced by trinket once-per-battle effects)
  let effectiveCost = card.cost
  let nextBattleUsed = [...state.battleUsedTrinkets]
  const cardHasBurn = card.effect.burn !== undefined && card.effect.burn > 0
  const cardHasPierce = /pierce/i.test(card.description)

  if (hasTrinket(state, TRINKET_FLASH_FIRE) && cardHasBurn && !nextBattleUsed.includes(TRINKET_FLASH_FIRE)) {
    effectiveCost = 0
    nextBattleUsed = [...nextBattleUsed, TRINKET_FLASH_FIRE]
  }
  if (hasTrinket(state, TRINKET_HIDDEN_BLADE) && cardHasPierce && !nextBattleUsed.includes(TRINKET_HIDDEN_BLADE)) {
    effectiveCost = 0
    nextBattleUsed = [...nextBattleUsed, TRINKET_HIDDEN_BLADE]
  }

  if (state.mana < effectiveCost) return state

  let { player, enemy } = state
  let gold = state.gold
  let s = addLog({ ...state, mana: state.mana - effectiveCost, battleUsedTrinkets: nextBattleUsed }, `You play ${card.name}.`)

  const isPersistentUpgrade = card.type === 'upgrade'
  const isConsumed = /\bconsume\b/i.test(card.description)

  if (!isPersistentUpgrade) {
    const applied = applyCardEffects(s, player, enemy, card.effect, card.name, card.id)
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

export function applyCompanionEffect(
  state: GameState,
  effect: { damage?: number; burn?: number; poison?: number; bleed?: number },
  sourceName: string,
): GameState {
  if (state.phase !== 'player_turn') return state

  let enemy = state.enemy
  let next = state

  if ((effect.damage ?? 0) > 0) {
    const damage = calcDamage(effect.damage ?? 0, emptyStatus(), enemy.status)
    enemy = applyDamage(enemy, damage)
    next = addLog({ ...next, enemy, lastCardPlayedId: 'companion' }, `  → ${sourceName} strikes for ${damage}.`)
    if (enemy.hp <= 0) {
      return addLog({ ...next, phase: 'win' }, '⚔ Victory!')
    }
  }

  if ((effect.burn ?? 0) > 0) {
    const burnAmount = effect.burn ?? 0
    enemy = {
      ...enemy,
      status: { ...enemy.status, burn: enemy.status.burn + burnAmount },
    }
    next = addLog({ ...next, enemy }, `  → ${sourceName} inflicts ${burnAmount} Burn.`)
  }

  if ((effect.poison ?? 0) > 0) {
    const poisonAmount = effect.poison ?? 0
    enemy = {
      ...enemy,
      status: { ...enemy.status, poison: enemy.status.poison + poisonAmount },
    }
    next = addLog({ ...next, enemy }, `  → ${sourceName} inflicts ${poisonAmount} Poison.`)
  }

  if ((effect.bleed ?? 0) > 0) {
    const bleedAmount = effect.bleed ?? 0
    enemy = {
      ...enemy,
      status: { ...enemy.status, bleed: enemy.status.bleed + bleedAmount },
    }
    next = addLog({ ...next, enemy }, `  → ${sourceName} inflicts ${bleedAmount} Bleed.`)
  }

  return { ...next, enemy, lastCardPlayedId: 'companion' }
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
    const { damage: weakBurnTickDamage, doubled } = applyEnemyWeaknessMultiplier(enemy, b, 'burn')
    const controlledBonus = hasTrinket(s, TALENT_CONTROLLED_BURN) ? 1 : 0
    const pyromaniaDouble = hasTrinket(s, TALENT_PYROMANIA) && enemy.status.burn > 10
    let burnTickDamage = weakBurnTickDamage + controlledBonus
    if (pyromaniaDouble) burnTickDamage *= 2
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - burnTickDamage), status: { ...enemy.status, burn: b - 1 } }
    const weaknessNote = doubled ? ' (weakness exploited)' : ''
    const pyromaniaNote = pyromaniaDouble ? ' (Pyromania)' : ''
    s = addLog({ ...s, enemy }, `  → ${enemy.name} burns for ${burnTickDamage}${weaknessNote}${pyromaniaNote}.`)

    if (hasTrinket(s, TALENT_HOLY_FLAME) && burnTickDamage > 0) {
      const holyBonusDamage = Math.max(1, Math.floor(burnTickDamage * 0.2))
      enemy = { ...enemy, hp: Math.max(0, enemy.hp - holyBonusDamage) }
      s = addLog({ ...s, enemy }, `  → Holy Flame deals ${holyBonusDamage} Holy damage.`)
    }
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

  // Chill: if stacks reach 20% of max HP, enemy loses their turn this round
  if (enemy.status.chill > 0) {
    const freezeThreshold = Math.ceil(enemy.maxHp * 0.2)
    if (enemy.status.chill >= freezeThreshold) {
      enemy = { ...enemy, status: { ...enemy.status, chill: 0 } }
      s = addLog({ ...s, enemy }, `  → ${enemy.name} is frozen solid and loses their turn!`)
      // Skip resolveEnemyAction by going straight to player turn
      return beginNextPlayerTurn({ ...s, enemy })
    }
  }

  return { ...s, enemy }
}

export function resolveEnemyAction(state: GameState): GameState {
  if (state.phase !== 'enemy_turn') return state

  let s: GameState = { ...state, lastCardPlayedId: null }
  let { player, enemy } = s
  let actedId: GameState['lastCardPlayedId'] = null
  const chosenIntentIndex = Math.floor(Math.random() * enemy.pattern.length)
  const intent = enemy.pattern[chosenIntentIndex]

  if (intent.type === 'attack') {
    actedId = 'enemy_attack'
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
    actedId = 'enemy_cast'
    enemy = { ...enemy, block: enemy.block + intent.value }
    s = addLog(s, `  → Gains ${intent.value} block.`)
  } else if (intent.type === 'heal') {
    actedId = 'enemy_cast'
    const healed = Math.min(intent.value, enemy.maxHp - enemy.hp)
    enemy = { ...enemy, hp: enemy.hp + healed }
    s = addLog(s, `  → Heals for ${healed}.`)
  } else if (intent.type === 'upgrade') {
    actedId = 'enemy_cast'
    enemy = {
      ...enemy,
      armor: enemy.armor + intent.value,
      status: { ...enemy.status, strength: enemy.status.strength + 1 },
    }
    s = addLog(s, `  → Fortifies (+${intent.value} Armor, +1 Strength).`)
  } else if (intent.type === 'bleed') {
    actedId = 'enemy_cast'
    if (hasTrinket(s, TRINKET_WARDSTONE_SHARD) && !s.battleUsedTrinkets.includes(TRINKET_WARDSTONE_SHARD)) {
      s = { ...s, battleUsedTrinkets: [...s.battleUsedTrinkets, TRINKET_WARDSTONE_SHARD] }
      s = addLog(s, `  → Wardstone Shard absorbs the Bleed!`)
    } else {
      player = { ...player, status: { ...player.status, bleed: player.status.bleed + intent.value } }
      s = addLog(s, `  → Inflicts ${intent.value} Bleed.`)
    }
  } else if (intent.type === 'poison') {
    actedId = 'enemy_cast'
    if (hasTrinket(s, TRINKET_WARDSTONE_SHARD) && !s.battleUsedTrinkets.includes(TRINKET_WARDSTONE_SHARD)) {
      s = { ...s, battleUsedTrinkets: [...s.battleUsedTrinkets, TRINKET_WARDSTONE_SHARD] }
      s = addLog(s, `  → Wardstone Shard absorbs the Poison!`)
    } else {
      player = { ...player, status: { ...player.status, poison: player.status.poison + intent.value } }
      s = addLog(s, `  → Inflicts ${intent.value} Poison.`)
    }
  } else if (intent.type === 'burn') {
    actedId = 'enemy_cast'
    if (hasTrinket(s, TRINKET_WARDSTONE_SHARD) && !s.battleUsedTrinkets.includes(TRINKET_WARDSTONE_SHARD)) {
      s = { ...s, battleUsedTrinkets: [...s.battleUsedTrinkets, TRINKET_WARDSTONE_SHARD] }
      s = addLog(s, `  → Wardstone Shard absorbs the Burn!`)
    } else {
      player = { ...player, status: { ...player.status, burn: player.status.burn + intent.value } }
      s = addLog(s, `  → Inflicts ${intent.value} Burn.`)
    }
  } else if (intent.type === 'chill') {
    actedId = 'enemy_cast'
    if (hasTrinket(s, TRINKET_WARDSTONE_SHARD) && !s.battleUsedTrinkets.includes(TRINKET_WARDSTONE_SHARD)) {
      s = { ...s, battleUsedTrinkets: [...s.battleUsedTrinkets, TRINKET_WARDSTONE_SHARD] }
      s = addLog(s, `  → Wardstone Shard absorbs the Chill!`)
    } else {
      player = { ...player, status: { ...player.status, chill: (player.status.chill ?? 0) + intent.value } }
      s = addLog(s, `  → Inflicts ${intent.value} Chill.`)
    }
  } else if (intent.type === 'leech') {
    actedId = 'enemy_attack'
    const rawLeech = calcDamage(intent.value, enemy.status, player.status)
    const leechDmg = Math.max(0, rawLeech)
    player = applyDamage(player, leechDmg)
    enemy = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + leechDmg) }
    s = addLog(s, `  → Leeches for ${leechDmg} and heals self.`)
  } else if (intent.type === 'steal_gold') {
    actedId = 'enemy_attack'
    const rawSteal = calcDamage(intent.value, enemy.status, player.status)
    const stealDmg = Math.max(0, rawSteal)
    const stolen = Math.min(s.gold, intent.value)
    player = applyDamage(player, stealDmg)
    s = { ...s, gold: s.gold - stolen }
    s = addLog(s, `  → Attacks for ${stealDmg} and steals ${stolen} Gold.`)
  } else if (intent.type === 'random_damage') {
    actedId = 'enemy_attack'
    const dmgTypes = ['attack', 'burn', 'poison', 'bleed'] as const
    const picked = dmgTypes[Math.floor(Math.random() * dmgTypes.length)]
    const rawRnd = calcDamage(intent.value, enemy.status, player.status)
    const rndDmg = Math.max(0, rawRnd)
    if (picked === 'attack') {
      player = applyDamage(player, rndDmg)
      s = addLog(s, `  → Prismatic strike deals ${rndDmg} damage.`)
    } else if (picked === 'burn') {
      player = { ...player, status: { ...player.status, burn: player.status.burn + Math.ceil(rndDmg / 2) } }
      s = addLog(s, `  → Prismatic strike inflicts ${Math.ceil(rndDmg / 2)} Burn.`)
    } else if (picked === 'poison') {
      player = { ...player, status: { ...player.status, poison: player.status.poison + Math.ceil(rndDmg / 2) } }
      s = addLog(s, `  → Prismatic strike inflicts ${Math.ceil(rndDmg / 2)} Poison.`)
    } else {
      player = { ...player, status: { ...player.status, bleed: player.status.bleed + Math.ceil(rndDmg / 2) } }
      s = addLog(s, `  → Prismatic strike inflicts ${Math.ceil(rndDmg / 2)} Bleed.`)
    }
  }

  enemy = {
    ...enemy,
    patternIndex: chosenIntentIndex,
    status: tickStatus(enemy.status),
  }
  s = { ...s, player, enemy, lastCardPlayedId: actedId }

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
    const heatforgedReduction = hasTrinket(s, TRINKET_HEATFORGED_SHIELD) ? 1 : 0
    const avatarMultiplier = hasTrinket(s, TALENT_AVATAR_OF_FIRE) ? 0.5 : 1
    const actualBurnDmg = Math.max(0, Math.floor((b - heatforgedReduction) * avatarMultiplier))
    s = {
      ...s,
      player: {
        ...s.player,
        hp: Math.max(0, s.player.hp - actualBurnDmg),
        status: { ...s.player.status, burn: b - 1 },
      },
    }
    s = addLog(s, `  → You burn for ${actualBurnDmg}${heatforgedReduction > 0 ? ' (Heatforged Shield reduces 1)' : ''}.`)
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
  if (hasTrinket(s, TALENT_HOT_STREAK)) {
    s = drawOneBurnCard(s)
  }
  return applyTurnStartTrinkets(s)
}
