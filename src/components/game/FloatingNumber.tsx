import { motion } from 'framer-motion'
import { Bomb, Diamond, Droplets, Flame, Heart, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Sword, Swords, TrendingDown } from 'lucide-react'
import { CARD_ART_BY_ID } from '@/cardArt'
import { GoldIcon } from './GoldIcon'

const FLOATING_BASE_TOP = 22

type PopupMotion = {
  initial: Record<string, number | string>
  animate: Record<string, number | string | Array<number | string>>
  transition: Record<string, unknown>
}

function seededUnit(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function getDamageBurstMotion(seed: number, lane = 0): PopupMotion {
  const pick = Math.floor(seededUnit(seed) * 4)
  const jitter = (seededUnit(seed + 17) - 0.5) * 30
  const side = lane % 2 === 0 ? 1 : -1

  if (pick === 0) {
    return {
      initial: { x: 0, y: 0, opacity: 1, scale: 0.95, rotate: 0, filter: 'blur(0px)' },
      animate: { x: side * (18 + Math.abs(jitter)), y: -54, opacity: [1, 1, 0], scale: [0.95, 1.08, 1], rotate: side * 8, filter: ['blur(0px)', 'blur(0px)', 'blur(0.6px)'] },
      transition: { duration: 1.25, ease: 'easeOut', times: [0, 0.7, 1] },
    }
  }

  if (pick === 1) {
    return {
      initial: { x: 0, y: 0, opacity: 1, scale: 0.92, rotate: 0, filter: 'blur(0px)' },
      animate: { x: side * (26 + jitter), y: -62, opacity: [1, 0.95, 0], scale: [0.92, 1.14, 0.96], rotate: side * 12, filter: ['blur(0px)', 'blur(0px)', 'blur(1px)'] },
      transition: { duration: 1.35, ease: [0.16, 1, 0.3, 1], times: [0, 0.72, 1] },
    }
  }

  if (pick === 2) {
    return {
      initial: { x: 0, y: 0, opacity: 1, scale: 0.9, rotate: 0, filter: 'blur(0px)' },
      animate: {
        x: [0, side * (10 + jitter * 0.4), side * (4 + jitter * 0.25)],
        y: [0, -36, -64],
        opacity: [1, 1, 0],
        scale: [0.9, 1.18, 0.88],
        rotate: [0, side * 6, 0],
        filter: ['blur(0px)', 'blur(0px)', 'blur(1.1px)'],
      },
      transition: { duration: 1.38, ease: 'easeOut', times: [0, 0.52, 1] },
    }
  }

  return {
    initial: { x: 0, y: 0, opacity: 1, scale: 0.94, rotate: 0, filter: 'blur(0px)' },
    animate: { x: jitter * 0.35, y: -58, opacity: [1, 0.95, 0], scale: [0.94, 1.08, 1], rotate: jitter * 0.22, filter: ['blur(0px)', 'blur(0px)', 'blur(0.7px)'] },
    transition: { duration: 1.3, ease: 'easeOut', times: [0, 0.66, 1] },
  }
}

function getStableFadeMotion(seed: number): PopupMotion {
  const wobble = (seededUnit(seed + 9) - 0.5) * 4
  return {
    initial: { x: wobble, y: 0, opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' },
    animate: {
      x: wobble,
      y: 0,
      opacity: [1, 1, 0],
      scale: [1, 1.04, 0.98],
      rotate: [0, wobble * 0.15, 0],
      filter: ['blur(0px)', 'blur(0px)', 'blur(0.6px)'],
    },
    transition: { duration: 1.0, ease: 'easeOut', times: [0, 0.62, 1] },
  }
}

// ─── Damage / heal / block numbers ───────────────────────────────────────────

export interface DmgEvent {
  id: number
  /** Positive or negative amount. Sign is shown automatically. */
  value: number
  type: 'damage' | 'heal' | 'block' | 'gold' | 'mana' | 'burn_damage' | 'poison_damage' | 'bleed_damage'
  cardId?: string
  lane?: number
}

const dmgCfg = {
  damage:       { color: '#dc2626', prefix: '-', Icon: Sword,       shadow: 'rgba(185,28,28,0.4)' },
  heal:         { color: '#16a34a', prefix: '+', Icon: Heart,       shadow: 'rgba(22,163,74,0.4)'  },
  block:        { color: '#3b82f6', prefix: '+', Icon: ShieldHalf,  shadow: 'rgba(59,130,246,0.4)' },
  gold:         { color: '#f59e0b', prefix: '+', Icon: Diamond,     shadow: 'rgba(245,158,11,0.4)' },
  mana:         { color: '#2563eb', prefix: '+', Icon: Diamond,     shadow: 'rgba(37,99,235,0.4)' },
  burn_damage:  { color: '#f97316', prefix: '-', Icon: Flame,       shadow: 'rgba(249,115,22,0.4)' },
  poison_damage:{ color: '#4ade80', prefix: '-', Icon: Droplets,    shadow: 'rgba(74,222,128,0.4)' },
  bleed_damage: { color: '#f87171', prefix: '-', Icon: Swords,      shadow: 'rgba(248,113,113,0.4)' },
}

interface DmgProps {
  event: DmgEvent
  onDone: () => void
  top?: number
}

export function FloatingNumber({ event, onDone, top }: DmgProps) {
  const { color, Icon, shadow } = dmgCfg[event.type]
  const cardArt = event.cardId ? CARD_ART_BY_ID[event.cardId] : undefined
  const popupSeed = event.id * 11 + Math.abs(event.value) * 7 + event.type.length * 13
  const isBurst = event.type === 'damage' || event.type === 'burn_damage' || event.type === 'poison_damage' || event.type === 'bleed_damage'
  const popupMotion = isBurst
    ? getDamageBurstMotion(popupSeed, event.lane ?? 0)
    : getStableFadeMotion(popupSeed)
  // determine sign and display value
  const val = Math.abs(event.value)
  const sign = event.value >= 0 ? dmgCfg[event.type].prefix : '-'
  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none z-20 whitespace-nowrap"
      style={{ top: top ?? FLOATING_BASE_TOP }}
      initial={popupMotion.initial}
      animate={popupMotion.animate}
      transition={popupMotion.transition}
      onAnimationComplete={onDone}
    >
      {cardArt ? (
        <img
          src={cardArt}
          alt=""
          className="w-[18px] h-[18px] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : event.type === 'gold' ? (
        <GoldIcon size={14} />
      ) : (
        <Icon size={14} style={{ color, flexShrink: 0 }} />
      )}
      <span
        style={{
          color,
          fontWeight: 800,
          fontSize: 27,
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
  status: 'burn' | 'vulnerable' | 'weak' | 'forge' | 'armor' | 'poison' | 'bleed' | 'trap' | 'strength'
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
  strength:   { color: '#fbbf24', Icon: Sword,        shadow: 'rgba(251,191,36,0.4)'  },
}

interface StatusProps {
  event: StatusEvent
  onDone: () => void
  top?: number
}

export function FloatingStatus({ event, onDone, top }: StatusProps) {
  const { color, Icon, shadow } = statusCfg[event.status]
  const cardArt = event.cardId ? CARD_ART_BY_ID[event.cardId] : undefined
  const popupMotion = getStableFadeMotion(event.id * 13 + event.value * 5 + event.status.length * 9)
  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none z-20 whitespace-nowrap"
      style={{ top: top ?? FLOATING_BASE_TOP }}
      initial={popupMotion.initial}
      animate={popupMotion.animate}
      transition={popupMotion.transition}
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
          fontSize: 23,
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
