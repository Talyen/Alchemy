import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  className?: string
  children: ReactNode
}

export function Modal({ open, onClose, className, children }: ModalProps) {
  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        // ui-allow-absolute: overlay behavior only
        <motion.div
          className="fixed inset-0 z-[145] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-zinc-950/72 backdrop-blur-[2px]" />
          <motion.div
            data-ui-container
            data-ui-boundary
            className={cn(
              'relative max-h-[80vh] w-full max-w-[1220px] overflow-auto rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-4',
              className,
            )}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.12 } }}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
