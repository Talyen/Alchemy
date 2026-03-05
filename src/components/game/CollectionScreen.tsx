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
  void onBack
  return (
    <SelectionScreenShell title="Collection" subtitle="All Cards Collected" topLeft={topLeft} titleOffsetY={14}>
      <div className="w-full px-10">
        <motion.div
          className="grid grid-cols-5 gap-6 justify-items-center max-h-[62vh] overflow-y-auto pr-2 pt-10"
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
      </div>
    </SelectionScreenShell>
  )
}
