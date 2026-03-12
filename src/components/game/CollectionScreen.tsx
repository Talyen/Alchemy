import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CardDef, CardInstance } from '@/types'
import type { BestiaryEnemy } from '@/data'
import { Card } from './Card'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'
import { BESTIARY_Y_OFFSET, PRISMATIC_ENEMY_IDS, getEnemyRelativeScale } from './enemyVisualConfig'
import { playCardPlay } from '@/sounds'
import { TrinketInfoCard } from './TrinketInfoCard'
import { getViewportPopoverPosition } from '@/lib/viewportPopover'

interface Props {
  cards: CardDef[]
  enemies: BestiaryEnemy[]
  trinkets: Array<{ id: string; name: string; description: string; iconSrc?: string }>
  encounteredCardIds: Set<string>
  encounteredEnemyIds: Set<string>
  encounteredTrinketIds: Set<string>
  initialTab?: CollectionTab
  onBack: () => void
  topLeft?: ReactNode
}

export type CollectionTab = 'cards' | 'bestiary' | 'trinkets'

const CARDS_PER_PAGE = 8
const ENEMIES_PER_PAGE = 8
const TRINKETS_PER_PAGE = 8
const ENEMY_FPS = 8

const BESTIARY_SPRITE_SOURCE_BY_ID: Partial<Record<string, string>> = {
  greater_mimic: 'mimic',
  greater_slime: 'swampy',
  frost_imp: 'imp',
  blood_goblin: 'goblin',
  blood_shaman: 'orc_shaman',
  mirror_shade: 'shade',
  prismatic_slug: 'slug',
  prismatic_skull: 'flaming_skull',
  prismatic_shade: 'shade',
  prismatic_greater_mimic: 'mimic',
  prismatic_greater_slime: 'swampy',
}

const BESTIARY_TINT_FILTER_BY_ID: Partial<Record<string, string>> = {
  frost_imp: 'hue-rotate(165deg) saturate(1.3) brightness(1.08)',
  blood_goblin: 'hue-rotate(338deg) saturate(1.7) brightness(1.02)',
  blood_shaman: 'hue-rotate(338deg) saturate(1.55) brightness(1.03)',
  mirror_shade: 'saturate(0.28) brightness(1.28) contrast(1.18)',
  prismatic_slug: 'hue-rotate(220deg) saturate(2.2) brightness(1.08)',
  prismatic_skull: 'hue-rotate(255deg) saturate(2.1) brightness(1.1)',
  prismatic_shade: 'hue-rotate(285deg) saturate(2.3) brightness(1.12)',
  prismatic_greater_mimic: 'hue-rotate(240deg) saturate(2.0) brightness(1.08)',
  prismatic_greater_slime: 'hue-rotate(205deg) saturate(2.25) brightness(1.05)',
}

const PRISMATIC_FILTER_KEYFRAMES = [
  'hue-rotate(0deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(90deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(180deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(270deg) saturate(2.15) brightness(1.06)',
  'hue-rotate(360deg) saturate(2.15) brightness(1.06)',
]

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

function getIdleFrames(enemyId: string): string[] {
  const spriteId = BESTIARY_SPRITE_SOURCE_BY_ID[enemyId] ?? enemyId
  return Array.from({ length: 4 }, (_, i) => `assets/enemies/${spriteId}-idle-f${i}.png`)
}

