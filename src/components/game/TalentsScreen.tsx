import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { SelectionScreenShell } from './SelectionScreenShell'
import { KEYWORDS } from './keywordGlossary'
import { TALENT_KEYWORDS, type TalentKeyword, TALENT_ROOT_ID, canUnlockTalent, getTalentLinksForNodes, getTalentNodesForKeyword, getTalentThemeClasses } from '@/lib/talents'
import { Sparkles } from 'lucide-react'
import { NotificationDot } from '@/ui/primitives'

type Props = {
  activeKeyword: TalentKeyword
  unlockedTalentNodeIds: Set<string>
  availableTalentPoints: number
  pointsProgress: number
  totalPointsEarned: number
  hasUnspentByKeyword: Record<TalentKeyword, boolean>
  onChangeKeyword: (keyword: TalentKeyword) => void
  onUnlockTalent: (nodeId: string) => void
  onRespec: () => void
  onBack: () => void
  topLeft?: ReactNode
}

type NodePosition = { x: number; y: number }

const NODE_W = 172
const NODE_H = 114
const CANVAS_WIDTH = 980
const CANVAS_HEIGHT = 560

const ROW_Y: Record<0 | 1 | 2, number> = {
  2: 44,
  1: 222,
  0: 400,
}

const ROW_X: Record<0 | 1 | 2, number[]> = {
  2: [58, 288, 518, 748],
  1: [173, 633],
  0: [403],
}

function getNodePosition(row: 0 | 1 | 2, col: number): NodePosition {
  return { x: ROW_X[row][col] ?? ROW_X[row][0], y: ROW_Y[row] }
}

function getNodeCenter(position: NodePosition): NodePosition {
  return { x: position.x + NODE_W / 2, y: position.y + NODE_H / 2 }
}

function getLinkPath(from: NodePosition, to: NodePosition): string {
  const cpY = (from.y + to.y) / 2
  return `M ${from.x} ${from.y} C ${from.x} ${cpY} ${to.x} ${cpY} ${to.x} ${to.y}`
}

export function TalentsScreen({
  activeKeyword,
  unlockedTalentNodeIds,
  availableTalentPoints,
  pointsProgress,
  totalPointsEarned,
  hasUnspentByKeyword,
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
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-zinc-100">Available Points: {availableTalentPoints}</p>
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

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {TALENT_KEYWORDS.map(keyword => {
            const isActive = keyword === activeKeyword
            const color = KEYWORDS[keyword]?.color ?? '#a1a1aa'
            return (
              <motion.button
                key={keyword}
                type="button"
                onClick={() => onChangeKeyword(keyword)}
                className="relative rounded-xl border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: isActive ? color : 'rgba(63,63,70,0.8)',
                  color: isActive ? color : 'rgba(161,161,170,0.9)',
                  background: isActive ? 'rgba(24,24,27,0.95)' : 'rgba(9,9,11,0.62)',
                  boxShadow: isActive ? `0 0 0 1px ${color}33 inset` : 'none',
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {keyword}
                {hasUnspentByKeyword[keyword] && (
                  <NotificationDot className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2 w-2" testId={`talents-keyword-dot-${keyword}`} />
                )}
              </motion.button>
            )
          })}
        </div>

        <div className="relative flex-1 overflow-visible">
          {/* ui-allow-absolute: fixed canvas positioning for talent graph */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5"
              data-testid="talent-canvas"
              style={{ width: CANVAS_WIDTH + 40, height: CANVAS_HEIGHT + 40 }}
            >
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
                    <path
                      key={`${fromId}-${toId}`}
                      d={getLinkPath(fromCenter, toCenter)}
                      fill="none"
                      stroke={fromNodeUnlocked && toNodeUnlocked ? 'rgba(212,212,216,0.9)' : 'rgba(63,63,70,0.8)'}
                      strokeWidth={fromNodeUnlocked && toNodeUnlocked ? 3 : 2.5}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>

              {positionedNodes.map(node => {
                const unlocked = unlockedTalentNodeIds.has(node.id)
                const unlockable = availableTalentPoints > 0 && canUnlockTalent(node.id, unlockedTalentNodeIds, talentNodes, talentLinks)
                const reachable = unlocked || unlockable || node.id === TALENT_ROOT_ID
                const theme = getTalentThemeClasses(node.theme)

                return (
                  // ui-allow-fixed-size: talent node card dimensions are graph design constraints
                  <motion.button
                    key={node.id}
                    type="button"
                    onClick={() => unlockable && onUnlockTalent(node.id)}
                    data-testid={`talent-node-${node.id}`}
                    data-keyword-count={node.keywords.length}
                    data-unlocked={unlocked ? 'true' : 'false'}
                    data-unlockable={unlockable ? 'true' : 'false'}
                    className={`absolute w-[172px] h-[114px] rounded-2xl border-2 px-3.5 py-3 text-left ${unlocked ? theme.ring : 'border-zinc-700/85'} ${unlockable ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      background: unlocked ? 'rgb(39 39 42)' : 'rgb(24 24 27)',
                      boxShadow: unlocked
                        ? '0 0 0 1px rgba(161,161,170,0.16), 0 8px 24px rgba(0,0,0,0.38)'
                        : '0 6px 18px rgba(0,0,0,0.34)',
                      filter: reachable ? 'none' : 'saturate(0.72) brightness(0.86)',
                    }}
                    whileHover={unlockable ? { scale: 1.04 } : { scale: 1.015 }}
                    whileTap={unlockable ? { scale: 0.97 } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1" data-testid={`talent-node-icons-${node.id}`}>
                        {node.keywords.map((keywordName, index) => {
                          const entry = KEYWORDS[keywordName]
                          if (!entry) {
                            return <Sparkles key={`${node.id}-${keywordName}-${index}`} size={15} className="text-zinc-300" />
                          }
                          const KeywordIcon = entry.Icon
                          return <KeywordIcon key={`${node.id}-${keywordName}-${index}`} size={15} style={{ color: entry.color }} />
                        })}
                      </div>
                      <p className="text-[13px] leading-tight text-zinc-100 font-semibold">{node.name}</p>
                    </div>
                    <p className={`mt-2.5 text-[11px] leading-snug ${reachable ? 'text-zinc-300' : 'text-zinc-500'}`}>{node.description}</p>
                  </motion.button>
                )
              })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SelectionScreenShell>
  )
}
