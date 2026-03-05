import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle: string
  children: ReactNode
  layout?: 'center' | 'top'
  topLeft?: ReactNode
}

export const staggerContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.93 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
}

export function SelectionScreenShell({ title, subtitle, children, layout = 'center', topLeft }: Props) {
  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`relative flex flex-col items-center rounded-2xl border border-zinc-800/60 bg-zinc-950 ${layout === 'top' ? 'overflow-visible justify-start pt-8 gap-6' : 'overflow-hidden justify-center gap-10'}`}
        style={{ width: 'min(95vw, calc(94vh * (16 / 9)), 1440px)', aspectRatio: '16 / 9' }}
      >
        {topLeft ? <div className="absolute left-0 top-0 z-50">{topLeft}</div> : null}

        <motion.div
          className="flex flex-col items-center gap-1.5"
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
