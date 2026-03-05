import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useMotionTemplate, useAnimationControls } from 'framer-motion'
import type { MouseEvent } from 'react'
import { Circle, Diamond, Droplets, Expand, Flame, Hammer, Heart, HeartPulse, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Sparkles, Swords, TrendingDown, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardInstance } from '@/types'
import { CARD_ART_BY_ID } from '@/cardArt'

interface Props {
  card: CardInstance
  playable: boolean
  isBeingDragged?: boolean
  backgroundClassName?: string
}

// Per-type visual config — attack=red, skill=blue, power=purple, upgrade=amber
const typeConfig = {
  attack: {
    border:     'border-zinc-800/50',
    headerBg:   'bg-red-950/20',
    titleColor: 'text-red-300',
    accent:     '#7f1d1d',
    divider:    'bg-red-900/20',
  },
  skill: {
    border:     'border-zinc-800/50',
    headerBg:   'bg-sky-950/20',
    titleColor: 'text-sky-300',
    accent:     '#0c4a6e',
    divider:    'bg-sky-900/20',
  },
  power: {
    border:     'border-zinc-800/50',
    headerBg:   'bg-purple-950/20',
    titleColor: 'text-purple-300',
    accent:     '#3b0764',
    divider:    'bg-purple-900/20',
  },
  upgrade: {
    border:     'border-zinc-800/50',
    headerBg:   'bg-amber-950/20',
    titleColor: 'text-amber-300',
    accent:     '#78350f',
    divider:    'bg-amber-900/20',
  },
  heal: {
    border:     'border-zinc-800/50',
    headerBg:   'bg-emerald-950/20',
    titleColor: 'text-emerald-300',
    accent:     '#064e3b',
    divider:    'bg-emerald-900/20',
  },
}

// ─── Keyword glossary ────────────────────────────────────────────────────────
// Add entries here as new keywords are introduced to the game.

type KeywordEntry = {
  Icon: LucideIcon
  color: string
  description: string
}

const KEYWORDS: Record<string, KeywordEntry> = {
  Block: {
    Icon:        ShieldHalf,
    color:       '#60a5fa',
    description: 'A shield that absorbs Damage before your HP. Persists until broken.',
  },
  Armor: {
    Icon:        ShieldPlus,
    color:       '#fbbf24',
    description: 'Reduces incoming Physical damage by 1 per point, before it reaches your Block.',
  },
  Vulnerable: {
    Icon:        ShieldOff,
    color:       '#f97316',
    description: 'Takes 50% more damage from all sources.',
  },
  Weak: {
    Icon:        TrendingDown,
    color:       '#a1a1aa',
    description: 'Deals 25% less damage.',
  },
  Pierce: {
    Icon:        Swords,
    color:       '#94a3b8',
    description: 'A precise physical damage type.',
  },
  Slash: {
    Icon:        Zap,
    color:       '#94a3b8',
    description: 'A sweeping physical damage type.',
  },
  Blunt: {
    Icon:        Hammer,
    color:       '#94a3b8',
    description: 'A heavy, crushing physical damage type.',
  },
  Forge: {
    Icon:        Pickaxe,
    color:       '#fbbf24',
    description: 'Physical damage you deal is increased by 1.',
  },
  Leech: {
    Icon:        HeartPulse,
    color:       '#f43f5e',
    description: 'Damage dealt heals you.',
  },
  Heal: {
    Icon:        Heart,
    color:       '#86efac',
    description: 'Restores your HP.',
  },
  Mana: {
    Icon:        Diamond,
    color:       '#2563eb',
    description: 'Resource used to play cards.',
  },
  Burn: {
    Icon:        Flame,
    color:       '#f97316',
    description: 'Deals Fire damage and decreases by 1 each turn.',
  },
  Poison: {
    Icon:        Droplets,
    color:       '#166534',
    description: 'Deals Poison damage each turn.',
  },
  Bleed: {
    Icon:        Droplets,
    color:       '#f87171',
    description: 'Deals Physical damage and twice as much next turn before expiring.',
  },
  Area: {
    Icon:        Expand,
    color:       '#a78bfa',
    description: 'Affects all enemies on the field.',
  },
  Gold: {
    Icon:        Circle,
    color:       '#fbbf24',
    description: 'Currency used in shops.',
  },
  'Mana Crystal': {
    Icon:        Diamond,
    color:       '#2563eb',
    description: 'Resource used to play cards. Mana Crystals refill each turn.',
  },
  Trap: {
    Icon:        ShieldOff,
    color:       '#d2b48c',
    description: 'Triggers when attacked',
  },
  Wish: {
    Icon:        Sparkles,
    color:       '#facc15',
    description: 'Select from a set of 3 cards.',
  },
  Haste: {
    Icon:        Zap,
    color:       '#facc15',
    description: 'Take an extra turn after this one.',
  },
  Ailment: {
    Icon:        ShieldOff,
    color:       '#86efac',
    description: 'Negative status effects.',
  },
  Holy: {
    Icon:        Sparkles,
    color:       '#fde68a',
    description: 'A pious, smiteful damage type.',
  },
  Consume: {
    Icon:        Flame,
    color:       '#fdba74',
    description: 'Removed for the rest of combat after use.',
  },
}

