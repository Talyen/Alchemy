import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle: string
  children: ReactNode
  layout?: 'center' | 'top'
  topLeft?: ReactNode
  titleOffsetY?: number
  allowOverflowVisible?: boolean
}

export const staggerContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.93 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
}

export function SelectionScreenShell({ title, subtitle, children, layout = 'center', topLeft, titleOffsetY = 0, allowOverflowVisible = false }: Props) {
  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`relative flex flex-col items-center bg-zinc-950 ${allowOverflowVisible ? 'overflow-visible' : 'overflow-hidden'} ${layout === 'top' ? 'justify-start pt-10 gap-6' : 'justify-center gap-10'}`}
        style={{ width: 'min(95vw, calc(94vh * (16 / 9)), 1440px)', aspectRatio: '16 / 9' }}
      >
        {topLeft ? <div className="absolute right-6 bottom-6 z-50">{topLeft}</div> : null}

        <motion.div
          className="flex flex-col items-center gap-1.5"
          style={{ transform: `translateY(${titleOffsetY}px)` }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">{subtitle}</p>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{title}</h2>
        </motion.div>

        {children}
      </div>
    </motion.div>
  )
}
