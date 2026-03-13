import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldHalf } from 'lucide-react'

interface Props {
  current: number
  max: number
  color?: 'red' | 'green'
  block?: number
}

const trackColor = { red: 'bg-red-500', green: 'bg-emerald-500' }

export function HpBar({ current, max, color = 'red', block = 0 }: Props) {
  const [hovered, setHovered] = useState(false)
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const shieldPct = Math.max(0, Math.min(100, (block / max) * 100))

  return (
    <div
      className="w-full space-y-1 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover info row */}
      <div className="flex justify-between items-baseline h-4">
        <AnimatePresence>
          {hovered && (
            <motion.span
              key="hp-label"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest"
            >
              HP
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {hovered && (
            <motion.span
              key="hp-numbers"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-300"
            >
              {current}<span className="text-zinc-600">/{max}</span>
              {block > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <ShieldHalf size={10} className="text-sky-400" />
                  <span className="text-sky-300">{block}</span>
                </>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Bar track */}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden relative">
        {/* HP fill */}
        {/* ui-allow-absolute: internal fill layer */}
        <motion.div
          className={`h-full absolute left-0 top-0 rounded-full ${trackColor[color]}`}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {/* Shield overlay — blue tint on top of HP fill, clamped to 100% */}
        {/* ui-allow-absolute: internal shield overlay layer */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full bg-sky-400/55 pointer-events-none"
          animate={{ width: `${shieldPct}%`, opacity: block > 0 ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
