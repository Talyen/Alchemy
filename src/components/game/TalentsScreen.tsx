import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { SelectionScreenShell } from './SelectionScreenShell'
import { KEYWORDS } from './keywordGlossary'
import { TALENT_KEYWORDS, type TalentKeyword, TALENT_ROOT_ID, canUnlockTalent, getTalentLinksForNodes, getTalentNodesForKeyword, getTalentThemeClasses } from '@/lib/talents'
import { Sparkles } from 'lucide-react'

type Props = {
  activeKeyword: TalentKeyword
  unlockedTalentNodeIds: Set<string>
  availableTalentPoints: number
  pointsProgress: number
  totalPointsEarned: number
  onChangeKeyword: (keyword: TalentKeyword) => void
  onUnlockTalent: (nodeId: string) => void
  onRespec: () => void
  onBack: () => void
  topLeft?: ReactNode
}

type NodePosition = { x: number; y: number }

const NODE_W = 146
const NODE_H = 118
const CANVAS_WIDTH = 760
const CANVAS_HEIGHT = 420

const ROW_Y: Record<0 | 1 | 2, number> = {
  2: 34,
  1: 164,
  0: 294,
}

const ROW_X: Record<0 | 1 | 2, number[]> = {
  2: [28, 212, 396, 580],
  1: [152, 458],
  0: [306],
}

function getNodePosition(row: 0 | 1 | 2, col: number): NodePosition {
  return { x: ROW_X[row][col] ?? ROW_X[row][0], y: ROW_Y[row] }
}

function getNodeCenter(position: NodePosition): NodePosition {
  return { x: position.x + NODE_W / 2, y: position.y + NODE_H / 2 }
}

export function TalentsScreen({
  activeKeyword,
  unlockedTalentNodeIds,
  availableTalentPoints,
  pointsProgress,
  totalPointsEarned,
  onChangeKeyword,
  onUnlockTalent,
  onRespec,
  onBack,
  topLeft,
}: Props) {
  const talentNodes = getTalentNodesForKeyword(activeKeyword)
  const talentLinks = getTalentLinksForNodes(talentNodes)

  const nodeById = useMemo(
    () => new Map(talentNodes.map(node => [node.id, node])),
    [talentNodes],
  )

  const positionedNodes = useMemo(() => {
    return talentNodes.map(node => ({
      ...node,
      position: node.id === TALENT_ROOT_ID
        ? getNodePosition(0, 0)
        : getNodePosition(node.row, node.col),
    }))
  }, [talentNodes])

  const positionById = useMemo(
    () => new Map(positionedNodes.map(node => [node.id, node.position])),
    [positionedNodes],
  )

  void nodeById

  return (
    <SelectionScreenShell title="Talents" subtitle="Passive Tree" topLeft={topLeft} layout="top" titleOffsetY={8}>
      <div className="w-full h-full min-h-0 max-w-6xl px-8 pb-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-zinc-200">Available Points: {availableTalentPoints}</p>
            <p className="text-[11px] text-zinc-400">Progress: {pointsProgress} / 10 cards played ({totalPointsEarned} earned total)</p>
          </div>

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

        <div className="flex flex-wrap items-center justify-center gap-2">
          {TALENT_KEYWORDS.map(keyword => {
            const isActive = keyword === activeKeyword
            const color = KEYWORDS[keyword]?.color ?? '#a1a1aa'
            return (
              <motion.button
                key={keyword}
                type="button"
                onClick={() => onChangeKeyword(keyword)}
                className="rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider"
                style={{
                  borderColor: isActive ? color : 'rgba(63,63,70,0.8)',
                  color: isActive ? color : 'rgba(161,161,170,0.9)',
                  background: isActive ? 'rgba(24,24,27,0.9)' : 'rgba(9,9,11,0.55)',
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {keyword}
              </motion.button>
            )
          })}
        </div>

        <div className="relative flex-1 overflow-visible">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
              <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="absolute left-0 top-0 pointer-events-none">
                {talentLinks.map(([fromId, toId]) => {
                  const fromPos = positionById.get(fromId)
                  const toPos = positionById.get(toId)
                  if (!fromPos || !toPos) return null
                  const fromNodeUnlocked = unlockedTalentNodeIds.has(fromId)
                  const toNodeUnlocked = unlockedTalentNodeIds.has(toId)
                  const fromCenter = getNodeCenter(fromPos)
                  const toCenter = getNodeCenter(toPos)
                  return (
                    <line
                      key={`${fromId}-${toId}`}
                      x1={fromCenter.x}
                      y1={fromCenter.y}
                      x2={toCenter.x}
                      y2={toCenter.y}
                      stroke={fromNodeUnlocked && toNodeUnlocked ? 'rgba(212,212,216,0.9)' : 'rgba(63,63,70,0.8)'}
                      strokeWidth={2.5}
                    />
                  )
                })}
              </svg>

              {positionedNodes.map(node => {
                const unlocked = unlockedTalentNodeIds.has(node.id)
                const unlockable = availableTalentPoints > 0 && canUnlockTalent(node.id, unlockedTalentNodeIds, talentNodes, talentLinks)
                const theme = getTalentThemeClasses(node.theme)

                return (
                  <motion.button
                    key={node.id}
                    type="button"
                    onClick={() => unlockable && onUnlockTalent(node.id)}
                    className={`absolute w-[146px] h-[118px] rounded-xl border-2 px-3 py-2 text-left ${unlocked ? theme.ring : 'border-zinc-700'} ${unlockable ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{ left: node.position.x, top: node.position.y, background: unlocked ? 'rgb(24,24,27)' : 'rgb(24,24,27)' }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={unlockable ? { scale: 0.97 } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const keywordName = node.keywords[0] ?? 'Wish'
                        const entry = KEYWORDS[keywordName]
                        if (!entry) return <Sparkles size={15} className="text-zinc-300" />
                        const KeywordIcon = entry.Icon
                        return <KeywordIcon size={15} style={{ color: entry.color }} />
                      })()}
                      <p className="text-[13px] leading-tight text-white font-semibold">{node.name}</p>
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-300">{node.description}</p>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </SelectionScreenShell>
  )
}
