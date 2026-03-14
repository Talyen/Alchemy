import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Home, Menu, SkipForward, UserRound, XCircle } from 'lucide-react'

interface Props {
  onGoMainMenu: () => void
  onGoCharacterSelect: () => void
  onOpenCollection: () => void
  onOpenOptions: () => void
  musicEnabled?: boolean
  onToggleMusic?: () => void
  onEndRun?: () => void
  onEndTurnEarly?: () => void
  direction?: 'up' | 'down'
  align?: 'left' | 'right'
}

export function GlobalScreenMenu({
  onGoMainMenu,
  onGoCharacterSelect,
  onOpenCollection,
  onOpenOptions,
  musicEnabled,
  onToggleMusic,
  onEndRun,
  onEndTurnEarly,
  direction = 'down',
  align = 'left',
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative z-[140]">
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          data-ui-control
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 text-zinc-500"
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
              className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} w-60 rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5 ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
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
                  setOpen(false)
                  onOpenOptions()
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
              >
                <Menu size={14} className="text-zinc-500" />
                Options
              </button>

              {onToggleMusic && typeof musicEnabled === 'boolean' && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleMusic()
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
                >
                  <Menu size={14} className="text-zinc-500" />
                  {musicEnabled ? 'Music On' : 'Music Off'}
                </button>
              )}

              {onEndTurnEarly && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onEndTurnEarly()
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
                >
                  <SkipForward size={14} className="text-zinc-500" />
                  End Turn
                </button>
              )}

              {onEndRun && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onEndRun()
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900/90"
                >
                  <XCircle size={14} className="text-zinc-500" />
                  End Run
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
