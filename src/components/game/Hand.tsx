import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useSpring } from 'framer-motion'
import { Diamond, ScrollText } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Card } from './Card'
import { FloatingNumber } from './FloatingNumber'
import { GoldIcon } from './GoldIcon'
import type { CardInstance, TrinketDef } from '@/types'
import type { DmgEvent } from './FloatingNumber'
import { useTilt } from '@/lib/useTilt'
import { playCardPlay, preloadSound } from '@/sounds'
import { TrinketInfoCard } from './TrinketInfoCard'
import { CenterModal } from '@/components/ui/CenterModal'
import { getViewportPopoverPosition, type PopoverPosition } from '@/lib/viewportPopover'

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
  drawPileCards: CardInstance[]
  discardPileCards: CardInstance[]
  trinkets: TrinketDef[]
  log: string[]
  lastCardPlayedId: string | null
  overflowDiscardFxToken: number
  overflowDiscardFxCount: number
  compact?: boolean
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

// ΓöÇΓöÇΓöÇ Mana orbs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
      <GoldIcon size={16} />
      <span className="text-xs uppercase tracking-widest">{gold} Gold</span>
    </motion.div>
  )
}

// ΓöÇΓöÇΓöÇ Combat log panel ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function CombatLog({ log, position }: { log: string[]; position: PopoverPosition | null }) {
  if (typeof window === 'undefined') return null
  return createPortal(
    // ui-allow-absolute: viewport-anchored combat log popover
    <motion.div
      className="fixed w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1 z-[999] pointer-events-none"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, x: '-50%', y: position?.placeAbove ? '-100%' : '0%' }}
      initial={{ opacity: 0, y: 5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.97, transition: { duration: 0.1, ease: 'easeIn' } }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Combat Log</p>
      {[...log].reverse().map((line, i) => (
        <p key={i} className="text-[11px] text-zinc-400 leading-snug">{line}</p>
      ))}
    </motion.div>,
    document.body,
  )
}

// ΓöÇΓöÇΓöÇ Flanking pile components ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const PILE_IMAGE_SRC = 'assets/ui/pile-card-transparent.png'

