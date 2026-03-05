import { motion } from 'framer-motion'
import type { CardDef, CardInstance } from '@/types'
import { Card } from './Card'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'

interface Props {
  title: string
  subtitle: string
  options: CardDef[]
  onPick: (card: CardDef) => void
}

// Wrap a CardDef as a fake CardInstance for display
function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function CardPickScreen({ title, subtitle, options, onPick }: Props) {
  return (
    <SelectionScreenShell title={title} subtitle={subtitle}>
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
    </SelectionScreenShell>
  )
}
