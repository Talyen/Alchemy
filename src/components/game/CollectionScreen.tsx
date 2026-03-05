import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { CardDef, CardInstance } from '@/types'
import { Card } from './Card'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'
import { playCardPlay } from '@/sounds'

interface Props {
  cards: CardDef[]
  onBack: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function CollectionScreen({ cards, onBack, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Collection" subtitle="All Cards Collected" topLeft={topLeft}>
      <div className="w-full px-10">
        <motion.div
          className="grid grid-cols-5 gap-6 justify-items-center max-h-[62vh] overflow-y-auto pr-2 pt-14"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
        >
          {cards.map((def, i) => (
            <motion.div
              key={`${def.id}-${i}`}
              variants={staggerItemVariants}
              onClick={() => playCardPlay(def.id, def.type)}
              whileTap={{ scale: 0.98 }}
              style={{ cursor: 'pointer' }}
            >
              <Card card={toInstance(def, `collection-${i}`)} playable />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-6 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-300"
            style={{ background: 'rgba(39,39,42,0.8)' }}
            whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            Back
          </motion.button>
        </motion.div>
      </div>
    </SelectionScreenShell>
  )
}
