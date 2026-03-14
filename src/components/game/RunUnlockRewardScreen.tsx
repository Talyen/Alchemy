import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SelectionScreenShell } from './SelectionScreenShell'

type Props = {
  unlockedCardNames: string[]
  unlockedCharacterName?: string | null
  onContinue: () => void
  topLeft?: ReactNode
}

export function RunUnlockRewardScreen({ unlockedCardNames, unlockedCharacterName, onContinue, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Run Rewards" subtitle="Progression" topLeft={topLeft} allowOverflowVisible>
      <div className="w-full max-w-4xl -mt-4 flex flex-col items-center gap-6">
        {unlockedCharacterName && (
          <motion.div
            className="w-full max-w-xl rounded-2xl border border-amber-500/35 bg-amber-500/10 px-6 py-4 text-center"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/90">Character Unlocked</p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{unlockedCharacterName}</p>
          </motion.div>
        )}

        <motion.div
          className="w-full max-w-xl rounded-2xl border border-zinc-700/80 bg-zinc-900/85 px-6 py-5"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Cards Unlocked</p>
          {unlockedCardNames.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unlockedCardNames.map(name => (
                <div key={name} className="rounded-lg border border-zinc-700/70 bg-zinc-950/65 px-3 py-2 text-sm text-zinc-200">
                  {name}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">All cards are already unlocked.</p>
          )}
        </motion.div>

        <motion.button
          type="button"
          onClick={onContinue}
          className="px-6 py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/85 text-sm text-zinc-200"
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
