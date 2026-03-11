import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type CenterModalProps = {
  open: boolean
  onClose: () => void
  widthClassName?: string
  children: ReactNode
}

export function CenterModal({ open, onClose, widthClassName, children }: CenterModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[145] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-zinc-950/72 backdrop-blur-[2px]" />
          <motion.div
            className={`relative max-h-[80vh] rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-4 ${widthClassName ?? 'w-[min(94vw,1220px)]'}`}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.12 } }}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
