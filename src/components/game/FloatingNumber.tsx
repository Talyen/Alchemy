import { motion } from 'framer-motion'
import { Bomb, CircleDollarSign, Diamond, Droplets, Flame, Heart, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Sword, Swords, TrendingDown } from 'lucide-react'
import { CARD_ART_BY_ID } from '@/cardArt'

const FLOATING_LANE_GAP = 24

// ─── Damage / heal / block numbers ───────────────────────────────────────────

export interface DmgEvent {
  id: number
  /** Positive or negative amount. Sign is shown automatically. */
  value: number
  type: 'damage' | 'heal' | 'block' | 'gold' | 'mana'
  cardId?: string
  lane?: number
}

const dmgCfg = {
  damage: { color: '#dc2626', prefix: '-', Icon: Sword,      shadow: 'rgba(185,28,28,0.4)' },
  heal:   { color: '#16a34a', prefix: '+', Icon: Heart,      shadow: 'rgba(22,163,74,0.4)'  },
  block:  { color: '#3b82f6', prefix: '+', Icon: ShieldHalf, shadow: 'rgba(59,130,246,0.4)' },
  gold:   { color: '#f59e0b', prefix: '+', Icon: CircleDollarSign, shadow: 'rgba(245,158,11,0.4)' },
  mana:   { color: '#2563eb', prefix: '+', Icon: Diamond, shadow: 'rgba(37,99,235,0.4)' },
}

interface DmgProps {
  event: DmgEvent
  onDone: () => void
}

export function FloatingNumber({ event, onDone }: DmgProps) {
  const { color, Icon, shadow } = dmgCfg[event.type]
  const cardArt = event.cardId ? CARD_ART_BY_ID[event.cardId] : undefined
  const lane = event.lane ?? 0
  // determine sign and display value
  const val = Math.abs(event.value)
  const sign = event.value >= 0 ? dmgCfg[event.type].prefix : '-'
  return (
    <motion.div
      className="absolute flex items-center gap-0.5 pointer-events-none z-20 whitespace-nowrap"
      style={{ top: 18 + lane * FLOATING_LANE_GAP, left: '50%' }}
      initial={{ x: '-50%', y: 0, opacity: 1 }}
      animate={{ x: '-50%', y: -52, opacity: 0 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      {cardArt ? (
        <img
          src={cardArt}
          alt=""
          className="w-[18px] h-[18px] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <Icon size={14} style={{ color, flexShrink: 0 }} />
      )}
      <span
        style={{
          color,
          fontWeight: 800,
          fontSize: 22,
          lineHeight: 1,
          textShadow: `0 2px 10px ${shadow}`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sign}{val}
      </span>
    </motion.div>
  )
}

// ─── Status effect popups ─────────────────────────────────────────────────────

export interface StatusEvent {
  id: number
  value: number
  status: 'burn' | 'vulnerable' | 'weak' | 'forge' | 'armor' | 'poison' | 'bleed' | 'trap'
  cardId?: string
  lane?: number
}

const statusCfg = {
  burn:       { color: '#f97316', Icon: Flame,        shadow: 'rgba(249,115,22,0.4)'  },
  vulnerable: { color: '#f97316', Icon: ShieldOff,    shadow: 'rgba(249,115,22,0.4)'  },
  weak:       { color: '#a1a1aa', Icon: TrendingDown,  shadow: 'rgba(161,161,170,0.3)' },
  forge:      { color: '#fbbf24', Icon: Pickaxe,      shadow: 'rgba(251,191,36,0.4)'  },
  armor:      { color: '#fbbf24', Icon: ShieldPlus,   shadow: 'rgba(251,191,36,0.4)'  },
  poison:     { color: '#4ade80', Icon: Droplets,     shadow: 'rgba(74,222,128,0.4)'  },
  bleed:      { color: '#f87171', Icon: Swords,       shadow: 'rgba(248,113,113,0.4)' },
  trap:       { color: '#f59e0b', Icon: Bomb,         shadow: 'rgba(245,158,11,0.4)'  },
}

interface StatusProps {
  event: StatusEvent
  onDone: () => void
}

export function FloatingStatus({ event, onDone }: StatusProps) {
  const { color, Icon, shadow } = statusCfg[event.status]
  const cardArt = event.cardId ? CARD_ART_BY_ID[event.cardId] : undefined
  const lane = event.lane ?? 0
  return (
    <motion.div
      className="absolute flex items-center gap-0.5 pointer-events-none z-20 whitespace-nowrap"
      style={{ top: 18 + lane * FLOATING_LANE_GAP, left: '50%' }}
      initial={{ x: '-50%', y: 0, opacity: 1 }}
      animate={{ x: '-50%', y: -52, opacity: 0 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      {cardArt ? (
        <img
          src={cardArt}
          alt=""
          className="w-[18px] h-[18px] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <Icon size={16} style={{ color, flexShrink: 0 }} />
      )}
      <span
        style={{
          color,
          fontWeight: 800,
          fontSize: 20,
          lineHeight: 1,
          textShadow: `0 2px 10px ${shadow}`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        +{event.value}
      </span>
      {cardArt && <Icon size={16} style={{ color, flexShrink: 0 }} />}
    </motion.div>
  )
}
