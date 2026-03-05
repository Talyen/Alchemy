import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useSpring } from 'framer-motion'
import { CircleDollarSign, Diamond, Layers, ScrollText, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { FloatingNumber } from './FloatingNumber'
import type { CardInstance } from '@/types'
import type { DmgEvent } from './FloatingNumber'
import { useTilt } from '@/lib/useTilt'
import { playCardPlay, preloadSound } from '@/sounds'

interface Props {
  cards: CardInstance[]
  mana: number
  maxMana: number
  gold: number
  onPlay: (uid: string) => void
  disabled: boolean
  isEnemyActing: boolean
  drawCount: number
  discardCount: number
  log: string[]
  lastCardPlayedId: string | null
}

// Determine which side of the board a card targets
function getCardTarget(card: CardInstance): 'enemy' | 'player' | 'both' | 'neither' {
  const targetEnemy = card.effect.damage || card.effect.burn || card.effect.poison || card.effect.bleed || card.effect.vulnerable || card.effect.weak
  const targetPlayer = card.effect.mana || card.effect.block || card.effect.armor || card.effect.heal || card.effect.forge || card.effect.leech || card.effect.selfBurn || card.effect.gold || card.effect.manaCrystal || card.effect.haste || card.effect.cleanse || card.effect.trap || card.effect.wish
  
  if (targetEnemy && targetPlayer) return 'both'
  if (targetEnemy) return 'enemy'
  if (targetPlayer) return 'player'
  return 'neither'
}

// ─── Mana orbs ───────────────────────────────────────────────────────────────

function ManaOrbs({ current, max }: { current: number; max: number }) {
  const displayCount = Math.max(current, max)
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: displayCount }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: i < current ? 1 : 0.2 }}
          transition={{ duration: 0.2 }}
          style={{ pointerEvents: 'none', display: 'flex' }}
        >
          <Diamond size={18} fill="#2563eb" color="transparent" strokeWidth={0} style={{ pointerEvents: 'none' }} />
        </motion.div>
      ))}
    </div>
  )
}

function GoldCounter({ gold }: { gold: number }) {
  return (
    <motion.div
      className="flex items-center gap-1 text-amber-400"
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <CircleDollarSign size={16} style={{ pointerEvents: 'none' }} />
      <span className="text-xs uppercase tracking-widest">{gold} Gold</span>
    </motion.div>
  )
}

// ─── Combat log panel ────────────────────────────────────────────────────────