function PileStack({ count, label, onClick, isDiscard = false }: { count: number; label: string; onClick?: () => void; isDiscard?: boolean }) {
  const { tiltStyle, onMouseMove, onMouseLeave } = useTilt(8, 600)
  return (
    <motion.button
      type="button"
      className="flex flex-col items-center gap-1.5 shrink-0"
      data-testid={`pile-${label.toLowerCase()}`}
      data-ui-control
      style={tiltStyle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="relative h-24 w-24">
        {/* ui-allow-absolute: stacked pile card sprite */}
        <motion.img
          src={PILE_IMAGE_SRC}
          alt={`${label} pile`}
          className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
          style={{
            imageRendering: 'pixelated',
            filter: isDiscard ? 'grayscale(1) saturate(0.2) brightness(0.88) contrast(1.06)' : 'none',
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          draggable={false}
        />
        {/* ui-allow-absolute: pile count badge */}
        <div className="absolute -bottom-1 right-0 flex h-8 min-w-8 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/92 px-2 shadow-[0_0_12px_rgba(0,0,0,0.45)]">
          <span className="text-sm font-bold text-zinc-200 font-mono tabular-nums">{count}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-zinc-600">
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
    </motion.button>
  )
}

function PileViewer({ title, cards, onClose }: { title: string; cards: CardInstance[]; onClose: () => void }) {
  return (
    <CenterModal open onClose={onClose} widthClassName="w-[min(94vw,1220px)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">Close</button>
        </div>
        {cards.length === 0 ? (
          <p className="text-xs text-zinc-500">Empty.</p>
        ) : (
          <div className="max-h-[68vh] overflow-y-auto scrollbar-hidden pr-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
              {cards.map((card, index) => (
                <div key={`${card.uid}-${index}`} className="origin-top">
                  <Card card={card} playable={false} dimmed={false} />
                </div>
              ))}
            </div>
          </div>
        )}
    </CenterModal>
  )
}

// ΓöÇΓöÇΓöÇ Draggable card wrapper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
  compact?: boolean
}

function DraggableCard({
  card, i, mid, anglePerCard, overlapPx, elevated, raise, lower,
  playable, disabled, onPlay, compact = false,
}: DraggableCardProps) {
  const offset = i - mid
  const rotate = offset * anglePerCard
  const yDip   = offset * offset * 2.3
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

  // Velocity-driven tilt during drag ΓÇö springs back to 0 on release
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
        y: yDip - (compact ? 38 : 56),
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
      // ΓöÇΓöÇ Click or drag to play ΓöÇΓöÇ
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
      <div className={compact ? 'scale-[0.84] origin-bottom' : ''}>
        <Card
          card={card}
          playable={playable}
          isBeingDragged={isDragging}
        />
      </div>
    </motion.div>
  )
}

// ΓöÇΓöÇΓöÇ Hand ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export function Hand({ cards, mana, maxMana, gold, onPlay, disabled, isEnemyActing, drawCount, discardCount, drawPileCards, discardPileCards, trinkets, log, lastCardPlayedId, overflowDiscardFxToken, overflowDiscardFxCount, compact = false }: Props) {
  const [elevated, setElevated] = useState<Set<string>>(new Set())
  const [showLog, setShowLog]   = useState(false)
  const [logPosition, setLogPosition] = useState<PopoverPosition | null>(null)
  const [showInventory, setShowInventory] = useState(false)
  const [showDrawPile, setShowDrawPile] = useState(false)
  const [showDiscardPile, setShowDiscardPile] = useState(false)
  const [manaEvents, setManaEvents] = useState<DmgEvent[]>([])
  const [overflowFxEvents, setOverflowFxEvents] = useState<Array<{ id: number; count: number }>>([])
  const nextOverflowFxId = useRef(0)
  const prevOverflowToken = useRef(overflowDiscardFxToken)
  const prevMana = useRef(mana)
  const nextManaEventId = useRef(0)
  const logAnchorRef = useRef<HTMLDivElement | null>(null)

  const updateLogPosition = () => {
    if (!logAnchorRef.current) return
    setLogPosition(getViewportPopoverPosition(logAnchorRef.current.getBoundingClientRect(), { width: 288 }))
  }

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

  useEffect(() => {
    if (overflowDiscardFxToken === prevOverflowToken.current) return
    prevOverflowToken.current = overflowDiscardFxToken
    if (overflowDiscardFxCount <= 0) return

    setOverflowFxEvents(events => [
      ...events,
      { id: nextOverflowFxId.current++, count: overflowDiscardFxCount },
    ])
  }, [overflowDiscardFxToken, overflowDiscardFxCount])

  useEffect(() => {
    if (overflowFxEvents.length === 0) return
    const latest = overflowFxEvents[overflowFxEvents.length - 1]
    const id = window.setTimeout(() => removeOverflowFxEvent(latest.id), 720)
    return () => window.clearTimeout(id)
  }, [overflowFxEvents])

  useEffect(() => {
    if (!showLog) return
    updateLogPosition()
    window.addEventListener('resize', updateLogPosition)
    window.addEventListener('scroll', updateLogPosition, true)
    return () => {
      window.removeEventListener('resize', updateLogPosition)
      window.removeEventListener('scroll', updateLogPosition, true)
    }
  }, [showLog])

  const removeManaEvent = (id: number) => {
    setManaEvents(events => events.filter(event => event.id !== id))
  }

  const removeOverflowFxEvent = (id: number) => {
    setOverflowFxEvents(events => events.filter(event => event.id !== id))
  }

  const raise = (uid: string) =>
    setElevated(prev => new Set([...prev, uid]))

  const lower = (uid: string) =>
    setElevated(prev => { const n = new Set(prev); n.delete(uid); return n })

  const mid = (cards.length - 1) / 2
  const anglePerCard = cards.length <= 1 ? 0 : Math.min(8, 24 / (cards.length - 1))
  const overlapPx = Math.max(compact ? 8 : 10, Math.min(compact ? 26 : 32, (cards.length - 1) * (compact ? 3 : 4)))
  const activeManaEvent = manaEvents[0]

  return (
    <div className={`relative h-full flex flex-col justify-end overflow-visible ${compact ? 'gap-2 px-2 pb-2' : 'gap-4 px-4 pb-6 md:px-6'}`} data-ui-container>
      <div className={`w-full grid grid-cols-[auto_1fr_auto] items-end ${compact ? 'gap-2' : 'gap-4'}`} data-ui-container>
        <div className={`flex items-end ${compact ? 'gap-2' : 'gap-4'}`} data-ui-container>
          <div className="flex flex-col items-center gap-3" data-ui-container>
            <motion.button
              type="button"
              onClick={() => setShowInventory(prev => !prev)}
              className={`inline-flex items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/85 ${compact ? 'h-11 w-11' : 'h-14 w-14'}`}
              whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.7)' }}
              whileTap={{ scale: 0.96 }}
            >
              <img
                src="assets/ui/inventory-bag.png"
                alt="Inventory"
                className={`object-contain ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}
                style={{ imageRendering: 'pixelated' }}
              />
            </motion.button>

            <PileStack
              count={drawCount}
              label="Draw"
              onClick={() => {
                setShowDiscardPile(false)
                setShowDrawPile(prev => !prev)
              }}
            />
          </div>

          <div className={`flex flex-col items-start ${compact ? 'gap-1.5' : 'gap-2.5'}`} data-ui-container>
            <div className="relative">
              <ManaOrbs current={mana} max={maxMana} />
              <AnimatePresence mode="wait">
                {activeManaEvent && (
                  <FloatingNumber
                    key={activeManaEvent.id}
                    event={activeManaEvent}
                    top={-38}
                    onDone={() => removeManaEvent(activeManaEvent.id)}
                  />
                )}
              </AnimatePresence>
            </div>
            <GoldCounter gold={gold} />
            <div
              ref={logAnchorRef}
              className="relative"
              onMouseEnter={() => {
                updateLogPosition()
                setShowLog(true)
              }}
              onMouseLeave={() => {
                setShowLog(false)
                setLogPosition(null)
              }}
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
                {showLog && <CombatLog log={log} position={logPosition} />}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className={`flex items-end justify-center overflow-visible ${compact ? 'pb-0' : 'pb-2'}`} data-ui-boundary>
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
                  compact={compact}
                />
              )
            })}
          </AnimatePresence>
        </div>

        <div className="flex items-end">
          <PileStack
            count={discardCount}
            label="Discard"
            isDiscard
            onClick={() => {
              setShowDrawPile(false)
              setShowDiscardPile(prev => !prev)
            }}
          />
        </div>
      </div>

      <AnimatePresence>
        {showDrawPile && (
          <PileViewer
            title="Draw Pile"
            cards={drawPileCards}
            onClose={() => setShowDrawPile(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiscardPile && (
          <PileViewer
            title="Discard Pile"
            cards={discardPileCards}
            onClose={() => setShowDiscardPile(false)}
          />
        )}
      </AnimatePresence>

      <CenterModal open={showInventory} onClose={() => setShowInventory(false)} widthClassName="w-[min(94vw,980px)] max-h-[78vh]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Inventory</p>
          <button
            type="button"
            onClick={() => setShowInventory(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        </div>
        <div className="max-h-[66vh] overflow-y-auto scrollbar-hidden pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trinkets.length === 0 && (
              <p className="text-xs text-zinc-500">No trinkets yet.</p>
            )}
            {trinkets.map(trinket => (
              <TrinketInfoCard
                key={trinket.id}
                id={trinket.id}
                name={trinket.name}
                description={trinket.description}
                size="compact"
                className="w-full"
              />
            ))}
          </div>
        </div>
      </CenterModal>

      {/* ui-allow-absolute: overflow dissolve FX for cards that exceeded max hand size */}
      <AnimatePresence>
        {overflowFxEvents.map(event => (
          <motion.div
            key={event.id}
            className="absolute left-1/2 bottom-28 -translate-x-1/2 pointer-events-none z-[120]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: Math.min(4, event.count) }).map((_, i) => (
              <motion.div
                key={`${event.id}-${i}`}
                className="absolute w-10 h-14 rounded-lg border border-zinc-500/55 bg-zinc-900/85"
                style={{ left: i * 12, bottom: i * 3, boxShadow: '0 0 16px rgba(239,68,68,0.2)' }}
                initial={{ opacity: 0, y: 0, scale: 0.9, rotate: -6 + i * 4, filter: 'blur(0px)' }}
                animate={{ opacity: [0, 0.9, 0], y: -52 - i * 8, scale: [0.9, 1, 0.82], rotate: -2 + i * 3, filter: ['blur(0px)', 'blur(0px)', 'blur(2px)'] }}
                transition={{ duration: 0.58, ease: 'easeOut', delay: i * 0.04 }}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
