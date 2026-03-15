import { useState, useEffect, useRef, useCallback } from 'react'
import { useAnimationControls, motion, AnimatePresence } from 'framer-motion'
import { Bomb, Droplets, Flame, Pickaxe, ShieldOff, ShieldPlus, Sword, Swords, TrendingDown } from 'lucide-react'
import { HeartBar } from './HeartBar'
import { DetailsPane } from './DetailsPane'
import { FloatingNumber, FloatingStatus } from './FloatingNumber'
import type { DmgEvent, StatusEvent } from './FloatingNumber'
import type { EnemyState } from '@/types'
import { playCardPlay, playEnemyHit, playEnemyAttack } from '@/sounds'
import { PRISMATIC_ENEMY_IDS, getEnemyRelativeScale } from './enemyVisualConfig'
import { ALL_CARDS } from '@/data'

const GOBLIN_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/goblin-idle-f${i}.png`)
const CHORT_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/chort-idle-f${i}.png`)
const IMP_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/imp-idle-f${i}.png`)
const MIMIC_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/mimic-idle-f${i}.png`)
const LIZARD_F_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/lizard_f-idle-f${i}.png`)
const LIZARD_M_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/lizard_m-idle-f${i}.png`)
const MASKED_ORC_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/masked_orc-idle-f${i}.png`)
const MUDDY_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/muddy-idle-f${i}.png`)
const NECROMANCER_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/necromancer-idle-f${i}.png`)
const ORC_SHAMAN_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/orc_shaman-idle-f${i}.png`)
const ORC_WARRIOR_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/orc_warrior-idle-f${i}.png`)
const SKELET_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/skelet-idle-f${i}.png`)
const SLUG_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/slug-idle-f${i}.png`)
const SWAMPY_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/swampy-idle-f${i}.png`)
const DOC_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/doc-idle-f${i}.png`)
const BIG_DEMON_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/big_demon-idle-f${i}.png`)
const OGRE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/ogre-idle-f${i}.png`)
const FLAMING_SKULL_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/flaming_skull-idle-f${i}.png`)
const SHADE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/shade-idle-f${i}.png`)
const SNAKE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/snake-idle-f${i}.png`)

const ENEMY_FRAME_SETS: Record<string, string[]> = {
  goblin: GOBLIN_FRAMES,
  chort: CHORT_FRAMES,
  imp: IMP_FRAMES,
  frost_imp: IMP_FRAMES,
  blood_goblin: GOBLIN_FRAMES,
  blood_shaman: ORC_SHAMAN_FRAMES,
  mimic: MIMIC_FRAMES,
  lizard_f: LIZARD_F_FRAMES,
  lizard_m: LIZARD_M_FRAMES,
  masked_orc: MASKED_ORC_FRAMES,
  muddy: MUDDY_FRAMES,
  necromancer: NECROMANCER_FRAMES,
  orc_shaman: ORC_SHAMAN_FRAMES,
  orc_warrior: ORC_WARRIOR_FRAMES,
  skelet: SKELET_FRAMES,
  slug: SLUG_FRAMES,
  swampy: SWAMPY_FRAMES,
  doc: DOC_FRAMES,
  big_demon: BIG_DEMON_FRAMES,
  ogre: OGRE_FRAMES,
  greater_mimic: MIMIC_FRAMES,
  greater_slime: SWAMPY_FRAMES,
  flaming_skull: FLAMING_SKULL_FRAMES,
  prismatic_skull: FLAMING_SKULL_FRAMES,
  shade: SHADE_FRAMES,
  mirror_shade: SHADE_FRAMES,
  prismatic_shade: SHADE_FRAMES,
  snake: SNAKE_FRAMES,
  prismatic_slug: SLUG_FRAMES,
  prismatic_greater_mimic: MIMIC_FRAMES,
  prismatic_greater_slime: SWAMPY_FRAMES,
}
const GOBLIN_FPS = 8
const ELITE_ENEMY_IDS = new Set(['big_demon', 'ogre', 'greater_mimic', 'greater_slime', 'flaming_skull', 'shade', 'prismatic_skull', 'prismatic_shade', 'prismatic_greater_mimic', 'prismatic_greater_slime'])
const ENEMY_TINT_FILTER_BY_ID: Partial<Record<string, string>> = {
  frost_imp: 'hue-rotate(165deg) saturate(1.3) brightness(1.08)',
  blood_goblin: 'hue-rotate(325deg) saturate(3.1) brightness(0.92)',
  blood_shaman: 'hue-rotate(338deg) saturate(1.55) brightness(1.03)',
  mirror_shade: 'saturate(0.28) brightness(1.28) contrast(1.18)',
  prismatic_slug: 'hue-rotate(220deg) saturate(2.2) brightness(1.08)',
  prismatic_skull: 'hue-rotate(255deg) saturate(2.1) brightness(1.1)',
  prismatic_shade: 'hue-rotate(285deg) saturate(2.3) brightness(1.12)',
  prismatic_greater_mimic: 'hue-rotate(240deg) saturate(2.0) brightness(1.08)',
  prismatic_greater_slime: 'hue-rotate(205deg) saturate(2.25) brightness(1.05)',
}

