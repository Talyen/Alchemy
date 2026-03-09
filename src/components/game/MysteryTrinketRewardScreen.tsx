import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SelectionScreenShell } from './SelectionScreenShell'
import { TrinketInfoCard } from './TrinketInfoCard'

interface Props {
  trinketName: string
  trinketIconSrc: string
  trinketDescription?: string
  onContinue: () => void
  topLeft?: ReactNode
}

export function MysteryTrinketRewardScreen({ trinketName, trinketIconSrc, trinketDescription = 'A loyal companion strikes at the end of your turn.', onContinue, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Reward" subtitle="He's Just a Little Guy" topLeft={topLeft} allowOverflowVisible>
      <div className="w-full max-w-3xl -mt-4 flex flex-col items-center gap-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Received:</p>

        <motion.div
          className="w-64"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <TrinketInfoCard
            name={trinketName}
            description={trinketDescription}
            iconSrc={trinketIconSrc}
          />
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
