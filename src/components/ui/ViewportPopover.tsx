import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { PopoverPosition } from '@/lib/viewportPopover'
import { cn } from '@/lib/utils'

interface ViewportPopoverProps {
  open: boolean
  position: PopoverPosition | null
  className?: string
  children: ReactNode
}

export function ViewportPopover({ open, position, className, children }: ViewportPopoverProps) {
  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        // ui-allow-absolute: viewport portal popover positioning
        <motion.div
          className={cn('fixed', className)}
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, x: '-50%', y: position?.placeAbove ? '-100%' : '0%' }}
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.1, ease: 'easeIn' } }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
