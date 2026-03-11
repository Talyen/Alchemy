import { AnimatePresence, motion } from 'framer-motion'
import { Beaker, Layers, ShoppingBag, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import type { CardDef, CardInstance } from '@/types'
import type { ShopCardOffer } from './ShopScreen'
import { Card } from './Card'
import { GoldIcon } from './GoldIcon'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'
import { playGoldSpend } from '@/sounds'
import { KEYWORDS, getKeywordsFromText, renderKeywordText } from './keywordGlossary'
import { getViewportPopoverPosition, type PopoverPosition } from '@/lib/viewportPopover'

export type AlchemyTransformKind = 'cost_down' | 'burn_up' | 'poison_up' | 'bleed_up' | 'heal_up'

export interface AlchemyTransformOffer {
  id: string
  kind: AlchemyTransformKind
  title: string
  description: string
  cost: number
  purchased?: boolean
}

interface Props {
  characterId: string
  gold: number
  deckCards: CardDef[]
  transformOffers: AlchemyTransformOffer[]
  potionOffer: ShopCardOffer | null
  potionOffer2: ShopCardOffer | null
  potionCost: number
  mixCost: number
  onBuyPotion: () => void
  onBuyPotion2: () => void
  onApplyTransform: (offerId: string, deckIndex: number) => void
  onMixPotions: (firstDeckIndex: number, secondDeckIndex: number) => void
  refreshUsed: boolean
  refreshCost: number
  onRefreshOffers: () => void
  onLeave: () => void
  topLeft?: ReactNode
}

const PLAGUE_DOCTOR_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/doc-idle-f${i}.png`)

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

function isPotionCard(card: CardDef): boolean {
  return card.name.toLowerCase().includes('potion')
}

function isEligibleForTransform(card: CardDef, kind: AlchemyTransformKind): boolean {
  if (kind === 'cost_down') return card.cost > 0
  if (kind === 'burn_up') return (card.effect.burn ?? 0) > 0
  if (kind === 'poison_up') return (card.effect.poison ?? 0) > 0
  if (kind === 'bleed_up') return (card.effect.bleed ?? 0) > 0
  return (card.effect.heal ?? 0) > 0
}

function transformOptionLabel(offer: AlchemyTransformOffer): { text: string; keyword: string | null; amount: number } {
  if (offer.kind === 'cost_down') {
    return { text: 'Choose a card and decrease its Mana cost by 1', keyword: 'Mana', amount: 1 }
  }
  if (offer.kind === 'burn_up') {
    return { text: 'Choose a card and increase its Burn by 1', keyword: 'Burn', amount: 1 }
  }
  if (offer.kind === 'poison_up') {
    return { text: 'Choose a card and increase its Poison by 1', keyword: 'Poison', amount: 1 }
  }
  if (offer.kind === 'bleed_up') {
    return { text: 'Choose a card and increase its Bleed by 1', keyword: 'Bleed', amount: 1 }
  }
  return { text: 'Choose a card and increase its Heal by 2', keyword: 'Heal', amount: 2 }
}

function AnimatedSprite({ frames, alt, className }: { frames: string[]; alt: string; className?: string }) {
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    setFrameIdx(0)
  }, [frames])

  useEffect(() => {
    if (frames.length <= 1) return
    const id = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length)
    }, 1000 / CHARACTER_IDLE_FPS)
    return () => clearInterval(id)
  }, [frames])

  return (
    <img
      src={frames[frameIdx]}
      alt={alt}
      className={className ?? 'h-20 w-20 object-contain'}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function AlchemyScreen({ characterId, gold, deckCards, transformOffers, potionOffer, potionOffer2, potionCost, mixCost, onBuyPotion, onBuyPotion2, onApplyTransform, onMixPotions, refreshUsed, refreshCost, onRefreshOffers, onLeave, topLeft }: Props) {
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null)
  const [showTransformPanel, setShowTransformPanel] = useState(false)
  const [showMixPanel, setShowMixPanel] = useState(false)
  const [selectedPotionIndexes, setSelectedPotionIndexes] = useState<number[]>([])
  const [goldSpendFx, setGoldSpendFx] = useState<Array<{ id: number; amount: number }>>([])
  const [nextGoldSpendFxId, setNextGoldSpendFxId] = useState(0)
  const [pendingTransformOfferId, setPendingTransformOfferId] = useState<string | null>(null)
  const [pendingPotionPurchase, setPendingPotionPurchase] = useState(false)
  const [pendingPotion2Purchase, setPendingPotion2Purchase] = useState(false)
  const [pendingMixPurchase, setPendingMixPurchase] = useState(false)
  const [hoveredTransformOfferId, setHoveredTransformOfferId] = useState<string | null>(null)
  const [transformTooltipPosition, setTransformTooltipPosition] = useState<PopoverPosition | null>(null)
  const characterFrames = useMemo(() => getCharacterIdleFrames(characterId), [characterId])

  const selectedOffer = useMemo(
    () => transformOffers.find(offer => offer.id === selectedOfferId) ?? null,
    [transformOffers, selectedOfferId],
  )

  const eligibleTransformCards = useMemo(() => {
    if (!selectedOffer) return []
    return deckCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => isEligibleForTransform(card, selectedOffer.kind))
  }, [deckCards, selectedOffer])

  const potionCards = useMemo(
    () => deckCards.map((card, index) => ({ card, index })).filter(({ card }) => isPotionCard(card)),
    [deckCards],
  )

  const hasEligibleCards = useMemo(() => {
    return new Map(transformOffers.map(offer => [
      offer.id,
      deckCards.some(card => isEligibleForTransform(card, offer.kind)),
    ]))
  }, [transformOffers, deckCards])

  const canMixPotions = potionCards.length >= 2 && gold >= mixCost
  const refreshDisabled = refreshUsed || gold < refreshCost

  const pushGoldSpendFx = (amount: number) => {
    setGoldSpendFx(prev => [...prev, { id: nextGoldSpendFxId, amount }])
    setNextGoldSpendFxId(prev => prev + 1)
  }

  const clearGoldSpendFx = (id: number) => {
    setGoldSpendFx(prev => prev.filter(entry => entry.id !== id))
  }

  const handleOpenTransform = (offerId: string) => {
    setSelectedOfferId(offerId)
    setSelectedDeckIndex(null)
    setShowTransformPanel(true)
  }

  const handleConfirmTransform = () => {
    if (!selectedOffer || selectedDeckIndex === null) return
    if (gold < selectedOffer.cost) return
    playGoldSpend()
    pushGoldSpendFx(selectedOffer.cost)
    setPendingTransformOfferId(selectedOffer.id)
    window.setTimeout(() => onApplyTransform(selectedOffer.id, selectedDeckIndex), 220)
    window.setTimeout(() => setPendingTransformOfferId(null), 560)
    setSelectedDeckIndex(null)
    setShowTransformPanel(false)
  }

  const togglePotionSelection = (index: number) => {
    setSelectedPotionIndexes(prev => {
      if (prev.includes(index)) return prev.filter(entry => entry !== index)
      if (prev.length >= 2) return [prev[1], index]
      return [...prev, index]
    })
  }

  const handleConfirmMix = () => {
    if (selectedPotionIndexes.length !== 2) return
    if (!canMixPotions) return
    playGoldSpend()
    pushGoldSpendFx(mixCost)
    setPendingMixPurchase(true)
    window.setTimeout(() => onMixPotions(selectedPotionIndexes[0], selectedPotionIndexes[1]), 220)
    window.setTimeout(() => setPendingMixPurchase(false), 560)
    setSelectedPotionIndexes([])
    setShowMixPanel(false)
  }

  return (
    <SelectionScreenShell title="Alchemist's Hut" subtitle="Alchemy" topLeft={topLeft} layout="top" titleOffsetY={24}>
      <div className="w-full h-full min-h-0 max-w-6xl px-6 pb-6 flex flex-col items-center gap-8">
        <motion.div
          className="relative mx-auto w-full max-w-[760px] flex items-end justify-center z-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <div className="absolute inset-x-0 bottom-1 w-full grid grid-cols-[1fr_1fr_1fr] pointer-events-none">
            <div className="flex justify-center">
              <div className="relative inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-zinc-200">
                <GoldIcon size={13} />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Gold</span>
                <span className="text-sm font-semibold">{gold}</span>
                <AnimatePresence>
                  {goldSpendFx.map(entry => (
                    <motion.div
                      key={entry.id}
                      className="absolute left-1/2 top-[-18px] -translate-x-1/2 pointer-events-none text-xs font-semibold text-amber-300"
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: -12 }}
                      exit={{ opacity: 0, y: -18 }}
                      transition={{ duration: 0.42, ease: 'easeOut' }}
                      onAnimationComplete={() => window.setTimeout(() => clearGoldSpendFx(entry.id), 30)}
                    >
                      -{entry.amount}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div />

            <div className="flex justify-center pointer-events-auto">
              <motion.button
                type="button"
                disabled={refreshDisabled}
                onClick={() => {
                  if (refreshDisabled) return
                  playGoldSpend()
                  pushGoldSpendFx(refreshCost)
                  onRefreshOffers()
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={refreshDisabled ? undefined : { scale: 1.03 }}
                whileTap={refreshDisabled ? undefined : { scale: 0.97 }}
              >
                <Sparkles size={13} className="text-zinc-500" />
                <span>{refreshUsed ? 'Refresh Used' : 'Refresh Offers'}</span>
                <GoldIcon size={12} />
                <span>{refreshCost}</span>
              </motion.button>
            </div>
          </div>

          <div className="flex items-end justify-center gap-10">
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <AnimatedSprite
                frames={characterFrames}
                alt="Player"
                className="h-20 w-20 object-contain"
              />
            </motion.div>

            <motion.div
              className="scale-x-[-1]"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.04 }}
            >
              <AnimatedSprite
                frames={PLAGUE_DOCTOR_FRAMES}
                alt="Plague Doctor"
                className="h-20 w-20 object-contain"
              />
            </motion.div>
          </div>
        </motion.div>

        <div className="relative z-20 w-full flex-1 overflow-visible">
          <div className="mx-auto grid w-full max-w-[1120px] grid-cols-[1fr_240px_1fr] items-start gap-5">
            <div className="col-span-3">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Transform a Card</p>
              <motion.div
                className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-5"
                variants={staggerContainerVariants}
                initial="hidden"
                animate="show"
              >
                {transformOffers.map((offer) => {
                  const isPurchased = offer.purchased === true
                  const affordable = gold >= offer.cost && !isPurchased
                  const pendingPurchase = pendingTransformOfferId === offer.id
                  const label = transformOptionLabel(offer)
                  const keywordEntry = label.keyword ? KEYWORDS[label.keyword] : null
                  const KeywordIcon = keywordEntry?.Icon
                  const keywordMatches = getKeywordsFromText(label.text)
                  const hasTargets = hasEligibleCards.get(offer.id) ?? false
                  const isDisabled = !affordable || pendingPurchase || isPurchased || !hasTargets
                  const showNoTargetsTooltip = hoveredTransformOfferId === offer.id && !isPurchased && !hasTargets
                  const showKeywordTooltip = hoveredTransformOfferId === offer.id && hasTargets && keywordMatches.length > 0
                  return (
                    <motion.div
                      key={offer.id}
                      variants={staggerItemVariants}
                      className="relative flex flex-col items-center gap-2"
                      onMouseEnter={(event) => {
                        setHoveredTransformOfferId(offer.id)
                        setTransformTooltipPosition(getViewportPopoverPosition(event.currentTarget.getBoundingClientRect(), { width: hasTargets ? 224 : 208 }))
                      }}
                      onMouseLeave={() => {
                        setHoveredTransformOfferId(current => (current === offer.id ? null : current))
                        setTransformTooltipPosition(null)
                      }}
                      animate={isPurchased || pendingPurchase ? { opacity: 0.35, y: -8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                    >
                      <div className="w-full min-h-[98px] rounded-2xl border border-zinc-700/70 bg-zinc-900/65 px-4 py-3 flex flex-col items-center justify-center gap-2">
                        {KeywordIcon && keywordEntry ? (
                          <KeywordIcon size={32} style={{ color: keywordEntry.color }} />
                        ) : (
                          <Layers size={28} className="text-zinc-500" />
                        )}
                        <p className="text-sm text-zinc-100 text-center leading-relaxed">{renderKeywordText(label.text)}</p>
                      </div>

                      <motion.button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleOpenTransform(offer.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={!isDisabled ? { scale: 1.03 } : undefined}
                        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
                      >
                        <Sparkles size={13} className="text-zinc-500" />
                        <span>{isPurchased || pendingPurchase ? 'Purchased' : 'Buy'}</span>
                        <GoldIcon size={12} />
                        <span>{offer.cost}</span>
                      </motion.button>

                      <AnimatePresence>
                        {showNoTargetsTooltip && (
                          <motion.div
                            className="fixed z-[320] w-52 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 pointer-events-none"
                            style={{ left: transformTooltipPosition?.left ?? 0, top: transformTooltipPosition?.top ?? 0, x: '-50%', y: transformTooltipPosition?.placeAbove ? '-100%' : '0%' }}
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.1 } }}
                          >
                            <p className="text-xs text-zinc-400">No valid cards to transform</p>
                          </motion.div>
                        )}
                        {showKeywordTooltip && (
                          <motion.div
                            className="fixed z-[320] w-56 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 pointer-events-none"
                            style={{ left: transformTooltipPosition?.left ?? 0, top: transformTooltipPosition?.top ?? 0, x: '-50%', y: transformTooltipPosition?.placeAbove ? '-100%' : '0%' }}
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.1 } }}
                          >
                            <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Keywords</p>
                            <div className="space-y-2">
                              {keywordMatches.map(entry => {
                                const Icon = entry.Icon
                                return (
                                  <div key={`${offer.id}-${entry.name}`} className="flex items-start gap-2">
                                    <Icon size={16} style={{ color: entry.color, flexShrink: 0 }} />
                                    <div>
                                      <p className="text-[13px] font-semibold leading-none" style={{ color: entry.color }}>{entry.name}</p>
                                      <p className="text-[11px] text-zinc-400 leading-snug">{entry.description}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>

            <div>
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Potion For Sale</p>
              <div className="mx-auto grid grid-cols-[220px] justify-center items-start">
                {potionOffer ? (
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={pendingPotionPurchase ? { opacity: 0.35, y: -8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <div className="w-[192px] h-[288px]">
                      <Card card={toInstance(potionOffer.card, `alchemy-potion-${potionOffer.card.id}`)} playable />
                    </div>
                    <motion.button
                      type="button"
                      disabled={gold < potionCost || pendingPotionPurchase}
                      onClick={() => {
                        if (gold < potionCost || pendingPotionPurchase) return
                        playGoldSpend()
                        pushGoldSpendFx(potionCost)
                        setPendingPotionPurchase(true)
                        window.setTimeout(() => onBuyPotion(), 220)
                        window.setTimeout(() => setPendingPotionPurchase(false), 560)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={gold >= potionCost ? { scale: 1.03 } : undefined}
                      whileTap={gold >= potionCost ? { scale: 0.97 } : undefined}
                    >
                      <ShoppingBag size={13} className="text-zinc-500" />
                      <span>{pendingPotionPurchase ? 'Purchased' : 'Buy'}</span>
                      <GoldIcon size={12} />
                      <span>{potionCost}</span>
                    </motion.button>
                  </motion.div>
                ) : (
                  <p className="text-xs text-zinc-500 text-center">No potion currently in stock.</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Potion Making</p>
              <motion.div
                className="mx-auto w-full max-w-[360px] rounded-2xl border border-zinc-700/70 bg-zinc-900/65 p-4 flex flex-col items-center gap-3"
                animate={!canMixPotions || pendingMixPurchase ? { opacity: 0.45, y: -6, scale: 0.99 } : { opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
              >
                <motion.img
                  src="assets/cards/icon-health-potion.png"
                  alt="Mixed Potion"
                  className="h-10 w-10 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  animate={{ filter: ['hue-rotate(0deg) saturate(2) brightness(1.05)', 'hue-rotate(120deg) saturate(2) brightness(1.05)', 'hue-rotate(240deg) saturate(2) brightness(1.05)', 'hue-rotate(360deg) saturate(2) brightness(1.05)'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
                />
                <div className="text-center">
                  <p className="text-sm text-zinc-100">Mix Potions</p>
                  <p className="mt-1 text-xs text-zinc-400">Select 2 of your Potions to Combine</p>
                </div>
              </motion.div>
              <div className="mt-2 flex justify-center">
                <motion.button
                  type="button"
                  disabled={!canMixPotions || pendingMixPurchase}
                  onClick={() => {
                    setSelectedPotionIndexes([])
                    setShowMixPanel(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={canMixPotions ? { scale: 1.03 } : undefined}
                  whileTap={canMixPotions ? { scale: 0.97 } : undefined}
                >
                  <img
                    src="assets/cards/icon-health-potion.png"
                    alt="Potion"
                    className="h-4 w-4 object-contain"
                    style={{ imageRendering: 'pixelated', filter: 'hue-rotate(245deg) saturate(1.8) brightness(1.05)' }}
                  />
                  <span>{pendingMixPurchase ? 'Purchased' : 'Buy'}</span>
                  <GoldIcon size={12} />
                  <span>{mixCost}</span>
                </motion.button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Potion For Sale</p>
              <div className="mx-auto grid grid-cols-[220px] justify-center items-start">
                {potionOffer2 ? (
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={pendingPotion2Purchase ? { opacity: 0.35, y: -8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <div className="w-[192px] h-[288px]">
                      <Card card={toInstance(potionOffer2.card, `alchemy-potion2-${potionOffer2.card.id}`)} playable />
                    </div>
                    <motion.button
                      type="button"
                      disabled={gold < potionCost || pendingPotion2Purchase}
                      onClick={() => {
                        if (gold < potionCost || pendingPotion2Purchase) return
                        playGoldSpend()
                        pushGoldSpendFx(potionCost)
                        setPendingPotion2Purchase(true)
                        window.setTimeout(() => onBuyPotion2(), 220)
                        window.setTimeout(() => setPendingPotion2Purchase(false), 560)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={gold >= potionCost ? { scale: 1.03 } : undefined}
                      whileTap={gold >= potionCost ? { scale: 0.97 } : undefined}
                    >
                      <ShoppingBag size={13} className="text-zinc-500" />
                      <span>{pendingPotion2Purchase ? 'Purchased' : 'Buy'}</span>
                      <GoldIcon size={12} />
                      <span>{potionCost}</span>
                    </motion.button>
                  </motion.div>
                ) : (
                  <p className="text-xs text-zinc-500 text-center">No potion currently in stock.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <motion.button
          type="button"
          onClick={onLeave}
          className="mb-1 px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300"
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
        >
          Leave
        </motion.button>

        <AnimatePresence>
          {showTransformPanel && selectedOffer && (
            <motion.div className="absolute inset-0 z-40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(6px)' }}>
              <motion.div className="w-[min(92vw,1120px)] max-h-[82vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-5" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Alchemy Service</p>
                    <h3 className="text-lg font-semibold text-zinc-100">Select a Card to Transform</h3>
                  </div>
                  <motion.button type="button" onClick={() => { setSelectedDeckIndex(null); setShowTransformPanel(false) }} className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    Close
                  </motion.button>
                </div>

                <div className="max-h-[56vh] overflow-y-auto scrollbar-hidden px-4 py-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 justify-items-center">
                    {eligibleTransformCards.map(({ card, index }) => {
                      const isSelected = selectedDeckIndex === index
                      return (
                        <motion.button key={`alchemy-transform-${card.id}-${index}`} type="button" onClick={() => setSelectedDeckIndex(index)} className="rounded-xl border-2 p-1" style={{ borderColor: isSelected ? 'rgba(161,161,170,0.9)' : 'rgba(63,63,70,0.65)', backgroundColor: isSelected ? 'rgba(39,39,42,0.4)' : 'rgba(24,24,27,0.35)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Card card={toInstance(card, `alchemy-transform-${card.id}-${index}`)} playable />
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <motion.button type="button" onClick={() => { setSelectedDeckIndex(null); setShowTransformPanel(false) }} className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    Cancel
                  </motion.button>
                  <motion.button type="button" disabled={selectedDeckIndex === null || gold < selectedOffer.cost} onClick={handleConfirmTransform} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed" whileHover={selectedDeckIndex === null || gold < selectedOffer.cost ? undefined : { scale: 1.03 }} whileTap={selectedDeckIndex === null || gold < selectedOffer.cost ? undefined : { scale: 0.97 }}>
                    <Sparkles size={13} className="text-zinc-500" />
                    <span>Apply Transform</span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMixPanel && (
            <motion.div className="absolute inset-0 z-40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(6px)' }}>
              <motion.div className="w-[min(92vw,1120px)] max-h-[82vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-5" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Alchemy Service</p>
                    <h3 className="text-lg font-semibold text-zinc-100">Mix Potions</h3>
                    <p className="text-xs text-zinc-500 mt-1">Pick exactly two potion cards to combine. Cost: {mixCost} Gold.</p>
                  </div>
                  <motion.button type="button" onClick={() => { setSelectedPotionIndexes([]); setShowMixPanel(false) }} className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    Close
                  </motion.button>
                </div>

                <div className="max-h-[56vh] overflow-y-auto scrollbar-hidden px-4 py-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 justify-items-center">
                    {potionCards.map(({ card, index }) => {
                      const isSelected = selectedPotionIndexes.includes(index)
                      return (
                        <motion.button key={`alchemy-mix-${card.id}-${index}`} type="button" onClick={() => togglePotionSelection(index)} className="rounded-xl border-2 p-1" style={{ borderColor: isSelected ? 'rgba(251,191,36,0.9)' : 'rgba(63,63,70,0.65)', backgroundColor: isSelected ? 'rgba(120,53,15,0.22)' : 'rgba(24,24,27,0.35)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Card card={toInstance(card, `alchemy-mix-${card.id}-${index}`)} playable />
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <motion.button type="button" onClick={() => { setSelectedPotionIndexes([]); setShowMixPanel(false) }} className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    Cancel
                  </motion.button>
                  <motion.button type="button" disabled={selectedPotionIndexes.length !== 2 || !canMixPotions} onClick={handleConfirmMix} className="inline-flex items-center gap-2 rounded-lg border border-amber-700/70 bg-amber-950/70 px-3 py-2 text-xs text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed" whileHover={selectedPotionIndexes.length !== 2 || !canMixPotions ? undefined : { scale: 1.03 }} whileTap={selectedPotionIndexes.length !== 2 || !canMixPotions ? undefined : { scale: 0.97 }}>
                    <Beaker size={13} />
                    <span>Mix</span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SelectionScreenShell>
  )
}