export function CollectionScreen({
  cards,
  enemies,
  trinkets,
  encounteredCardIds,
  encounteredEnemyIds,
  encounteredTrinketIds,
  initialTab = 'cards',
  onBack,
  topLeft,
}: Props) {
  void onBack
  const [activeTab, setActiveTab] = useState<CollectionTab>(initialTab)
  const [cardPage, setCardPage] = useState(0)
  const [enemyPage, setEnemyPage] = useState(0)
  const [trinketPage, setTrinketPage] = useState(0)
  const [frameIdx, setFrameIdx] = useState(0)
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null)
  const [hoveredEnemyTooltip, setHoveredEnemyTooltip] = useState<{ left: number; top: number; placeAbove: boolean } | null>(null)
  const hoveredEnemyAnchorRef = useState<Element | null>(null)
  const [hoveredEnemyAnchor, setHoveredEnemyAnchor] = hoveredEnemyAnchorRef

  const updateEnemyTooltipPosition = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return
    const rect = target.getBoundingClientRect()
    setHoveredEnemyTooltip(getViewportPopoverPosition(rect, { width: 256 }))
  }

  useEffect(() => {
    if (!hoveredEnemyId || !hoveredEnemyAnchor) return
    const update = () => updateEnemyTooltipPosition(hoveredEnemyAnchor)
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [hoveredEnemyId, hoveredEnemyAnchor])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % 4)
    }, 1000 / ENEMY_FPS)
    return () => clearInterval(id)
  }, [])

  const totalCardPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE))
  const totalEnemyPages = Math.max(1, Math.ceil(enemies.length / ENEMIES_PER_PAGE))
  const totalTrinketPages = Math.max(1, Math.ceil(trinkets.length / TRINKETS_PER_PAGE))

  const totalPages =
    activeTab === 'cards'
      ? totalCardPages
      : activeTab === 'bestiary'
        ? totalEnemyPages
        : totalTrinketPages

  const subtitle = activeTab === 'cards' ? 'Cards' : activeTab === 'bestiary' ? 'Bestiary' : 'Trinkets'

  const pageCards = useMemo(() => {
    const start = cardPage * CARDS_PER_PAGE
    return cards.slice(start, start + CARDS_PER_PAGE)
  }, [cards, cardPage])

  const pageEnemies = useMemo(() => {
    const start = enemyPage * ENEMIES_PER_PAGE
    return enemies.slice(start, start + ENEMIES_PER_PAGE)
  }, [enemies, enemyPage])

  const pageTrinkets = useMemo(() => {
    const start = trinketPage * TRINKETS_PER_PAGE
    return trinkets.slice(start, start + TRINKETS_PER_PAGE)
  }, [trinkets, trinketPage])

  const prevPage = () => {
    if (activeTab === 'cards') {
      setCardPage(prev => (prev - 1 + totalCardPages) % totalCardPages)
      return
    }
    if (activeTab === 'bestiary') {
      setEnemyPage(prev => (prev - 1 + totalEnemyPages) % totalEnemyPages)
      setHoveredEnemyId(null)
      return
    }
    setTrinketPage(prev => (prev - 1 + totalTrinketPages) % totalTrinketPages)
  }

  const nextPage = () => {
    if (activeTab === 'cards') {
      setCardPage(prev => (prev + 1) % totalCardPages)
      return
    }
    if (activeTab === 'bestiary') {
      setEnemyPage(prev => (prev + 1) % totalEnemyPages)
      setHoveredEnemyId(null)
      return
    }
    setTrinketPage(prev => (prev + 1) % totalTrinketPages)
  }

  return (
    <SelectionScreenShell
      title="Collections"
      subtitle={subtitle}
      topLeft={topLeft}
      layout="top"
      titleOffsetY={0}
      allowOverflowVisible
    >
      <div className="w-full px-8 pt-5">
        <div className="relative mx-auto w-[960px]">
          <div className="mb-5 flex items-center justify-center gap-2">
            {(['cards', 'bestiary', 'trinkets'] as const).map(tab => {
              const isActive = activeTab === tab
              const label = tab === 'cards' ? 'Cards' : tab === 'bestiary' ? 'Bestiary' : 'Trinkets'
              return (
                <motion.button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-lg border text-xs uppercase tracking-wider"
                  style={{
                    borderColor: isActive ? 'rgba(161,161,170,0.65)' : 'rgba(63,63,70,0.7)',
                    color: isActive ? '#e4e4e7' : '#71717a',
                    background: isActive ? 'rgba(39,39,42,0.85)' : 'rgba(24,24,27,0.55)',
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                >
                  {label}
                </motion.button>
              )
            })}
          </div>

          <div className="relative">
            {totalPages > 1 && (
              <motion.button
                type="button"
                aria-label="Previous page"
                onClick={prevPage}
                className="absolute -left-16 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 p-2 text-zinc-500"
                whileHover={{ scale: 1.04, color: '#a1a1aa', borderColor: 'rgba(113,113,122,0.8)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              >
                <ChevronLeft size={16} />
              </motion.button>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'cards' && (
                <motion.div
                  key={`cards-${cardPage}`}
                  className="grid grid-cols-4 grid-rows-2 gap-6 justify-items-center"
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
                >
                  {pageCards.map((def, i) => {
                    const isEncountered = encounteredCardIds.has(def.id)
                    return (
                      <motion.div
                        key={`${def.id}-${cardPage}-${i}`}
                        variants={staggerItemVariants}
                        onClick={() => {
                          if (!isEncountered) return
                          playCardPlay(def.id, def.type)
                        }}
                        whileTap={{ scale: isEncountered ? 0.98 : 1 }}
                        style={{ cursor: isEncountered ? 'pointer' : 'default' }}
                        className="relative"
                      >
                        <div style={{ filter: isEncountered ? 'none' : 'grayscale(1) contrast(0.82) brightness(0.55)', opacity: isEncountered ? 1 : 0.58 }}>
                          <Card card={toInstance(def, `collection-${cardPage}-${i}`)} playable keywordTooltipEnabled={isEncountered} />
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}

              {activeTab === 'bestiary' && (
                <motion.div
                  key={`bestiary-${enemyPage}`}
                  className="grid grid-cols-4 grid-rows-2 gap-6"
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
                >
                  {pageEnemies.map((enemy, i) => {
                    const isEncountered = encounteredEnemyIds.has(enemy.id)
                    const frames = getIdleFrames(enemy.id)
                    const frameSrc = frames[frameIdx % frames.length]
                    const spriteSize = Math.round(80 * getEnemyRelativeScale(enemy.id))
                    const spriteBaseY = BESTIARY_Y_OFFSET[enemy.id] ?? -10
                    const tintFilter = BESTIARY_TINT_FILTER_BY_ID[enemy.id]
                    const isPrismatic = PRISMATIC_ENEMY_IDS.has(enemy.id)

                    return (
                      <motion.button
                        key={`${enemy.id}-${enemyPage}-${i}`}
                        type="button"
                        className="group relative h-44 rounded-xl border border-zinc-800/70 bg-zinc-900/35 px-3 py-2"
                        variants={staggerItemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        onMouseEnter={(event) => {
                          if (!isEncountered) return
                          setHoveredEnemyId(enemy.id)
                          setHoveredEnemyAnchor(event.currentTarget)
                          updateEnemyTooltipPosition(event.currentTarget)
                        }}
                        onMouseMove={(event) => {
                          if (!isEncountered || hoveredEnemyId !== enemy.id) return
                          updateEnemyTooltipPosition(event.currentTarget)
                        }}
                        onFocus={(event) => {
                          if (!isEncountered) return
                          setHoveredEnemyId(enemy.id)
                          setHoveredEnemyAnchor(event.currentTarget)
                          updateEnemyTooltipPosition(event.currentTarget)
                        }}
                        onMouseLeave={() => {
                          setHoveredEnemyId(curr => (curr === enemy.id ? null : curr))
                          setHoveredEnemyAnchor(null)
                          setHoveredEnemyTooltip(null)
                        }}
                        onBlur={() => {
                          setHoveredEnemyId(curr => (curr === enemy.id ? null : curr))
                          setHoveredEnemyAnchor(null)
                          setHoveredEnemyTooltip(null)
                        }}
                      >
                        <p className={`text-center text-xs font-semibold tracking-wide ${isEncountered ? 'text-zinc-200' : 'text-zinc-500'}`}>
                          {enemy.name}
                        </p>

                        <div className="mt-2 flex h-[108px] items-end justify-center" style={{ opacity: isEncountered ? 1 : 0.6 }}>
                          <motion.img
                            data-testid="bestiary-enemy-sprite"
                            src={frameSrc}
                            alt={enemy.name}
                            className="object-contain"
                            animate={{
                              y: [spriteBaseY, spriteBaseY - 2, spriteBaseY],
                              ...(isEncountered && isPrismatic ? { filter: PRISMATIC_FILTER_KEYFRAMES } : {}),
                            }}
                            transition={{
                              y: { duration: 0.45, repeat: Infinity, repeatDelay: 0.15 },
                              ...(isEncountered && isPrismatic ? { filter: { duration: 3.2, repeat: Infinity, ease: 'linear' } } : {}),
                            }}
                            style={{
                              width: spriteSize,
                              height: spriteSize,
                              scaleX: 1,
                              imageRendering: 'pixelated',
                              filter: isEncountered
                                ? (isPrismatic ? PRISMATIC_FILTER_KEYFRAMES[0] : (tintFilter ?? 'none'))
                                : `grayscale(1) contrast(0.85) brightness(0.55)${tintFilter ? ` ${tintFilter}` : ''}`,
                            }}
                          />
                        </div>

                        <AnimatePresence>
                          {isEncountered && hoveredEnemyId === enemy.id && hoveredEnemyTooltip && (
                            <motion.div
                              key={`${enemy.id}-details`}
                              className="fixed pointer-events-none z-[320] w-64 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5"
                              style={{
                                left: hoveredEnemyTooltip.left,
                                top: hoveredEnemyTooltip.top,
                                x: '-50%',
                                y: hoveredEnemyTooltip.placeAbove ? '-100%' : '0%',
                              }}
                              initial={{ opacity: 0, y: 5, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.97, transition: { duration: 0.1, ease: 'easeIn' } }}
                              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Details</p>
                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-100">{enemy.name}</p>
                                  <p className={`text-[10px] uppercase tracking-widest ${enemy.tier === 'elite' ? 'text-amber-400/80' : 'text-zinc-500'}`}>
                                    {enemy.tier === 'basic' ? 'common' : 'elite'} enemy
                                  </p>
                                </div>

                                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 space-y-2">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Weaknesses</p>
                                    {enemy.weaknesses.length > 0 ? (
                                      <p className="text-xs text-rose-300 mt-1">
                                        {enemy.weaknesses.map(weakness => weakness === 'blunt' ? 'Blunt Damage' : weakness === 'burn' ? 'Burn Damage' : weakness).join(', ')}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-zinc-500 mt-1">None</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-600">Abilities</p>
                                    {enemy.abilities.length > 0 ? (
                                      <p className="text-xs text-zinc-300 mt-1">{enemy.abilities.join(', ')}</p>
                                    ) : (
                                      <p className="text-xs text-zinc-500 mt-1">Basic Attack</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}

              {activeTab === 'trinkets' && (
                <motion.div
                  key={`trinkets-${trinketPage}`}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
                >
                  {pageTrinkets.map((trinket, i) => {
                    const isEncountered = encounteredTrinketIds.has(trinket.id)
                    return (
                      <motion.div
                        key={`${trinket.id}-${trinketPage}-${i}`}
                        variants={staggerItemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        style={{
                          filter: isEncountered ? 'none' : 'grayscale(1) contrast(0.82) brightness(0.58)',
                          opacity: isEncountered ? 1 : 0.58,
                        }}
                      >
                        <TrinketInfoCard
                          id={trinket.id}
                          name={trinket.name}
                          description={trinket.description}
                          iconSrc={trinket.iconSrc}
                          keywordTooltipEnabled={isEncountered}
                          className="w-full"
                        />
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {totalPages > 1 && (
              <motion.button
                type="button"
                aria-label="Next page"
                onClick={nextPage}
                className="absolute -right-16 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 p-2 text-zinc-500"
                whileHover={{ scale: 1.04, color: '#a1a1aa', borderColor: 'rgba(113,113,122,0.8)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              >
                <ChevronRight size={16} />
              </motion.button>
            )}
          </div>

          {totalPages > 1 && (
            <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-zinc-600">
              Page {(activeTab === 'cards' ? cardPage : activeTab === 'bestiary' ? enemyPage : trinketPage) + 1} / {totalPages}
            </p>
          )}
        </div>
      </div>
    </SelectionScreenShell>
  )
}
