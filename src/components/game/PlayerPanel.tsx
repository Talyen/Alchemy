import { useState, useEffect, useRef, useCallback } from 'react'
import { useAnimationControls, motion, AnimatePresence } from 'framer-motion'
import { Bomb, Droplets, Flame, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Sword, Swords, TrendingDown } from 'lucide-react'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import { HeartBar } from './HeartBar'
import { DetailsPane } from './DetailsPane'
import { FloatingNumber, FloatingStatus } from './FloatingNumber'
import type { DmgEvent, StatusEvent } from './FloatingNumber'
import type { ActiveUpgrade, Fighter, TrinketDef } from '@/types'
import { playPlayerHit, playPlayerHeal, playBlock } from '@/sounds'

const COMPANION_SPRITE_SOURCE_BY_ENEMY_ID: Partial<Record<string, string>> = {
  greater_mimic: 'mimic',
  greater_slime: 'swampy',
}

function getCompanionFrames(enemyId: string): string[] {
  const spriteId = COMPANION_SPRITE_SOURCE_BY_ENEMY_ID[enemyId] ?? enemyId
  return Array.from({ length: 4 }, (_, i) => `assets/${spriteId}-idle-f${i}.png`)
}

interface Props {
  player: Fighter
  gold: number
  characterId: string
  characterName: string
  isActive: boolean
  lastCardPlayedId: string | null
  activeUpgrades: ActiveUpgrade[]
  trinkets?: TrinketDef[]
  showCompanion?: boolean
  companionName?: string
  companionEnemyId?: string
  companionAttackTick?: number
  playerAttackTick?: number
}

