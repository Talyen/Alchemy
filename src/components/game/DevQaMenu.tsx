import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, ChevronsRight, LockOpen } from 'lucide-react'

interface Props {
  onSkipCombat: () => void
  onUnlockAll: () => void
  direction?: 'up' | 'down'
}

export function DevQaMenu({ onSkipCombat, onUnlockAll, direction = 'up' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative z-[140]">
      <motion.button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 p-2 text-zinc-500"
        whileHover={{ scale: 1.03, color: '#a1a1aa', borderColor: 'rgba(113,113,122,0.8)' }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        aria-label="Open QA menu"
      >
        <Bug size={14} />
      </motion.button>

      <AnimatePresence>
        {open && (
          // ui-allow-absolute: anchored QA flyout menu
          <motion.div
            className={`absolute right-0 w-56 rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5 ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSkipCombat()
              }}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
            >
              <ChevronsRight size={14} className="text-zinc-500" />
              Skip Combat
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onUnlockAll()
              }}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
            >
              <LockOpen size={14} className="text-zinc-500" />
              Unlock All
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
