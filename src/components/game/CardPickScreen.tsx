import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { CardDef, CardInstance } from '@/types'
import { Card } from './Card'
import { GoldIcon } from './GoldIcon'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'

interface Props {
  title: string
  subtitle: string
  options: CardDef[]
  onPick: (card: CardDef) => void
  onSkip?: () => void
  foundGold?: number
  topLeft?: ReactNode
}

// Wrap a CardDef as a fake CardInstance for display
function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function CardPickScreen({ title, subtitle, options, onPick, onSkip, foundGold, topLeft }: Props) {
  return (
    <SelectionScreenShell title={title} subtitle={subtitle} topLeft={topLeft}>
      {foundGold !== undefined && foundGold > 0 && (
        <motion.div
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-4 py-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <GoldIcon size={14} />
          <span className="text-xs uppercase tracking-wider text-zinc-500">Found</span>
          <span className="text-sm font-semibold text-amber-300">{foundGold} Gold</span>
        </motion.div>
      )}

      <motion.div
        className="flex items-start gap-[2.75rem] pt-3"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="show"
      >
        {options.map((def, i) => (
          <motion.div
            key={def.id + i}
            variants={staggerItemVariants}
            whileHover={{
              y: -40,
              transition: { type: 'spring', stiffness: 220, damping: 28 },
            }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            onClick={() => onPick(def)}
            style={{ cursor: 'pointer' }}
          >
            <Card
              card={toInstance(def, `pick-${i}`)}
              playable
            />
          </motion.div>
        ))}
      </motion.div>
      {onSkip && (
        <motion.button
          className="mt-6 px-5 py-2 rounded-lg border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-500"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.2 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSkip}
        >
          Skip
        </motion.button>
      )}
    </SelectionScreenShell>
  )
}
