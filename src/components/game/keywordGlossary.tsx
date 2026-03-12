import { Circle, Diamond, Droplets, Expand, Flame, Hammer, Heart, HeartPulse, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Sparkles, Swords, TrendingDown, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type KeywordEntry = {
  Icon: LucideIcon
  color: string
  description: string
}

export type KeywordInfo = KeywordEntry & { name: string }

export const KEYWORDS: Record<string, KeywordEntry> = {
  Block: {
    Icon: ShieldHalf,
    color: '#60a5fa',
    description: 'A shield that absorbs Damage before your HP. Persists until broken.',
  },
  Armor: {
    Icon: ShieldPlus,
    color: '#fbbf24',
    description: 'Reduces incoming Physical damage by 1 per point, before it reaches your Block.',
  },
  Vulnerable: {
    Icon: ShieldOff,
    color: '#f97316',
    description: 'Takes 50% more damage from all sources.',
  },
  Weak: {
    Icon: TrendingDown,
    color: '#a1a1aa',
    description: 'Deals 25% less damage.',
  },
  Pierce: {
    Icon: Swords,
    color: '#94a3b8',
    description: 'A precise physical damage type.',
  },
  Slash: {
    Icon: Zap,
    color: '#94a3b8',
    description: 'A sweeping physical damage type.',
  },
  Blunt: {
    Icon: Hammer,
    color: '#94a3b8',
    description: 'A heavy, crushing physical damage type.',
  },
  Forge: {
    Icon: Pickaxe,
    color: '#fbbf24',
    description: 'Physical damage you deal is increased by 1.',
  },
  Leech: {
    Icon: HeartPulse,
    color: '#f43f5e',
    description: 'Damage dealt heals you.',
  },
  Heal: {
    Icon: Heart,
    color: '#86efac',
    description: 'Restores your HP.',
  },
  Mana: {
    Icon: Diamond,
    color: '#2563eb',
    description: 'Resource used to play cards.',
  },
  Burn: {
    Icon: Flame,
    color: '#f97316',
    description: 'Deals Burn damage and decreases by 1 each turn.',
  },
  Chill: {
    Icon: Droplets,
    color: '#38bdf8',
    description: 'Accumulates cold damage. If Chill reaches 20% of max HP, that unit loses its next turn and Chill is removed.',
  },
  Poison: {
    Icon: Droplets,
    color: '#166534',
    description: 'Deals Poison damage each turn.',
  },
  Bleed: {
    Icon: Droplets,
    color: '#f87171',
    description: 'Deals Physical damage and twice as much next turn before expiring.',
  },
  Area: {
    Icon: Expand,
    color: '#a78bfa',
    description: 'Affects all enemies on the field.',
  },
  Gold: {
    Icon: Circle,
    color: '#fbbf24',
    description: 'Currency used in shops.',
  },
  'Mana Crystal': {
    Icon: Diamond,
    color: '#2563eb',
    description: 'Resource used to play cards. Mana Crystals refill each turn.',
  },
  Trap: {
    Icon: ShieldOff,
    color: '#d2b48c',
    description: 'Triggers when attacked',
  },
  Wish: {
    Icon: Sparkles,
    color: '#facc15',
    description: 'Select from a set of 3 cards.',
  },
  Haste: {
    Icon: Zap,
    color: '#facc15',
    description: 'Take an extra turn after this one.',
  },
  Ailment: {
    Icon: ShieldOff,
    color: '#86efac',
    description: 'Negative status effects.',
  },
  Holy: {
    Icon: Sparkles,
    color: '#fde68a',
    description: 'A pious, smiteful damage type.',
  },
  Consume: {
    Icon: Flame,
    color: '#fdba74',
    description: 'Removed for the rest of combat after use.',
  },
  Randomize: {
    Icon: Sparkles,
    color: '#c084fc',
    description: 'Replace a card in your hand with a random card this encounter.',
  },
  Corrupt: {
    Icon: Sparkles,
    color: '#f43f5e',
    description: 'A volatile mutation applied by events. Corrupted cards gain random stat shifts or side effects.',
  },
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getKeywordNamesByPriority() {
  return Object.keys(KEYWORDS).sort((a, b) => b.length - a.length)
}

export function renderKeywordText(text: string) {
  const names = getKeywordNamesByPriority()
  const pattern = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g')
  const parts = text.split(pattern)
  return parts.map((part, i) => {
    const kw = KEYWORDS[part]
    return kw
      ? <span key={i} style={{ color: kw.color }} className="font-semibold">{part}</span>
      : part
  })
}

export function getKeywordsFromText(text: string): KeywordInfo[] {
  let remaining = text.toLowerCase()
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