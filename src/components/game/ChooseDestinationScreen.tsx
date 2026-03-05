import { useState, type Dispatch, type SetStateAction } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { CircleHelp, Flame, ShoppingBag, Skull, Swords } from 'lucide-react'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'

export type DestinationType = 'enemy' | 'elite' | 'rest' | 'shop' | 'mystery'

export type DestinationOption = {
  type: DestinationType
  title: string
  subtitle: string
}

interface Props {
  currentRoomLabel: string
  options: DestinationOption[]
  onChoose: (type: DestinationType) => void
}

const ICONS = {
  enemy: Swords,
  elite: Skull,
  rest: Flame,
  shop: ShoppingBag,
  mystery: CircleHelp,
} as const

const COLORS = {
  enemy: '#f87171',
  elite: '#f87171',
  rest: '#4ade80',
  shop: '#fbbf24',
  mystery: '#c4b5fd',
} as const

function pathToChoice(choiceIndex: number) {
  const startX = 50
  const startY = 84
  const targetXs = [20, 50, 80]
  const endX = targetXs[choiceIndex] ?? 50
  const endY = 24
  const curveY = 58
  return `M ${startX} ${startY} C ${startX} ${curveY} ${endX} ${curveY - 6} ${endX} ${endY}`
}

function DestinationPanel({
  option,
  index,
  hovered,
  setHovered,
  onChoose,
}: {
  option: DestinationOption
  index: number
  hovered: number | null
  setHovered: Dispatch<SetStateAction<number | null>>
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
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => {
        setHovered(curr => (curr === index ? null : curr))
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

export function ChooseDestinationScreen({ currentRoomLabel, options, onChoose }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <SelectionScreenShell title="Choose Destination" subtitle="Travel">
      <div className="relative w-full h-[62%] max-w-5xl">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {options.map((opt, i) => {
              const isHovered = hoveredIndex === i
              if (!isHovered) return null
              return (
                <motion.path
                  key={opt.type}
                  d={pathToChoice(i)}
                  fill="none"
                  stroke="#a1a1aa"
                  strokeWidth={0.42}
                  strokeDasharray="0 2.2"
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.95, strokeDashoffset: [0, -8] }}
                  transition={{ opacity: { duration: 0.15 }, strokeDashoffset: { duration: 0.75, repeat: Infinity, ease: 'linear' } }}
                />
              )
            })}
          </svg>

          <motion.div
            className="absolute top-[8%] left-0 right-0 flex items-start justify-center gap-10 px-10"
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
                setHovered={setHoveredIndex}
                onChoose={onChoose}
              />
            ))}
          </motion.div>

          <div className="absolute bottom-[9%] left-1/2 -translate-x-1/2 w-64">
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Current Room</p>
              <p className="text-sm text-zinc-200 font-semibold uppercase tracking-wider">{currentRoomLabel}</p>
            </div>
          </div>
      </div>
    </SelectionScreenShell>
  )
}