export function PlayerPanel({
  player,
  gold,
  characterId,
  characterName,
  isActive,
  lastCardPlayedId,
  activeUpgrades,
  trinkets = [],
  showCompanion = false,
  companionName = 'Companion',
  companionEnemyId = 'lizard_f',
  companionAttackTick = 0,
  playerAttackTick = 0,
}: Props) {
    const companionFrames = getCompanionFrames(companionEnemyId)
  const controls    = useAnimationControls()
  const companionControls = useAnimationControls()
  const prevHp      = useRef(player.hp)
  const prevBlock   = useRef(player.block)
  const prevGold    = useRef(gold)
  const nextId      = useRef(0)
  const nextLane    = useRef(0)
  const prevCompanionAttackTick = useRef(companionAttackTick)
  const prevPlayerAttackTick = useRef(playerAttackTick)
  const [dmgEvents,    setDmgEvents]    = useState<DmgEvent[]>([])
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([])
  const [hovered,      setHovered]      = useState(false)
  const [frameIdx,     setFrameIdx]     = useState(0)
  const characterFrames = getCharacterIdleFrames(characterId)
  const prevStatus = useRef({ burn: 0, vulnerable: 0, weak: 0, poison: 0, bleed: 0, trap: 0, forge: 0, strength: 0, armor: 0 })
  const allocLane = useCallback(() => {
    const lane = nextLane.current
    nextLane.current = (nextLane.current + 1) % 5
    return lane
  }, [])

  useEffect(() => {
    setFrameIdx(0)
  }, [characterId])

  const tick = useCallback(() => setFrameIdx(f => (f + 1) % characterFrames.length), [characterFrames.length])
  useEffect(() => {
    const id = setInterval(tick, 1000 / CHARACTER_IDLE_FPS)
    return () => clearInterval(id)
  }, [tick])

  useEffect(() => {
    if (!showCompanion) return
    if (companionAttackTick === prevCompanionAttackTick.current) return
    prevCompanionAttackTick.current = companionAttackTick
    void companionControls.start({
      x: [0, 20, -6, 0],
      y: [0, -2, 0],
      transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
    })
  }, [companionAttackTick, showCompanion, companionControls])

  useEffect(() => {
    if (!isActive) return
    if (playerAttackTick === prevPlayerAttackTick.current) return
    prevPlayerAttackTick.current = playerAttackTick
    void controls.start({
      x: [0, 30, -8, 0],
      y: [0, -2, 0],
      transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
    })
  }, [controls, isActive, playerAttackTick])

  useEffect(() => {
    if (gold > prevGold.current) {
      const diff = gold - prevGold.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'gold', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
    }
    prevGold.current = gold
  }, [gold, lastCardPlayedId, allocLane])

  useEffect(() => {
    if (player.hp < prevHp.current) {
      const diff = prevHp.current - player.hp
      controls.start({ x: [0, 12, -10, 5, 0], transition: { duration: 0.4, delay: 0.1 } })
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'damage', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
      playPlayerHit()
    } else if (player.hp > prevHp.current) {
      const diff = player.hp - prevHp.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'heal', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
      playPlayerHeal()
    }
    prevHp.current = player.hp
  }, [player.hp, controls, lastCardPlayedId, allocLane])

  useEffect(() => {
    if (player.block > prevBlock.current) {
      const diff = player.block - prevBlock.current
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'block', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
      playBlock()
    } else if (player.block < prevBlock.current) {
      const diff = player.block - prevBlock.current
      // negative value signals block lost
      setDmgEvents(e => [...e, { id: nextId.current++, value: diff, type: 'block', cardId: lastCardPlayedId ?? undefined, lane: allocLane() }])
    }
    prevBlock.current = player.block
  }, [player.block, lastCardPlayedId, allocLane])

  useEffect(() => {
    const { burn, vulnerable, weak, poison, bleed, trap, forge, strength } = player.status
    const armor = player.armor
    const prev  = prevStatus.current
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
  }, [player.status.burn, player.status.vulnerable, player.status.weak, player.status.poison, player.status.bleed, player.status.trap, player.status.forge, player.armor, lastCardPlayedId, allocLane])

  const removeDmgEvent = (id: number) =>
    setDmgEvents(e => e.filter(x => x.id !== id))

  const removeStatusEvent = (id: number) =>
    setStatusEvents(e => e.filter(x => x.id !== id))

  const { vulnerable, weak, poison, bleed, trap, forge, burn, strength } = player.status
  const hasIcons = player.armor > 0 || player.block > 0 || forge > 0 || strength > 0 || burn > 0 || poison > 0 || bleed > 0 || trap > 0 || vulnerable > 0 || weak > 0
  const activeDmgEvent = dmgEvents[0]
  const floatingTop = -22


  return (
    <motion.div
      animate={controls}
      className="relative flex flex-col items-center gap-6 w-44"
      data-testid="player-panel"
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
        <div className="flex items-end justify-center gap-2">
          {showCompanion && (
            <motion.div
              animate={companionControls}
              whileHover={{ y: -4 }}
              transition={{ filter: { duration: 0.45, ease: 'easeInOut' } }}
              style={{ transformOrigin: 'bottom center', filter: isActive ? 'grayscale(0%)' : 'grayscale(100%)' }}
            >
              <img
                src={companionFrames[frameIdx % companionFrames.length]}
                alt={`${companionName} companion`}
                style={{ width: 42, height: 60, imageRendering: 'pixelated', objectFit: 'contain' }}
              />
            </motion.div>
          )}

          <motion.div
            animate={{
              scale:  isActive ? 1 : 0.82,
              filter: isActive ? 'grayscale(0%)' : 'grayscale(100%)',
            }}
            whileHover={{ scale: 1.12, y: -10 }}
            transition={{
              scale:  { type: 'spring', stiffness: 260, damping: 24 },
              filter: { duration: 0.55, ease: 'easeInOut' },
            }}
            style={{ transformOrigin: 'bottom center' }}
          >
            <img
              src={characterFrames[frameIdx]}
              alt={characterName}
              style={{ width: 80, height: 140, imageRendering: 'pixelated', objectFit: 'contain' }}
            />
          </motion.div>
        </div>
      </div>

      {/* Details pane — left on hover */}
      <AnimatePresence>
        {hovered && (
          <DetailsPane
            title={characterName}
            hp={player.hp}
            maxHp={player.maxHp}
            block={player.block}
            armor={player.armor}
            forge={forge}
            vulnerable={vulnerable}
            weak={weak}
            burn={burn}
            poison={poison}
            bleed={bleed}
            trap={trap}
            side="left"
            hpColor="green"
            upgrades={activeUpgrades}
            trinkets={trinkets}
          />
        )}
      </AnimatePresence>

      {/* HP bar */}
      <div className="w-full" data-testid="hp-bar-player">
        <HeartBar current={player.hp} max={player.maxHp} color="green" block={player.block} />
      </div>

      {/* Buff / debuff icon indicators — reserve space below HP bar to avoid layout shifts */}
      <div className="h-4 w-full -mt-3 flex items-start justify-center">
        <AnimatePresence>
          {hasIcons && (
            <motion.div
              className="flex gap-1.5 justify-center flex-wrap"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              {player.armor > 0 && (
                <ShieldPlus size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {forge > 0 && (
                <Pickaxe size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {strength > 0 && (
                <Sword size={16} style={{ color: '#fbbf24', pointerEvents: 'none' }} />
              )}
              {player.block > 0 && (
                <ShieldHalf size={16} style={{ color: '#60a5fa', pointerEvents: 'none' }} />
              )}
              {vulnerable > 0 && (
                <ShieldOff size={16} style={{ color: '#f97316', pointerEvents: 'none' }} />
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
