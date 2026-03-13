import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { CircleHelp, FlaskConical, Flame, ShoppingBag, Skull, Swords } from 'lucide-react'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'

export type DestinationType = 'enemy' | 'elite' | 'rest' | 'shop' | 'mystery' | 'alchemy'

export type DestinationOption = {
  type: DestinationType
  title: string
  subtitle: string
}

interface Props {
  options: DestinationOption[]
  onChoose: (type: DestinationType) => void
  topLeft?: ReactNode
}

const ICONS = {
  enemy: Swords,
  elite: Skull,
  rest: Flame,
  shop: ShoppingBag,
  mystery: CircleHelp,
  alchemy: FlaskConical,
} as const

const COLORS = {
  enemy: '#f87171',
  elite: '#f87171',
  rest: '#4ade80',
  shop: '#fbbf24',
  mystery: '#c4b5fd',
  alchemy: '#34d399',
} as const

function pathToChoice(choiceIndex: number) {
  const startX = 50
  const startY = -7
  const targetXs = [18, 50, 82]
  const endX = targetXs[choiceIndex] ?? 50
  const endY = 40
  const curveY = 14
  return `M ${startX} ${startY} C ${startX} ${curveY} ${endX} ${curveY - 6} ${endX} ${endY}`
}

function DestinationPanel({
  option,
  index,
  hovered,
  onHoverStart,
  onHoverEnd,
  onChoose,
}: {
  option: DestinationOption
  index: number
  hovered: number | null
  onHoverStart: (index: number) => void
  onHoverEnd: (index: number) => void
  onChoose: (type: DestinationType) => void
}) {
  const Icon = ICONS[option.type]
  const color = COLORS[option.type]
  const isHovered = hovered === index

  const rawX = useMotionValue(0.5)
  const rawY = useMotionValue(0.5)
  const rotateY = useSpring(useTransform(rawX, [0, 1], [-8, 8]), { stiffness: 420, damping: 34 })
  const rotateX = useSpring(useTransform(rawY, [0, 1], [6, -6]), { stiffness: 420, damping: 34 })

  return (
    <motion.button
      type="button"
      variants={staggerItemVariants}
      className="w-64 rounded-2xl border-2 bg-zinc-950 p-5 text-left"
      onMouseEnter={() => onHoverStart(index)}
      onMouseLeave={() => {
        onHoverEnd(index)
        rawX.set(0.5)
        rawY.set(0.5)
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        rawX.set((event.clientX - rect.left) / rect.width)
        rawY.set((event.clientY - rect.top) / rect.height)
      }}
      onClick={() => onChoose(option.type)}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
        borderColor: isHovered ? color : `${color}80`,
        boxShadow: isHovered ? `0 0 0 1px ${color}55 inset` : 'none',
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={16} style={{ color }} />
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color }}>{option.title}</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{option.subtitle}</p>
    </motion.button>
  )
}

export function ChooseDestinationScreen({ options, onChoose, topLeft }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const hoverLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleHoverStart = (index: number) => {
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current)
      hoverLeaveTimeoutRef.current = null
    }
    setHoveredIndex(index)
  }

  const handleHoverEnd = (index: number) => {
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current)
    }
    hoverLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(curr => (curr === index ? null : curr))
      hoverLeaveTimeoutRef.current = null
    }, 90)
  }

  return (
    <SelectionScreenShell title="Choose Destination" subtitle="Travel" topLeft={topLeft}>
      <div className="relative w-full h-[62%] max-w-5xl">
          {/* ui-allow-absolute: decorative route guide path layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              d={pathToChoice(hoveredIndex ?? 1)}
              fill="none"
              stroke="#b89b72"
              strokeWidth={0.36}
              strokeDasharray="1 5"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{
                d: pathToChoice(hoveredIndex ?? 1),
                opacity: hoveredIndex === null ? 0 : 0.55,
                strokeDashoffset: [0, -6],
              }}
              transition={{
                d: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.16 },
                strokeDashoffset: { duration: 2.2, repeat: Infinity, ease: 'linear' },
              }}
            />
          </svg>

          {/* ui-allow-absolute: full-area option layout overlay */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center gap-10 px-10"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {options.map((opt, i) => (
              <DestinationPanel
                key={`${opt.type}-${i}`}
                option={opt}
                index={i}
                hovered={hoveredIndex}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
                onChoose={onChoose}
              />
            ))}
          </motion.div>
      </div>
    </SelectionScreenShell>
  )
}
