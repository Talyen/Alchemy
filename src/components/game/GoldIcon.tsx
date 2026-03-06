import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  size?: number
  className?: string
  glimmer?: boolean
}

export function GoldIcon({ size = 14, className, glimmer = true }: Props) {
  const ring = Math.max(1, Math.round(size * 0.08))

  return (
    <span
      className={cn('relative inline-flex shrink-0 rounded-full overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        border: `${ring}px solid rgba(202,138,4,0.9)`,
        background: 'radial-gradient(circle at 32% 30%, #fde68a 0%, #facc15 45%, #ca8a04 82%)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      }}
      aria-hidden
    >
      <span
        className="absolute rounded-full"
        style={{
          left: '18%',
          top: '14%',
          width: '28%',
          height: '28%',
          background: 'rgba(255,255,255,0.44)',
          filter: 'blur(0.2px)',
        }}
      />

      {glimmer && (
        <motion.span
          className="absolute inset-y-0 w-[28%]"
          style={{
            left: '-36%',
            background:
              'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 48%, rgba(255,255,255,0) 100%)',
            mixBlendMode: 'screen',
          }}
          animate={{ x: ['0%', '380%'] }}
          transition={{ duration: 0.72, repeat: Infinity, repeatDelay: 2.8, ease: [0.3, 0, 0.7, 1] }}
        />
      )}
    </span>
  )
}
