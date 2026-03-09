import { motion } from 'framer-motion'
import { Droplets, Flame, Pickaxe, ShieldHalf, ShieldOff, ShieldPlus, Swords, TrendingDown } from 'lucide-react'
import type { ActiveUpgrade, TrinketDef } from '@/types'
import { TrinketInfoCard } from './TrinketInfoCard'

type PaneSide = 'left' | 'right'

interface DetailsPaneProps {
  title: string
  hp: number
  maxHp: number
  block: number
  armor?: number
  forge?: number
  vulnerable: number
  weak: number
  burn: number
  poison: number
  bleed: number
  trap?: number
  side: PaneSide
  hpColor: 'green' | 'red'
  upgrades?: ActiveUpgrade[]
  trinkets?: TrinketDef[]
  weaknesses?: string[]
}

export function DetailsPane({
  title,
  hp,
  maxHp,
  block,
  armor = 0,
  forge = 0,
  vulnerable,
  weak,
  burn,
  poison,
  bleed,
  trap = 0,
  side,
  hpColor,
  upgrades = [],
  trinkets = [],
  weaknesses = [],
}: DetailsPaneProps) {
  const hasStatus = armor > 0 || forge > 0 || block > 0 || vulnerable > 0 || weak > 0 || burn > 0 || poison > 0 || bleed > 0 || trap > 0
  const hasUpgrades = upgrades.length > 0
  const hasTrinkets = trinkets.length > 0
  const hasWeaknesses = weaknesses.length > 0
  const groupedUpgrades = upgrades.reduce<Array<ActiveUpgrade & { count: number }>>((acc, upgrade) => {
    const existing = acc.find(item => item.id === upgrade.id)
    if (existing) {
      existing.count += 1
    } else {
      acc.push({ ...upgrade, count: 1 })
    }
    return acc
  }, [])

  return (
    <motion.div
      key="details-pane"
      className="absolute pointer-events-none z-30 rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 w-64"
      style={
        side === 'left'
          ? { right: 'calc(100% + 10px)', top: '50%', y: '-50%' }
          : { left: 'calc(100% + 10px)', top: '50%', y: '-50%' }
      }
      initial={{ opacity: 0, x: side === 'left' ? 8 : -8, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: side === 'left' ? 8 : -8,
        scale: 0.97,
        transition: { duration: 0.1, ease: 'easeIn' },
      }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-sm text-zinc-200 mb-1.5">{title}</p>
      <div className="h-px bg-zinc-800 mb-1.5" />

      <p className="text-[14px] font-mono">
        <span className={hpColor === 'green' ? 'text-green-700' : 'text-red-700'}>HP</span>
        <span className="text-zinc-300 ml-1">{hp}</span>
        <span className="text-zinc-600">/{maxHp}</span>
      </p>

      {hasStatus && (
        <>
          <div className="h-px bg-zinc-800 mt-2 mb-1.5" />
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5">Status</p>
          {armor > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <ShieldPlus size={12} style={{ color: '#fbbf24', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-amber-300">Armor</span>
              <span className="text-zinc-500 ml-1">{armor}</span>
            </div>
          )}
          {forge > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <Pickaxe size={12} style={{ color: '#fbbf24', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-amber-300">Forge</span>
              <span className="text-zinc-500 ml-1">{forge}</span>
            </div>
          )}
          {block > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <ShieldHalf size={12} style={{ color: '#60a5fa', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-sky-300">Shield</span>
              <span className="text-zinc-500 ml-1">{block}</span>
            </div>
          )}
          {vulnerable > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <ShieldOff size={12} style={{ color: '#f97316', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-orange-400">Vulnerable</span>
              <span className="text-zinc-500 ml-1">{vulnerable}t</span>
            </div>
          )}
          {weak > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] mb-1">
              <TrendingDown size={12} style={{ color: '#a1a1aa', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-zinc-400">Weak</span>
              <span className="text-zinc-500 ml-1">{weak}t</span>
            </div>
          )}
          {burn > 0 && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <Flame size={12} style={{ color: '#f97316', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-orange-400">Burn</span>
              <span className="text-zinc-500 ml-1">{burn}</span>
            </div>
          )}
          {poison > 0 && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <Droplets size={12} style={{ color: '#4ade80', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-emerald-400">Poison</span>
              <span className="text-zinc-500 ml-1">{poison}</span>
            </div>
          )}
          {bleed > 0 && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <Swords size={12} style={{ color: '#f87171', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-rose-400">Bleed</span>
              <span className="text-zinc-500 ml-1">{bleed}</span>
            </div>
          )}
          {trap > 0 && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <ShieldOff size={12} style={{ color: '#f59e0b', pointerEvents: 'none', flexShrink: 0 }} />
              <span className="text-amber-400">Trap</span>
              <span className="text-zinc-500 ml-1">{trap}</span>
            </div>
          )}
        </>
      )}

      {hasWeaknesses && (
        <>
          <div className="h-px bg-zinc-800 mt-2 mb-1.5" />
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5">Weaknesses</p>
          <div className="flex flex-col gap-1">
            {weaknesses.map(weakness => (
              <p key={weakness} className="text-[13px] text-rose-300">{weakness}</p>
            ))}
          </div>
        </>
      )}

      {hasUpgrades && (
        <>
          <div className="h-px bg-zinc-800 mt-2 mb-1.5" />
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5">Upgrades</p>
          <div className="flex flex-col gap-1.5">
            {groupedUpgrades.map(upgrade => (
              <div key={`${upgrade.id}-${upgrade.name}`}>
                <div className="flex items-center gap-1.5">
                  {upgrade.effect.armor !== undefined && (
                    <ShieldPlus size={12} style={{ color: '#fbbf24', pointerEvents: 'none', flexShrink: 0 }} />
                  )}
                  {upgrade.effect.forge !== undefined && (
                    <Pickaxe size={12} style={{ color: '#fbbf24', pointerEvents: 'none', flexShrink: 0 }} />
                  )}
                  {(upgrade.effect.burn !== undefined || upgrade.effect.selfBurn !== undefined) && (
                    <Flame size={12} style={{ color: '#f97316', pointerEvents: 'none', flexShrink: 0 }} />
                  )}
                  <p className="text-[13px] text-amber-300">
                    {upgrade.name}
                    {upgrade.count > 1 ? ` (${upgrade.count})` : ''}
                  </p>
                </div>
                <p className="text-[11px] text-amber-500/80 leading-snug">{upgrade.description}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {hasTrinkets && (
        <>
          <div className="h-px bg-zinc-800 mt-2 mb-1.5" />
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5">Trinkets</p>
          <div className="flex flex-col gap-2">
            {trinkets.map(trinket => (
              <TrinketInfoCard
                key={trinket.id}
                id={trinket.id}
                name={trinket.name}
                description={trinket.description}
                size="compact"
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}