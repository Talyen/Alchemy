import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { playGoldGain } from '@/sounds'
import { SelectionScreenShell } from './SelectionScreenShell'
import { GoldIcon } from './GoldIcon'

interface Props {
  foundGold: number
  onContinue: () => void
  topLeft?: ReactNode
}

export function MysteryGoldRewardScreen({ foundGold, onContinue, topLeft }: Props) {
  useEffect(() => { playGoldGain() }, [])
  return (
    <SelectionScreenShell title="Cache of Coins" subtitle="Mystery" topLeft={topLeft} allowOverflowVisible>
      <div className="w-full max-w-3xl -mt-4 flex flex-col items-center gap-6">
        <motion.div
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-5 py-3"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <GoldIcon size={16} />
          <span className="text-xs uppercase tracking-wider text-zinc-500">Found</span>
          <span className="text-base font-semibold text-amber-300">{foundGold} Gold</span>
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
