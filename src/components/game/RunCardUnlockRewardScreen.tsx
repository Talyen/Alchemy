import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { CardDef, CardInstance } from '@/types'
import { playUnlockReward } from '@/sounds'
import { Card } from './Card'
import { SelectionScreenShell } from './SelectionScreenShell'

type Props = {
  unlockedCards: CardDef[]
  onContinue: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function RunCardUnlockRewardScreen({ unlockedCards, onContinue, topLeft }: Props) {
  useEffect(() => {
    playUnlockReward()
  }, [])

  return (
    <SelectionScreenShell title="Cards Unlocked" subtitle="Progression" topLeft={topLeft} allowOverflowVisible>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4">
        <motion.p
          className="max-w-2xl text-center text-sm leading-relaxed text-zinc-400"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          These cards are now added to your collection and can appear in future runs.
        </motion.p>

        {unlockedCards.length > 0 ? (
          <div className="flex w-full flex-wrap items-start justify-center gap-6">
            {unlockedCards.map((card, index) => (
              <motion.div
                key={`${card.id}-${index}`}
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 250, damping: 22, delay: index * 0.08 }}
              >
                <Card card={toInstance(card, `unlock-reward-${card.id}-${index}`)} playable />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            className="rounded-2xl border border-zinc-700/80 bg-zinc-900/85 px-6 py-5 text-sm text-zinc-400"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            All cards are already unlocked.
          </motion.div>
        )}

        <motion.button
          type="button"
          onClick={onContinue}
          className="rounded-xl border border-zinc-700/80 bg-zinc-900/85 px-6 py-2.5 text-sm text-zinc-200"
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        >
          Continue
        </motion.button>
      </div>
    </SelectionScreenShell>
  )
}