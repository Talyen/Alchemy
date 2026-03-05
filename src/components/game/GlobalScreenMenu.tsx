import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Home, Menu, Music, Music2, UserRound } from 'lucide-react'

interface Props {
  onGoMainMenu: () => void
  onGoCharacterSelect: () => void
  onOpenCollection: () => void
  musicEnabled: boolean
  onToggleMusic: () => void
}

export function GlobalScreenMenu({
  onGoMainMenu,
  onGoCharacterSelect,
  onOpenCollection,
  musicEnabled,
  onToggleMusic,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative z-[140]">
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 p-2 text-zinc-500"
          whileHover={{ scale: 1.03, color: '#a1a1aa', borderColor: 'rgba(113,113,122,0.8)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          aria-label="Open main menu"
        >
          <Menu size={14} />
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="absolute left-0 top-full mt-2 w-60 rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onGoMainMenu()
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
              >
                <Home size={14} className="text-zinc-500" />
                Main Menu
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onGoCharacterSelect()
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
              >
                <UserRound size={14} className="text-zinc-500" />
                Character Select
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenCollection()
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
              >
                <BookOpen size={14} className="text-zinc-500" />
                Collection
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMusic()
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
              >
                {musicEnabled ? <Music2 size={14} className="text-zinc-500" /> : <Music size={14} className="text-zinc-500" />}
                {musicEnabled ? 'Music On' : 'Music Off'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
