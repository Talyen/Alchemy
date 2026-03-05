import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CardDef } from '@/types'
import { makeStartingDeck } from '@/data'

// Tiny card tile — just name + type color, no interactivity
const typeColor: Record<string, string> = {
  attack:  '#fca5a5', // red-300
  skill:   '#7dd3fc', // sky-300
  power:   '#c4b5fd', // purple-300
  upgrade: '#fcd34d', // amber-300
}

const typeBorder: Record<string, string> = {
  attack:  'border-red-900/50',
  skill:   'border-sky-900/50',
  power:   'border-purple-900/50',
  upgrade: 'border-amber-900/50',
}

const typeBg: Record<string, string> = {
  attack:  'bg-red-950/20',
  skill:   'bg-sky-950/20',
  power:   'bg-purple-950/20',
  upgrade: 'bg-amber-950/15',
}

function CardTile({ def, delay }: { def: CardDef; delay: number }) {
  return (
    <motion.div
      className={cn(
        'flex flex-col gap-1 px-3 py-2.5 rounded-xl border bg-zinc-900',
        typeBorder[def.type],
        typeBg[def.type],
      )}
      style={{ width: 120 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay }}
    >
      <p className="text-[12px] font-medium leading-tight truncate" style={{ color: typeColor[def.type] }}>
        {def.name}
      </p>
      <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{def.description}</p>
      <p className="text-[9px] text-zinc-700 uppercase tracking-wider mt-0.5">
        {'◆'.repeat(def.cost) || '0'}
      </p>
    </motion.div>
  )
}

interface Props {
  extraCards: CardDef[]
  onContinue: () => void
}

export function DeckViewScreen({ extraCards, onContinue }: Props) {
  // Build the full run deck: base instances → defs for display
  const baseDefs = makeStartingDeck().map(({ uid: _uid, ...def }) => def as CardDef)
  const allDefs  = [...baseDefs, ...extraCards]

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="relative flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-950 overflow-hidden"
        style={{ width: 'min(90vw, calc(90vh * (16 / 9)), 1280px)', aspectRatio: '16 / 9' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/40 shrink-0">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Starting Deck</p>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">
              {allDefs.length} cards
            </h2>
          </div>
          <motion.button
            onClick={onContinue}
            className="px-6 py-2.5 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-200 tracking-wide"
            style={{ background: 'rgba(39,39,42,0.8)' }}
            whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.5)' } as Parameters<typeof motion.button>[0]['whileHover']}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
          >
            Begin Run →
          </motion.button>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex flex-wrap gap-3">
            {allDefs.map((def, i) => (
              <CardTile key={`${def.id}-${i}`} def={def} delay={i * 0.025} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
