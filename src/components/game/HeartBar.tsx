import { motion } from 'framer-motion'

interface Props {
  current: number
  max: number
  color?: 'red' | 'green'
  block?: number
}

const hpColors = {
  red:   '#b91c1c',
  green: '#15803d',
}

const SECTION_HP = 10

export function HeartBar({ current, max, color = 'red', block = 0 }: Props) {
  const hpPct      = Math.max(0, Math.min(current / max, 1)) * 100
  const dividers   = Math.ceil(max / SECTION_HP) - 1

  // Shield overlays the rightmost portion of the HP fill so it's always visible
  const shieldWidth = Math.min(block, current) / max * 100
  const shieldLeft  = Math.max(0, current - Math.min(block, current)) / max * 100

  return (
    <div className="relative w-full max-w-36 mx-auto h-3 rounded-full bg-zinc-800 overflow-hidden">
      {/* HP fill */}
      {/* ui-allow-absolute: internal fill layer */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ background: hpColors[color] }}
        animate={{ width: `${hpPct}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      />
      {/* Shield — overlays right portion of HP bar, always visible when block > 0 */}
      {block > 0 && current > 0 && (
        // ui-allow-absolute: internal shield overlay layer
        <motion.div
          className="absolute inset-y-0 bg-blue-600/75"
          animate={{ left: `${shieldLeft}%`, width: `${shieldWidth}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        />
      )}
      {/* Section dividers */}
      {Array.from({ length: dividers }, (_, i) => (
        // ui-allow-absolute: internal divider ticks
        <div
          key={i}
          className="absolute inset-y-0 w-0.5 bg-zinc-950/80"
          style={{ left: `${((i + 1) * SECTION_HP / max) * 100}%` }}
        />
      ))}
    </div>
  )
}
