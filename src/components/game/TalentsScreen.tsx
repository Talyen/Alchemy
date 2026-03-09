import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SelectionScreenShell } from './SelectionScreenShell'
import { TALENT_LINKS, TALENT_NODES, canUnlockTalent, getTalentThemeClasses } from '@/lib/talents'
import { KEYWORDS } from './keywordGlossary'
import { Sparkles } from 'lucide-react'

const TALENT_NODE_SIZE = 68
const TALENT_CANVAS_WIDTH = 1600
const TALENT_CANVAS_HEIGHT = 1040
const MIN_ZOOM = 0.65
const MAX_ZOOM = 1.7

type Props = {
  unlockedTalentNodeIds: Set<string>
  availableTalentPoints: number
  onUnlockTalent: (nodeId: string) => void
  onRespec: () => void
  onBack: () => void
  topLeft?: ReactNode
}

function lineStyle(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  return {
    width: `${length}px`,
    transform: `translate(${from.x}px, ${from.y}px) rotate(${angle}deg)`,
  }
}

export function TalentsScreen({
  unlockedTalentNodeIds,
  availableTalentPoints,
  onUnlockTalent,
  onRespec,
  onBack,
  topLeft,
}: Props) {
  const hoveredNodeIds = TALENT_NODES.map(node => node.id)
  const nodeById = (nodeId: string) => TALENT_NODES.find(node => node.id === nodeId)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: -280, y: -120 })

  const updateZoom = (delta: number) => {
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((prev + delta).toFixed(2))))
      return next
    })
  }

  return (
    <SelectionScreenShell title="Talents" subtitle="Passive Tree" topLeft={topLeft} layout="top" titleOffsetY={8}>
      <div className="w-full h-full min-h-0 max-w-6xl px-8 pb-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-200">Available Points: {availableTalentPoints}</p>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={onRespec}
              className="rounded-lg border border-zinc-700/80 bg-zinc-900/85 px-3 py-2 text-xs text-zinc-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Respec
            </motion.button>
            <motion.button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-zinc-700/80 bg-zinc-900/85 px-3 py-2 text-xs text-zinc-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Back
            </motion.button>
          </div>
        </div>

        <div className="relative flex-1 rounded-2xl border border-zinc-800/70 bg-zinc-950/80 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(113,113,122,0.35) 1px, transparent 0)', backgroundSize: '20px 20px' }} />

          <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-2 py-1.5">
            <motion.button
              type="button"
              onClick={() => updateZoom(-0.1)}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/85 px-2 py-1 text-xs text-zinc-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              -
            </motion.button>
            <span className="text-xs text-zinc-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <motion.button
              type="button"
              onClick={() => updateZoom(0.1)}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/85 px-2 py-1 text-xs text-zinc-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              +
            </motion.button>
            <motion.button
              type="button"
              onClick={() => {
                setZoom(0.85)
                setPan({ x: -280, y: -120 })
              }}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/85 px-2 py-1 text-xs text-zinc-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Reset
            </motion.button>
          </div>

          <p className="absolute left-4 top-3 z-30 text-[10px] uppercase tracking-widest text-zinc-500">Drag to pan · Scroll to zoom</p>

          <div
            className="absolute inset-0"
            onWheel={(event) => {
              event.preventDefault()
              updateZoom(event.deltaY > 0 ? -0.06 : 0.06)
            }}
          >
            <motion.div
              className="absolute left-0 top-0"
              style={{ x: pan.x, y: pan.y, scale: zoom, width: TALENT_CANVAS_WIDTH, height: TALENT_CANVAS_HEIGHT, transformOrigin: '0 0' }}
              drag
              dragMomentum={false}
              dragElastic={0}
              onDragEnd={(_, info) => {
                setPan(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }))
              }}
            >
              <div className="absolute inset-0">
                {TALENT_LINKS.map(([a, b]) => {
                  const from = TALENT_NODES.find(node => node.id === a)
                  const to = TALENT_NODES.find(node => node.id === b)
                  if (!from || !to) return null
                  const style = lineStyle({ x: from.x + TALENT_NODE_SIZE / 2, y: from.y + TALENT_NODE_SIZE / 2 }, { x: to.x + TALENT_NODE_SIZE / 2, y: to.y + TALENT_NODE_SIZE / 2 })
                  const active = unlockedTalentNodeIds.has(a) && unlockedTalentNodeIds.has(b)
                  return (
                    <div
                      key={`${a}-${b}`}
                      className={`absolute h-[2px] origin-left ${active ? 'bg-zinc-300/80' : 'bg-zinc-700/70'}`}
                      style={style}
                    />
                  )
                })}
              </div>

              <div className="absolute inset-0">
                {TALENT_NODES.map(node => {
                  const unlocked = unlockedTalentNodeIds.has(node.id)
                  const unlockable = availableTalentPoints > 0 && canUnlockTalent(node.id, unlockedTalentNodeIds)
                  const theme = getTalentThemeClasses(node.theme)
                  return (
                    <motion.button
                      key={node.id}
                      type="button"
                      onClick={() => unlockable && onUnlockTalent(node.id)}
                      onHoverStart={() => setHoveredNodeId(node.id)}
                      onHoverEnd={() => setHoveredNodeId(current => (current === node.id ? null : current))}
                      className={`absolute w-[68px] h-[68px] rounded-full border-2 backdrop-blur-sm ${unlocked ? theme.ring : 'border-zinc-700/80'} ${unlockable ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ left: node.x, top: node.y, background: unlocked ? theme.glow : 'rgba(24,24,27,0.66)' }}
                      whileHover={{ scale: 1.06 }}
                      whileTap={unlockable ? { scale: 0.97 } : undefined}
                    >
                      <div className="flex h-full w-full items-center justify-center gap-1 px-1">
                        {node.keywords.slice(0, 2).map(keyword => {
                          const entry = KEYWORDS[keyword]
                          if (!entry) {
                            return <Sparkles key={`${node.id}-${keyword}`} size={14} className="text-zinc-300" />
                          }
                          const KeywordIcon = entry.Icon
                          return <KeywordIcon key={`${node.id}-${keyword}`} size={14} style={{ color: entry.color }} />
                        })}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {hoveredNodeId && hoveredNodeIds.includes(hoveredNodeId) && (() => {
              const node = nodeById(hoveredNodeId)
              if (!node) return null
              return (
                <motion.div
                  className="absolute left-4 bottom-4 w-[360px] rounded-xl border border-zinc-700/80 bg-zinc-950/95 px-4 py-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                >
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Node Effect</p>
                  <p className="mt-1 text-sm text-zinc-100">{node.name}</p>
                  <p className="mt-1 text-xs text-zinc-300">{node.description}</p>
                </motion.div>
              )
            })()}
          </AnimatePresence>
        </div>
      </div>
    </SelectionScreenShell>
  )
}