const PRISMATIC_FILTER_KEYFRAMES = [
  'hue-rotate(0deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(90deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(180deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(270deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(360deg) saturate(2.15) brightness(1.06)',
]

interface Props {
  enemy: EnemyState
  isActing: boolean
  isActive: boolean
  lastCardPlayedId: string | null
  isEliteEncounter?: boolean
  compact?: boolean
}

const ATTACK_CARD_IDS = new Set(
  ALL_CARDS
    .filter(card => (card.effect.damage ?? 0) > 0 || (card.effect.burn ?? 0) > 0 || (card.effect.poison ?? 0) > 0 || (card.effect.bleed ?? 0) > 0 || (card.effect.chill ?? 0) > 0)
    .map(card => card.id),
)

export function EnemyPanel({ enemy, isActing, isActive, lastCardPlayedId, isEliteEncounter = false, compact = false }: Props) {
  const enemyFrames = ENEMY_FRAME_SETS[enemy.id] ?? GOBLIN_FRAMES
  const isEliteEnemy = isEliteEncounter || ELITE_ENEMY_IDS.has(enemy.id)
  const eliteEncounterScale = isEliteEncounter ? 1.25 : 1
  const spriteScale = getEnemyRelativeScale(enemy.id) * eliteEncounterScale
  const inactiveScale = isActive ? spriteScale : spriteScale * 0.82
  const hoverScale = isEliteEnemy ? spriteScale * 1.04 : spriteScale * 1.12
  const facingScaleX = -1
  const isPrismatic = PRISMATIC_ENEMY_IDS.has(enemy.id)
  const spriteTintFilter = ENEMY_TINT_FILTER_BY_ID[enemy.id] ?? 'none'
  type QueueEntry = { kind: 'dmg'; data: DmgEvent } | { kind: 'status'; data: StatusEvent }
  const MAX_QUEUE = 5
  const controls    = useAnimationControls()
  const prevHp      = useRef(enemy.hp)
  const prevBlock   = useRef(enemy.block)
  const nextId         = useRef(0)
  const nextLane       = useRef(0)
  const [eventQueue, setEventQueue] = useState<QueueEntry[]>([])
  const prevStatus = useRef({ burn: 0, vulnerable: 0, weak: 0, poison: 0, bleed: 0, chill: 0, trap: 0, forge: 0, strength: 0, armor: 0 })
  const prevLastCardPlayedId = useRef(lastCardPlayedId)
  const [hovered,   setHovered]   = useState(false)
  const [frameIdx,  setFrameIdx]  = useState(0)
  const allocLane = useCallback(() => {
    const lane = nextLane.current
    nextLane.current = (nextLane.current + 1) % 5
    return lane
  }, [])
  const pushQueue = useCallback((entries: QueueEntry[]) => {
    setEventQueue(prev => {
      const combined = [...prev, ...entries]
      return combined.length > MAX_QUEUE ? combined.slice(combined.length - MAX_QUEUE) : combined
    })
  }, [])
  const popQueue = useCallback(() => setEventQueue(prev => prev.slice(1)), [])

  const tick = useCallback(() => setFrameIdx(f => (f + 1) % enemyFrames.length), [enemyFrames.length])
  useEffect(() => {
    setFrameIdx(0)
  }, [enemy.id])

  useEffect(() => {
    const id = setInterval(tick, 1000 / GOBLIN_FPS)
    return () => clearInterval(id)
  }, [tick])

  useEffect(() => {
    const entries: QueueEntry[] = []
    if (enemy.hp < prevHp.current) {
      const diff = prevHp.current - enemy.hp
      // Detect damage kind from simultaneous status changes (status effect hasn't updated prevStatus yet)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      let dmgType: DmgEvent['type'] = 'damage'
      if (enemy.status.burn > prevStatus.current.burn) dmgType = 'burn_damage'
      else if (enemy.status.poison > prevStatus.current.poison) dmgType = 'poison_damage'
      else if (enemy.status.bleed > prevStatus.current.bleed) dmgType = 'bleed_damage'
      else if ((enemy.status.chill ?? 0) > ((prevStatus.current as { chill?: number }).chill ?? 0)) dmgType = 'chill_damage'
      void controls.start({ x: [0, -10, 8, -4, 0], transition: { duration: 0.35 } })
      entries.push({ kind: 'dmg', data: { id: nextId.current++, value: diff, type: dmgType, cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
      playEnemyHit()
    } else if (enemy.hp > prevHp.current) {
      const diff = enemy.hp - prevHp.current
      entries.push({ kind: 'dmg', data: { id: nextId.current++, value: diff, type: 'heal', cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    } else if (lastCardPlayedId && prevLastCardPlayedId.current !== lastCardPlayedId && ATTACK_CARD_IDS.has(lastCardPlayedId)) {
      entries.push({ kind: 'dmg', data: { id: nextId.current++, value: 0, type: 'damage', cardId: lastCardPlayedId, lane: allocLane() } })
    }
    prevLastCardPlayedId.current = lastCardPlayedId
    prevHp.current = enemy.hp
    if (entries.length) pushQueue(entries)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemy.hp, controls, lastCardPlayedId, allocLane, pushQueue])

  useEffect(() => {
    if (!isActing) return
    if (lastCardPlayedId === 'enemy_attack') {
      void controls.start({
        x: [0, -36, 10, 0],
        y: [0, -2, 0],
        transition: { duration: 0.56, ease: [0.22, 1, 0.36, 1] },
      })
      playEnemyAttack()
      return
    }

    if (lastCardPlayedId === 'enemy_cast') {
      void controls.start({
        scale: [1, 1.08, 1],
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
      })
      playCardPlay('defend', 'skill')
    }
  }, [controls, isActing, lastCardPlayedId])


  useEffect(() => {
    const entries: QueueEntry[] = []
    if (enemy.block !== prevBlock.current) {
      const diff = enemy.block - prevBlock.current
      entries.push({ kind: 'dmg', data: { id: nextId.current++, value: diff, type: 'block', cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    }
    prevBlock.current = enemy.block
    if (entries.length) pushQueue(entries)
  }, [enemy.block, lastCardPlayedId, allocLane, pushQueue])

  useEffect(() => {
    const { burn, vulnerable, weak, poison, bleed, chill, trap, forge, strength } = enemy.status
    const armor = enemy.armor
    const prev = prevStatus.current
    const entries: QueueEntry[] = []
    if (burn > prev.burn)             entries.push({ kind: 'status', data: { id: nextId.current++, value: burn - prev.burn,             status: 'burn',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (vulnerable > prev.vulnerable) entries.push({ kind: 'status', data: { id: nextId.current++, value: vulnerable - prev.vulnerable, status: 'vulnerable', cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (weak > prev.weak)             entries.push({ kind: 'status', data: { id: nextId.current++, value: weak - prev.weak,             status: 'weak',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (poison > prev.poison)         entries.push({ kind: 'status', data: { id: nextId.current++, value: poison - prev.poison,         status: 'poison',     cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (bleed > prev.bleed)           entries.push({ kind: 'status', data: { id: nextId.current++, value: bleed - prev.bleed,           status: 'bleed',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (trap > prev.trap)             entries.push({ kind: 'status', data: { id: nextId.current++, value: trap - prev.trap,             status: 'trap',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (forge > prev.forge)           entries.push({ kind: 'status', data: { id: nextId.current++, value: forge - prev.forge,           status: 'forge',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (strength > prev.strength)     entries.push({ kind: 'status', data: { id: nextId.current++, value: strength - prev.strength,     status: 'strength',   cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    if (armor > prev.armor)           entries.push({ kind: 'status', data: { id: nextId.current++, value: armor - prev.armor,           status: 'armor',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() } })
    prevStatus.current = { burn, vulnerable, weak, poison, bleed, chill, trap, forge, strength, armor }
    if (entries.length) pushQueue(entries)
  }, [enemy.status.burn, enemy.status.vulnerable, enemy.status.weak, enemy.status.poison, enemy.status.bleed, enemy.status.chill, enemy.status.trap, enemy.status.forge, enemy.status.strength, enemy.armor, lastCardPlayedId, allocLane, pushQueue])

  const { vulnerable, weak, burn, poison, bleed, trap, forge, strength } = enemy.status
  const hasStatus = enemy.armor > 0 || forge > 0 || strength > 0 || vulnerable > 0 || weak > 0 || burn > 0 || poison > 0 || bleed > 0 || trap > 0
  const weaknessLabels = enemy.weaknesses.map(weakness => {
    if (weakness === 'blunt') return 'Blunt Damage'
    if (weakness === 'burn') return 'Burn Damage'
    return weakness
  })
  const activeEvent = eventQueue[0] ?? null
  const floatingTop = -22 - Math.max(0, spriteScale - 1) * 26

  return (
    <motion.div
      className={`relative flex flex-col items-center ${compact ? 'w-36 gap-3' : 'w-44 gap-6'}`}
      data-testid="enemy-panel"
      animate={controls}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >


      {/* Unified floating event queue — one at a time, no overlap */}
      <AnimatePresence mode="wait">
        {activeEvent ? (
          activeEvent.kind === 'dmg' ? (
            <FloatingNumber key={activeEvent.data.id} event={activeEvent.data} top={floatingTop} onDone={popQueue} />
          ) : (
            <FloatingStatus key={activeEvent.data.id} event={activeEvent.data} top={floatingTop} onDone={popQueue} />
          )
        ) : null}
      </AnimatePresence>

      {/* Fixed-height sprite well */}
      <div className={`${compact ? 'h-28' : 'h-40'} flex items-end justify-center`}>
        <motion.div
          animate={{ scaleX: facingScaleX, scale: inactiveScale, y: 0 }}
          whileHover={{ scaleX: facingScaleX, scale: hoverScale, y: -8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <motion.img
            src={enemyFrames[frameIdx]}
            alt={enemy.name}
            animate={isPrismatic ? { filter: PRISMATIC_FILTER_KEYFRAMES } : undefined}
            transition={isPrismatic ? { filter: { duration: 3.2, repeat: Infinity, ease: 'linear' } } : undefined}
            style={{
              width: compact ? 64 : 80,
              height: compact ? 64 : 80,
              imageRendering: 'pixelated',
              objectFit: 'contain',
              filter: isPrismatic ? PRISMATIC_FILTER_KEYFRAMES[0] : spriteTintFilter,
            }}
          />
        </motion.div>
      </div>

      {/* Details pane — right on hover */}
      <AnimatePresence>
        {hovered && (
          <DetailsPane
            title={enemy.name}
            hp={enemy.hp}
            maxHp={enemy.maxHp}
            block={enemy.block}
            vulnerable={vulnerable}
            weak={weak}
            burn={burn}
            poison={poison}
            bleed={bleed}
            weaknesses={weaknessLabels}
            side="right"
            hpColor="red"
          />
        )}
      </AnimatePresence>

      {/* HP bar */}
      <div className="w-full" data-testid="hp-bar-enemy">
        <HeartBar current={enemy.hp} max={enemy.maxHp} color="red" block={enemy.block} />
      </div>

      {/* Status icon indicators — reserve space below HP bar to avoid layout shifts */}
      <div className="h-4 w-full -mt-3 flex items-start justify-center">
        <AnimatePresence>
          {hasStatus && (
            <motion.div
              className="flex gap-1.5 justify-center"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              {vulnerable > 0 && (
                <ShieldOff size={16} style={{ color: '#f97316', pointerEvents: 'none' }} />
              )}
              {enemy.armor > 0 && (
                <ShieldPlus size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {forge > 0 && (
                <Pickaxe size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {strength > 0 && (
                <Sword size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {weak > 0 && (
                <TrendingDown size={16} style={{ color: '#a1a1aa', pointerEvents: 'none' }} />
              )}
              {burn > 0 && (
                <Flame size={16} style={{ color: '#f97316', pointerEvents: 'none' }} />
              )}
              {poison > 0 && (
                <Droplets size={16} style={{ color: '#4ade80', pointerEvents: 'none' }} />
              )}
              {bleed > 0 && (
                <Swords size={16} style={{ color: '#f87171', pointerEvents: 'none' }} />
              )}
              {trap > 0 && (
                <Bomb size={16} style={{ color: '#f59e0b', pointerEvents: 'none' }} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
