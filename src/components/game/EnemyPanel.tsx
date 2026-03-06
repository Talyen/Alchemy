import { useState, useEffect, useRef, useCallback } from 'react'
import { useAnimationControls, motion, AnimatePresence } from 'framer-motion'
import { Bomb, Droplets, Flame, Pickaxe, ShieldOff, ShieldPlus, Sword, Swords, TrendingDown } from 'lucide-react'
import { HeartBar } from './HeartBar'
import { DetailsPane } from './DetailsPane'
import { FloatingNumber, FloatingStatus } from './FloatingNumber'
import type { DmgEvent, StatusEvent } from './FloatingNumber'
import type { EnemyState } from '@/types'
import { playCardPlay, playEnemyHit, playEnemyAttack } from '@/sounds'
import { getEnemyRelativeScale } from './enemyVisualConfig'

const GOBLIN_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/goblin-idle-f${i}.png`)
const CHORT_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/chort-idle-f${i}.png`)
const IMP_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/imp-idle-f${i}.png`)
const MIMIC_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/mimic-idle-f${i}.png`)
const LIZARD_F_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/lizard_f-idle-f${i}.png`)
const LIZARD_M_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/lizard_m-idle-f${i}.png`)
const MASKED_ORC_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/masked_orc-idle-f${i}.png`)
const MUDDY_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/muddy-idle-f${i}.png`)
const NECROMANCER_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/necromancer-idle-f${i}.png`)
const ORC_SHAMAN_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/orc_shaman-idle-f${i}.png`)
const ORC_WARRIOR_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/orc_warrior-idle-f${i}.png`)
const SKELET_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/skelet-idle-f${i}.png`)
const SLUG_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/slug-idle-f${i}.png`)
const SWAMPY_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/swampy-idle-f${i}.png`)
const DOC_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/doc-idle-f${i}.png`)
const BIG_DEMON_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/big_demon-idle-f${i}.png`)
const OGRE_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/ogre-idle-f${i}.png`)
const FLYTRAP_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/flytrap-idle-f${i}.png`)
const FLAMING_SKULL_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/flaming_skull-idle-f${i}.png`)
const SHADE_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/shade-idle-f${i}.png`)
const SNAKE_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/snake-idle-f${i}.png`)

const ENEMY_FRAME_SETS: Record<string, string[]> = {
  goblin: GOBLIN_FRAMES,
  chort: CHORT_FRAMES,
  imp: IMP_FRAMES,
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
  flytrap: FLYTRAP_FRAMES,
  flaming_skull: FLAMING_SKULL_FRAMES,
  shade: SHADE_FRAMES,
  snake: SNAKE_FRAMES,
}
const GOBLIN_FPS = 8
const ELITE_ENEMY_IDS = new Set(['big_demon', 'ogre', 'greater_mimic', 'greater_slime', 'flaming_skull', 'shade'])
const LEFT_FACING_ENEMY_IDS = new Set([
  'doc',
  'big_demon',
  'flytrap',
  'flaming_skull',
  'shade',
  'snake',
  'greater_slime',
])

interface Props {
  enemy: EnemyState
  isActing: boolean
  isActive: boolean
  lastCardPlayedId: string | null
  isEliteEncounter?: boolean
}

export function EnemyPanel({ enemy, isActing, isActive, lastCardPlayedId, isEliteEncounter = false }: Props) {
  const enemyFrames = ENEMY_FRAME_SETS[enemy.id] ?? GOBLIN_FRAMES
  const isEliteEnemy = isEliteEncounter || ELITE_ENEMY_IDS.has(enemy.id)
  const eliteEncounterScale = isEliteEncounter ? 2 : 1
  const spriteScale = getEnemyRelativeScale(enemy.id) * eliteEncounterScale
  const inactiveScale = isActive ? spriteScale : spriteScale * 0.82
  const hoverScale = isEliteEnemy ? spriteScale * 1.04 : spriteScale * 1.12
  const facingScaleX = LEFT_FACING_ENEMY_IDS.has(enemy.id) ? 1 : -1
  const controls    = useAnimationControls()
  const prevHp      = useRef(enemy.hp)
  const prevBlock   = useRef(enemy.block)
  const nextId         = useRef(0)
  const nextLane       = useRef(0)
  const [dmgEvents,    setDmgEvents]    = useState<DmgEvent[]>([])
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([])
  const prevStatus = useRef({ burn: 0, vulnerable: 0, weak: 0, poison: 0, bleed: 0, trap: 0, forge: 0, strength: 0, armor: 0 })
  const [hovered,   setHovered]   = useState(false)
  const [frameIdx,  setFrameIdx]  = useState(0)
  const allocLane = useCallback(() => {
    const lane = nextLane.current
    nextLane.current = (nextLane.current + 1) % 5
    return lane
  }, [])

  const tick = useCallback(() => setFrameIdx(f => (f + 1) % enemyFrames.length), [enemyFrames.length])
  useEffect(() => {
    setFrameIdx(0)
  }, [enemy.id])

  useEffect(() => {
    const id = setInterval(tick, 1000 / GOBLIN_FPS)
    return () => clearInterval(id)
  }, [tick])

  useEffect(() => {
    if (enemy.hp < prevHp.current) {
      const diff = prevHp.current - enemy.hp
      controls.start({ x: [0, -10, 8, -4, 0], transition: { duration: 0.35 } })
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'damage', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
      playEnemyHit()
    } else if (enemy.hp > prevHp.current) {
      const diff = enemy.hp - prevHp.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'heal', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
    }
    prevHp.current = enemy.hp
  }, [enemy.hp, controls, lastCardPlayedId, allocLane])

  useEffect(() => {
    if (isActing) {
      const currentIntent = enemy.pattern[enemy.patternIndex]
      if (currentIntent?.type === 'attack') {
        controls.start({
          x: [0, -36, 10, 0],
          y: [0, -2, 0],
          transition: { duration: 0.56, ease: [0.22, 1, 0.36, 1] },
        })
        playEnemyAttack()
      } else if (currentIntent) {
        void controls.start({
          scale: [1, 1.1, 1],
          transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        })
        if (currentIntent.type === 'defend') {
          playCardPlay('defend', 'skill')
        } else {
          playCardPlay('heal', 'heal')
        }
      }
    }
  }, [isActing, controls, enemy.patternIndex, enemy.pattern])


  useEffect(() => {
    if (enemy.block > prevBlock.current) {
      const diff = enemy.block - prevBlock.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'block', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
    } else if (enemy.block < prevBlock.current) {
      const diff = enemy.block - prevBlock.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'block', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
    }
    prevBlock.current = enemy.block
  }, [enemy.block, lastCardPlayedId, allocLane])

  useEffect(() => {
    const { burn, vulnerable, weak, poison, bleed, trap, forge, strength } = enemy.status
    const armor = enemy.armor
    const prev = prevStatus.current
    const newEvents: StatusEvent[] = []
    if (burn > prev.burn)             newEvents.push({ id: nextId.current++, value: burn - prev.burn,             status: 'burn',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (vulnerable > prev.vulnerable) newEvents.push({ id: nextId.current++, value: vulnerable - prev.vulnerable, status: 'vulnerable', cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (weak > prev.weak)             newEvents.push({ id: nextId.current++, value: weak - prev.weak,             status: 'weak',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (poison > prev.poison)         newEvents.push({ id: nextId.current++, value: poison - prev.poison,         status: 'poison',     cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (bleed > prev.bleed)           newEvents.push({ id: nextId.current++, value: bleed - prev.bleed,           status: 'bleed',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (trap > prev.trap)             newEvents.push({ id: nextId.current++, value: trap - prev.trap,             status: 'trap',       cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (forge > prev.forge)           newEvents.push({ id: nextId.current++, value: forge - prev.forge,           status: 'forge',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (strength > prev.strength)     newEvents.push({ id: nextId.current++, value: strength - prev.strength,     status: 'strength',   cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    if (armor > prev.armor)           newEvents.push({ id: nextId.current++, value: armor - prev.armor,           status: 'armor',      cardId: lastCardPlayedId ?? undefined, lane: allocLane() })
    prevStatus.current = { burn, vulnerable, weak, poison, bleed, trap, forge, strength, armor }
    if (newEvents.length) setStatusEvents(e => [...e, ...newEvents])
  }, [enemy.status.burn, enemy.status.vulnerable, enemy.status.weak, enemy.status.poison, enemy.status.bleed, enemy.status.trap, enemy.status.forge, enemy.status.strength, enemy.armor, lastCardPlayedId, allocLane])

  const removeDmgEvent = (id: number) =>
    setDmgEvents(e => e.filter(x => x.id !== id))

  const removeStatusEvent = (id: number) =>
    setStatusEvents(e => e.filter(x => x.id !== id))

  const { vulnerable, weak, burn, poison, bleed, trap, forge, strength } = enemy.status
  const hasStatus = enemy.armor > 0 || forge > 0 || strength > 0 || vulnerable > 0 || weak > 0 || burn > 0 || poison > 0 || bleed > 0 || trap > 0
  const activeDmgEvent = dmgEvents[0]
  const floatingTop = -22 - Math.max(0, spriteScale - 1) * 26

  return (
    <motion.div
      className="relative flex flex-col items-center gap-6 w-44"
      animate={controls}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >


      {/* Floating damage / block numbers */}
      <AnimatePresence mode="wait">
        {activeDmgEvent && (
          <FloatingNumber
            key={activeDmgEvent.id}
            event={activeDmgEvent}
            top={floatingTop}
            onDone={() => removeDmgEvent(activeDmgEvent.id)}
          />
        )}
      </AnimatePresence>

      {/* Floating status effect icons */}
      <AnimatePresence>
        {statusEvents.map(e => (
          <FloatingStatus key={e.id} event={e} top={floatingTop} onDone={() => removeStatusEvent(e.id)} />
        ))}
      </AnimatePresence>

      {/* Fixed-height sprite well */}
      <div className="h-40 flex items-end justify-center">
        <motion.div
          animate={{ scaleX: facingScaleX, scale: inactiveScale, y: 0 }}
          whileHover={{ scaleX: facingScaleX, scale: hoverScale, y: -8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <img
            src={enemyFrames[frameIdx]}
            alt={enemy.name}
            style={{ width: 80, height: 80, imageRendering: 'pixelated', objectFit: 'contain' }}
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