// Splits description text and wraps keyword names in colored bold spans.
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getKeywordNamesByPriority() {
  return Object.keys(KEYWORDS).sort((a, b) => b.length - a.length)
}

function renderDescription(desc: string) {
  const names = getKeywordNamesByPriority()
  const pattern = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g')
  const parts = desc.split(pattern)
  return parts.map((part, i) => {
    const kw = KEYWORDS[part]
    return kw
      ? <span key={i} style={{ color: kw.color }} className="font-semibold">{part}</span>
      : part
  })
}

function getCardKeywords(card: CardInstance): Array<KeywordEntry & { name: string }> {
  let remaining = card.description.toLowerCase()
  const matchedNames: string[] = []

  for (const name of getKeywordNamesByPriority()) {
    const needle = name.toLowerCase()
    if (remaining.includes(needle)) {
      matchedNames.push(name)
      remaining = remaining.split(needle).join(' ')
    }
  }

  return matchedNames.map(name => ({ name, ...KEYWORDS[name] }))
}

// ─── Mana pips ───────────────────────────────────────────────────────────────

function ManaPips({ cost }: { cost: number }) {
  if (cost === 0) return null
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {Array.from({ length: cost }).map((_, i) => (
        <Diamond
          key={i}
          size={12}
          fill="#2563eb"
          color="transparent"
          strokeWidth={0}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({ card, playable, isBeingDragged = false, backgroundClassName }: Props) {
  const cfg      = typeConfig[card.type]
  const art      = CARD_ART_BY_ID[card.id]
  const keywords = getCardKeywords(card)
  const titleSizeClass = card.name.length >= 12 ? 'text-[13px]' : 'text-[15px]'

  // Tooltip with 1 s hover delay
  const [showTooltip, setShowTooltip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sheen sweep — triggered on hover, resets on leave
  const sheenControls = useAnimationControls()

  const onWrapperEnter = () => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 300)
    void sheenControls.start({ x: 320, transition: { duration: 1.1, ease: [0.4, 0, 0.6, 1] } })
  }
  const onWrapperLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowTooltip(false)
    sheenControls.set({ x: -160 })
  }

  // Periodic sheen while the card is held
  useEffect(() => {
    if (!isBeingDragged) return
    const fire = () => void sheenControls.start({ x: 320, transition: { duration: 1.1, ease: [0.4, 0, 0.6, 1] } })
    fire()
    const id = setInterval(fire, 1800)
    return () => {
      clearInterval(id)
      sheenControls.set({ x: -160 })
    }
  }, [isBeingDragged, sheenControls])

  // Mouse position within the card (0–1 range), drives 3D tilt + sheen
  const rawX = useMotionValue(0.5)
  const rawY = useMotionValue(0.5)

  const rotateY = useSpring(useTransform(rawX, [0, 1], [-10, 10]), { stiffness: 400, damping: 35 })
  const rotateX = useSpring(useTransform(rawY, [0, 1], [8, -8]),   { stiffness: 400, damping: 35 })

  const shineX = useTransform(rotateY, [-10, 10], [20, 80])
  const shineY = useTransform(rotateX, [8, -8],   [20, 80])
  const sheen  = useMotionTemplate`radial-gradient(ellipse 180% 150% at ${shineX}% ${shineY}%, rgba(255,255,255,0.045), transparent 75%)`

  const onMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!playable) return
    const r = e.currentTarget.getBoundingClientRect()
    rawX.set((e.clientX - r.left) / r.width)
    rawY.set((e.clientY - r.top)  / r.height)
  }

  const onLeave = () => {
    rawX.set(0.5)
    rawY.set(0.5)
  }

  return (
    // Wrapper sits outside overflow-hidden so the tooltip isn't clipped
    <div className="relative" onMouseEnter={onWrapperEnter} onMouseLeave={onWrapperLeave}>

      {/* ── Keyword tooltip — above the card ── */}
      <AnimatePresence>
        {showTooltip && keywords.length > 0 && (
          <motion.div
            className="absolute bottom-full left-1/2 mb-2.5 w-52 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 z-50 pointer-events-none"
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 5, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.97, transition: { duration: 0.1, ease: 'easeIn' } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Keywords</p>
            <div className="flex flex-col gap-2">
              {keywords.map(({ name, Icon, color, description }, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Icon
                    size={16}
                    style={{ color, fill: name === 'Gold' ? color : 'none', flexShrink: 0, pointerEvents: 'none' }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold leading-none" style={{ color }}>{name}</span>
                    <p className="text-[11px] text-zinc-400 leading-snug">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Card button ── */}
      <motion.button
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={cn(
          'relative flex flex-col w-48 h-72 rounded-xl text-left',
          'border-2',
          cfg.border,
          backgroundClassName ?? 'bg-zinc-900',
          'select-none outline-none overflow-hidden',
          playable ? 'cursor-grab' : 'cursor-not-allowed'
        )}
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        animate={{ filter: playable ? 'grayscale(0%) brightness(1)' : 'grayscale(100%) brightness(0.45)' }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {/* Tilt sheen */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl"
          style={{ background: sheen }}
        />

        {/* Hover glimmer sweep — diagonal stripe triggered on hover */}
        <motion.div
          className="absolute top-0 left-0 h-full w-1/2 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.07) 44%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.07) 56%, transparent 80%)',
          }}
          initial={{ x: -160 }}
          animate={sheenControls}
        />

        {/* ── Top half: pips + name + art ── */}
        <div className="flex flex-col" style={{ flex: '0 0 50%' }}>
          <div className={cn('relative flex items-center justify-center px-2.5 pt-2 pb-1.5', cfg.headerBg)}>
            <div className="absolute left-2 top-1/2 z-20 -translate-y-1/2 pointer-events-none">
              <ManaPips cost={card.cost} />
            </div>
            <p className={cn(titleSizeClass, 'w-full text-center font-medium leading-tight truncate', cfg.titleColor)}>
              {card.name}
            </p>
          </div>

          <div className="h-px" style={{ background: cfg.accent, opacity: 0.4 }} />

          <div className="flex-1 flex items-center justify-center">
            {art ? (
              <img
                src={art}
                alt={card.name}
                className="w-14 h-14 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : null}
          </div>
        </div>

        {/* ── Midpoint divider ── */}
        <div className={cn('mx-3 h-px', cfg.divider)} />

        {/* ── Bottom half: description + type label ── */}
        <div className="flex-1 flex flex-col px-3 py-2">
          <div className="flex-1 w-full flex items-center justify-center">
            <p className="mx-auto text-[14px] text-zinc-400 text-center leading-snug whitespace-pre-line">
              {renderDescription(card.description)}
            </p>
          </div>
          <p className={cn('text-center text-[8px] uppercase tracking-[0.15em] opacity-35', cfg.titleColor)}>
            {card.type}
          </p>
        </div>
      </motion.button>
    </div>
  )
}