function CombatLog({ log }: { log: string[] }) {
  return (
    <motion.div
      className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1 z-40"
      initial={{ opacity: 0, y: 5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.97, transition: { duration: 0.1, ease: 'easeIn' } }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Combat Log</p>
      {[...log].reverse().map((line, i) => (
        <p key={i} className="text-[11px] text-zinc-400 leading-snug">{line}</p>
      ))}
    </motion.div>
  )
}

// ─── Flanking pile components ────────────────────────────────────────────────

function PileStack({ count, label, icon: Icon }: { count: number; label: string; icon: typeof Layers }) {
  const { tiltStyle, onMouseMove, onMouseLeave } = useTilt(8, 600)
  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 shrink-0"
      style={tiltStyle}
      whileHover={{ scale: 1.06 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Stacked card backs */}
      <div className="relative w-16 h-24">
        <div
          className="absolute inset-0 rounded-xl bg-zinc-900 border border-zinc-700/60"
          style={{ transform: 'rotate(-4deg)', transformOrigin: 'bottom center' }}
        />
        <div
          className="absolute inset-0 rounded-xl bg-zinc-900 border border-zinc-700/60"
          style={{ transform: 'rotate(-2deg)', transformOrigin: 'bottom center' }}
        />
        <div className="absolute inset-0 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
          <span className="text-xl font-bold text-zinc-400 font-mono">{count}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-zinc-600">
        <Icon size={12} />
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
    </motion.div>
  )
}

// ─── Draggable card wrapper ───────────────────────────────────────────────────
// Extracted as a component so it can use hooks (useSpring, useState) per card.

interface DraggableCardProps {
  card: CardInstance
  i: number
  mid: number
  anglePerCard: number
  overlapPx: number
  elevated: Set<string>
  raise: (uid: string) => void
  lower: (uid: string) => void
  playable: boolean
  disabled: boolean
  onPlay: (uid: string) => void
}

function DraggableCard({
  card, i, mid, anglePerCard, overlapPx, elevated, raise, lower,
  playable, disabled, onPlay,
}: DraggableCardProps) {
  const offset = i - mid
  const rotate = offset * anglePerCard
  const yDip   = offset * offset * 3
  const zBase  = i + 1
  const target = getCardTarget(card)
  // Calculate exit x based on target direction
  let exitX = 0
  if (target === 'enemy') exitX = 120
  else if (target === 'player') exitX = -120
  // For 'both' and 'neither', exitX stays 0 (straight up)

  const exitVariants = {
    exit: (enemyTurnDiscard: boolean) => (
      enemyTurnDiscard
        ? {
            opacity: 0,
            y: 84,
            x: 220,
            scale: 0.35,
            rotate: -18,
            transition: { duration: 0.32, ease: [0.4, 0, 1, 1] as const, delay: i * 0.05 },
          }
        : {
            opacity: 0,
            y: -140,
            x: exitX,
            scale: 0.5,
            rotate: exitX !== 0 ? (exitX > 0 ? 8 : -8) : 2,
            transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as const },
          }
    ),
  }

  // Track dragging for the periodic sheen effect in Card
  const [isDragging, setIsDragging] = useState(false)

  // Velocity-driven tilt during drag — springs back to 0 on release
  const dragTiltX = useSpring(0, { stiffness: 250, damping: 18 })
  const dragTiltY = useSpring(0, { stiffness: 250, damping: 18 })

  return (
    <motion.div
      className="relative"
      style={{
        marginLeft: i === 0 ? 0 : -overlapPx,
        zIndex: elevated.has(card.uid) ? 100 : zBase,
        rotateX: dragTiltX,
        rotateY: dragTiltY,
        transformPerspective: 800,
      }}
      // start off-screen near the deck, then spring into the hand with a small stagger
      initial={{ opacity: 0, x: -240, y: 100, scale: 0.75, rotate }}
      animate={{
        opacity: 1,
        x: 0,
        y: yDip,
        scale: 1,
        rotate,
        transition: { type: 'spring', stiffness: 150, damping: 20, delay: i * 0.08 }
      }}
      variants={exitVariants}
      exit="exit"
      whileHover={!disabled ? {
        y: yDip - 56,
        rotate: 0,
        transition: { type: 'spring', stiffness: 220, damping: 28 },
      } : {}}
      onHoverStart={() => {
        raise(card.uid)
        preloadSound(card.id, card.type)
      }}
      onHoverEnd={() => lower(card.uid)}
      onClick={() => { if (playable) { playCardPlay(card.id, card.type); onPlay(card.uid) } }}
      transition={{ type: 'spring', stiffness: 220, damping: 28, delay: i * 0.06 }}
      // ── Click or drag to play ──
      drag={playable}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        raise(card.uid)
        setIsDragging(true)
      }}
      onDrag={(_, info) => {
        // Subtle tilt based on drag velocity
        dragTiltX.set(Math.min(Math.max(info.velocity.y * 0.015, -12), 12))
        dragTiltY.set(Math.min(Math.max(info.velocity.x * 0.015, -12), 12))
      }}
      onDragEnd={(_, info) => {
        dragTiltX.set(0)
        dragTiltY.set(0)
        setIsDragging(false)
        lower(card.uid)
        const isClearlyInBattleArea = info.point.y < window.innerHeight * 0.66
        // Play only if dragged high enough and released in the upper battle area.
        if (playable && info.offset.y < -130 && isClearlyInBattleArea) {
          onPlay(card.uid)
        }
      }}
    >
      <Card
        card={card}
        playable={playable}
        isBeingDragged={isDragging}
      />
    </motion.div>
  )
}

