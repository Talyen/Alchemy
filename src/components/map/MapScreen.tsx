import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CircleHelp, Crown, Flame, ShoppingBag, Skull, Swords } from 'lucide-react'
import type { MapState, MapNodeType } from '@/types'
import { getAvailableNodes } from '@/mapgen'

// ─── Coordinate system ───────────────────────────────────────────────────────
// SVG viewBox "0 0 1000 600" + preserveAspectRatio="none" stretches to fill.
// Node div positions use the same 0–100% scale relative to the same container,
// so SVG paths and node circles are pixel-perfect aligned.

const W = 1000
const H = 600
const PAD_X = 120
const PAD_Y = 58
const PARCHMENT_TILE = 'assets/ui/map/slices/slots/slots_01_64x64.png'

function nodeX(row: number, rowCount: number) {
  if (rowCount <= 1) return W / 2
  return PAD_X + (row / (rowCount - 1)) * (W - PAD_X * 2)
}

function nodeY(col: number, colCount: number) {
  if (colCount <= 1) return H / 2
  const t = col / (colCount - 1)
  return H - PAD_Y - t * (H - PAD_Y * 2)
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cy = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`
}

// ─── Node config ─────────────────────────────────────────────────────────────

type NodeCfg = {
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  label: string
}

const NODE_CONFIG: Record<MapNodeType, NodeCfg> = {
  enemy:   { Icon: Swords,      color: '#a1a1aa', label: 'Combat'   },
  elite:   { Icon: Skull,       color: '#fb923c', label: 'Elite'    },
  rest:    { Icon: Flame,       color: '#4ade80', label: 'Campfire' },
  shop:    { Icon: ShoppingBag, color: '#60a5fa', label: 'Shop'     },
  mystery: { Icon: CircleHelp,  color: '#c4b5fd', label: 'Mystery'  },
  boss:    { Icon: Crown,       color: '#fbbf24', label: 'Boss'     },
}

// ─── MapScreen ───────────────────────────────────────────────────────────────

interface Props {
  map: MapState
  onNodeClick: (nodeId: string) => void
}

export function MapScreen({ map, onNodeClick }: Props) {
  const availableSet = useMemo(() => getAvailableNodes(map), [map])
  const visitedSet = useMemo(() => new Set(map.nodes.filter(n => n.visited).map(n => n.id)), [map])
  const isStartState = visitedSet.size === 0

  const colCount = useMemo(() => Math.max(...map.nodes.map(n => n.col)) + 1, [map])
  const rowCount = useMemo(() => Math.max(...map.nodes.map(n => n.row)) + 1, [map])

  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    map.nodes.forEach(node => {
      pos.set(node.id, {
        x: nodeX(node.row, rowCount),
        y: nodeY(node.col, colCount),
      })
    })
    return pos
  }, [map, colCount, rowCount])

  const paths = useMemo(() => {
    return map.nodes.flatMap(from =>
      from.connections
        .map(toId => {
          const to = map.nodes.find(n => n.id === toId)
          const p1 = positions.get(from.id)
          const p2 = positions.get(toId)
          if (!to || !p1 || !p2) return null

          const fromVisited = visitedSet.has(from.id)
          const toVisited = visitedSet.has(toId)
          const fromAvailable = availableSet.has(from.id)
          const toAvailable = availableSet.has(toId)
          const active =
            (fromVisited && (toVisited || toAvailable)) ||
            (isStartState && fromAvailable && to.col === from.col + 1)

          return {
            id: `${from.id}-${toId}`,
            d: bezier(p1.x, p1.y, p2.x, p2.y),
            active,
          }
        })
        .filter(Boolean),
    ) as { id: string; d: string; active: boolean }[]
  }, [map, positions, visitedSet, availableSet, isStartState])

  const nodeOrder = useMemo(
    () => [...map.nodes].sort((a, b) => a.col - b.col || a.row - b.row),
    [map],
  )

  const currentCol = useMemo(() => {
    if (isStartState) return 0
    return Math.max(...map.nodes.filter(n => n.visited).map(n => n.col)) + 1
  }, [map, isStartState])

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="relative flex flex-col rounded-2xl border border-zinc-800/60 overflow-hidden"
        style={{
          width: 'min(90vw, calc(90vh * (16 / 9)), 1280px)',
          aspectRatio: '16 / 9',
          backgroundImage: `url('${PARCHMENT_TILE}')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '64px 64px',
          backgroundColor: '#8f8877',
        }}
      >
        <div className="relative z-10 px-6 pt-5 pb-2 flex items-center justify-between border-b border-zinc-800/40">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-800">Route Map</p>
            <p className="text-sm text-zinc-900">Choose a path upward through the dungeon</p>
          </div>
          <div className="text-[11px] text-zinc-800 uppercase tracking-wider">
            Depth {Math.min(colCount, Math.max(1, currentCol + 1))} / {colCount}
          </div>
        </div>

        {/* SVG paths + node divs share the same flex-1 container for alignment */}
        <div className="relative z-10 flex-1">

          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-4 left-5 right-5 h-14"
              style={{
                backgroundImage: `url('${PARCHMENT_TILE}')`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '56px 56px',
                backgroundPosition: 'top center',
              }}
            />
            <div
              className="absolute bottom-5 left-5 right-5 h-12"
              style={{
                backgroundImage: `url('${PARCHMENT_TILE}')`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '56px 42px',
                backgroundPosition: 'bottom center',
              }}
            />
            <div
              className="absolute top-16 bottom-16 left-4 w-12"
              style={{
                backgroundImage: "url('assets/ui/map/slices/banner/banner_03_64x128.png')",
                backgroundRepeat: 'repeat-y',
                backgroundSize: '44px 88px',
                backgroundPosition: 'left center',
              }}
            />
            <div
              className="absolute top-16 bottom-16 right-4 w-12"
              style={{
                backgroundImage: "url('assets/ui/map/slices/banner/banner_04_64x128.png')",
                backgroundRepeat: 'repeat-y',
                backgroundSize: '44px 88px',
                backgroundPosition: 'right center',
              }}
            />

            <img
              src="assets/ui/map/slices/banner/banner_01_188x92.png"
              alt=""
              className="absolute top-3 left-4 w-40 select-none"
              draggable={false}
            />
            <img
              src="assets/ui/map/slices/banner/banner_02_172x98.png"
              alt=""
              className="absolute top-2 right-4 w-36 select-none"
              draggable={false}
            />
            <img
              src="assets/ui/map/slices/banner/banner_01_188x92.png"
              alt=""
              className="absolute bottom-3 left-5 w-40 select-none"
              draggable={false}
            />
            <img
              src="assets/ui/map/slices/banner/banner_02_172x98.png"
              alt=""
              className="absolute bottom-3 right-5 w-36 select-none"
              draggable={false}
            />
          </div>

          {/* Full route graph */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
          >
            {paths.map((p, i) => (
              <motion.path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.active ? '#1f2937' : '#374151'}
                strokeWidth={3.2}
                strokeDasharray="0 13"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: p.active ? 1 : 0.85 }}
                transition={{ duration: 0.35, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodeOrder.map((node, i) => {
            const pos     = positions.get(node.id)
            if (!pos) return null
            const isAvail = availableSet.has(node.id)
            const isVisited = visitedSet.has(node.id)
            const cfg     = NODE_CONFIG[node.type]
            const Icon    = cfg.Icon
            const size = isAvail ? 52 : isVisited ? 40 : 34

            return (
              <motion.div
                key={node.id}
                className="absolute"
                style={{
                  left:      `${(pos.x / W) * 100}%`,
                  top:       `${(pos.y / H) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22, delay: i * 0.07 + 0.15 }}
              >
                {/* Node circle */}
                <motion.div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width:         size,
                    height:        size,
                    background:    isAvail ? '#18181b' : isVisited ? '#3f3f46' : '#52525b',
                    border:        `2px solid ${cfg.color}`,
                    cursor:        isAvail ? 'pointer' : 'default',
                    pointerEvents: isAvail ? 'auto' : 'none',
                  }}
                  onClick={() => isAvail && onNodeClick(node.id)}
                  whileHover={isAvail ? { scale: 1.1, y: -4 } : {}}
                  whileTap={isAvail   ? { scale: 0.91 }        : {}}
                  transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                >
                  <Icon
                    size={isAvail ? 20 : isVisited ? 15 : 13}
                    style={{ color: isAvail ? cfg.color : isVisited ? `${cfg.color}aa` : `${cfg.color}50`, pointerEvents: 'none' }}
                  />
                </motion.div>

                {/* Label */}
                <p
                  className="absolute text-center whitespace-nowrap pointer-events-none"
                  style={{
                    top:           '100%',
                    left:          '50%',
                    transform:     'translateX(-50%)',
                    marginTop:     7,
                    fontSize:      isAvail ? 10 : isVisited ? 9 : 8,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color:         isAvail ? '#18181b' : isVisited ? '#3f3f46' : '#52525b',
                    fontWeight:    isAvail ? 600 : isVisited ? 500 : 400,
                  }}
                >
                  {cfg.label}
                </p>
              </motion.div>
            )
          })}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] text-zinc-800">
            Select a node to continue upward
          </div>

        </div>
      </div>
    </motion.div>
  )
}