// ─── Hand ────────────────────────────────────────────────────────────────────

export function Hand({ cards, mana, maxMana, gold, onPlay, disabled, isEnemyActing, drawCount, discardCount, log, lastCardPlayedId }: Props) {
  const [elevated, setElevated] = useState<Set<string>>(new Set())
  const [showLog, setShowLog]   = useState(false)
  const [manaEvents, setManaEvents] = useState<DmgEvent[]>([])
  const prevMana = useRef(mana)
  const nextManaEventId = useRef(0)

  useEffect(() => {
    if (mana > prevMana.current) {
      const diff = mana - prevMana.current
      setManaEvents(events => [
        ...events,
        { id: nextManaEventId.current++, value: diff, type: 'mana', cardId: lastCardPlayedId ?? undefined },
      ])
    }
    prevMana.current = mana
  }, [mana, lastCardPlayedId])

  const removeManaEvent = (id: number) => {
    setManaEvents(events => events.filter(event => event.id !== id))
  }

  const raise = (uid: string) =>
    setElevated(prev => new Set([...prev, uid]))

  const lower = (uid: string) =>
    setElevated(prev => { const n = new Set(prev); n.delete(uid); return n })

  const mid = (cards.length - 1) / 2
  const anglePerCard = cards.length <= 1 ? 0 : Math.min(8, 24 / (cards.length - 1))
  const overlapPx = Math.max(10, Math.min(32, (cards.length - 1) * 4))

  return (
    <div
      className="relative h-full flex justify-center px-6 pb-6 overflow-visible"
      style={{ paddingTop: 66 }}
    >
      {/* Draw pile — pinned bottom-left (mirrors discard pile) */}
      <div className="absolute left-4 bottom-6 z-10">
        <PileStack count={drawCount} label="Draw" icon={Layers} />
      </div>

      {/* Resources + log — slightly to the right of draw pile */}
      <div className="absolute left-28 bottom-6 z-10 flex flex-col items-start gap-2.5">
        <div className="relative">
          <ManaOrbs current={mana} max={maxMana} />
          <AnimatePresence>
            {manaEvents.map(event => (
              <FloatingNumber key={event.id} event={event} onDone={() => removeManaEvent(event.id)} />
            ))}
          </AnimatePresence>
        </div>
        <GoldCounter gold={gold} />
        <div
          className="relative"
          onMouseEnter={() => setShowLog(true)}
          onMouseLeave={() => setShowLog(false)}
        >
          <motion.div
            className="flex items-center gap-1.5 text-zinc-600 cursor-default"
            whileHover={{ color: '#a1a1aa', scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <ScrollText size={14} />
            <span className="text-[11px] uppercase tracking-widest">Log</span>
          </motion.div>
          <AnimatePresence>
            {showLog && <CombatLog log={log} />}
          </AnimatePresence>
        </div>
      </div>

      {/* Fanned card hand — centered */}
      <div className="flex items-end justify-center overflow-visible">
        <AnimatePresence mode="popLayout" custom={isEnemyActing}>
          {cards.map((card, i) => {
            const playable = !disabled && card.cost <= mana
            return (
              <DraggableCard
                key={card.uid}
                card={card}
                i={i}
                mid={mid}
                anglePerCard={anglePerCard}
                overlapPx={overlapPx}
                elevated={elevated}
                raise={raise}
                lower={lower}
                playable={playable}
                disabled={disabled}
                onPlay={onPlay}
              />
            )
          })}
        </AnimatePresence>

      </div>

      {/* Discard pile — pinned to right edge */}
      <div className="absolute right-4 bottom-6 z-10">
        <PileStack count={discardCount} label="Discard" icon={Trash2} />
      </div>

    </div>
  )
}
