import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { RefreshCw, ShoppingBag, Trash2 } from 'lucide-react'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import type { CardDef, CardInstance } from '@/types'
import { Card } from './Card'
import { GoldIcon } from './GoldIcon'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'
import { TrinketInfoCard } from './TrinketInfoCard'
import { playGoldSpend } from '@/sounds'

export interface ShopCardOffer {
  id: string
  card: CardDef
  price: number
  sold?: boolean
}

export interface ShopTrinketOffer {
  id: string
  name: string
  description: string
  price: number
  iconSrc?: string
}

interface Props {
  characterId: string
  gold: number
  cardOffers: ShopCardOffer[]
  trinketOffers: ShopTrinketOffer[]
  offerMode: 'cards' | 'trinkets'
  deckCards: CardDef[]
  refreshCost: number
  destroyCardCost: number
  refreshUsed: boolean
  destroyUsed: boolean
  onRefreshShop: () => void
  onBuyCard: (offerId: string) => void
  onBuyTrinket: (offerId: string) => void
  onDestroyCard: (deckIndex: number) => void
  onLeave: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

const SHOPKEEPER_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/enemies/dwarf_f-idle-f${i}.png`)

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

export function ShopScreen({ characterId, gold, cardOffers, trinketOffers, offerMode, deckCards, refreshCost, destroyCardCost, refreshUsed, destroyUsed, onRefreshShop, onBuyCard, onBuyTrinket, onDestroyCard, onLeave, topLeft }: Props) {
  const [showDestroyPanel, setShowDestroyPanel] = useState(false)
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null)
  const [pendingCardPurchaseIds, setPendingCardPurchaseIds] = useState<Set<string>>(new Set())
  const [pendingTrinketPurchaseIds, setPendingTrinketPurchaseIds] = useState<Set<string>>(new Set())
  const [goldSpendFx, setGoldSpendFx] = useState<Array<{ id: number; amount: number }>>([])
  const [nextGoldSpendFxId, setNextGoldSpendFxId] = useState(0)
  const refreshDisabled = refreshUsed || gold < refreshCost
  const destroyDisabled = destroyUsed || gold < destroyCardCost || deckCards.length <= 1
  const characterFrames = useMemo(() => getCharacterIdleFrames(characterId), [characterId])
  const deckInstances = useMemo(
    () => deckCards.map((card, index) => ({ card, index, instance: toInstance(card, `shop-deck-${card.id}-${index}`) })),
    [deckCards],
  )
  const pushGoldSpendFx = (amount: number) => {
    setGoldSpendFx(prev => [...prev, { id: nextGoldSpendFxId, amount }])
    setNextGoldSpendFxId(prev => prev + 1)
  }

  const clearGoldSpendFx = (id: number) => {
    setGoldSpendFx(prev => prev.filter(entry => entry.id !== id))
  }

  const handleBuyCardClick = (offerId: string, price: number) => {
    if (gold < price) return
    playGoldSpend()
    pushGoldSpendFx(price)
    setPendingCardPurchaseIds(prev => new Set([...prev, offerId]))
    window.setTimeout(() => onBuyCard(offerId), 220)
    window.setTimeout(() => {
      setPendingCardPurchaseIds(prev => {
        const next = new Set(prev)
        next.delete(offerId)
        return next
      })
    }, 560)
  }

  const handleBuyTrinketClick = (offerId: string, price: number) => {
    if (gold < price) return
    playGoldSpend()
    pushGoldSpendFx(price)
    setPendingTrinketPurchaseIds(prev => new Set([...prev, offerId]))
    window.setTimeout(() => onBuyTrinket(offerId), 220)
    window.setTimeout(() => {
      setPendingTrinketPurchaseIds(prev => {
        const next = new Set(prev)
        next.delete(offerId)
        return next
      })
    }, 560)
  }

  const handleRefreshClick = () => {
    if (refreshDisabled) return
    playGoldSpend()
    pushGoldSpendFx(refreshCost)
    onRefreshShop()
  }

  const handleConfirmDestroy = () => {
    if (selectedDeckIndex === null) return
    if (destroyDisabled) return
    playGoldSpend()
    pushGoldSpendFx(destroyCardCost)
    onDestroyCard(selectedDeckIndex)
    setSelectedDeckIndex(null)
    setShowDestroyPanel(false)
  }

  return (
    <SelectionScreenShell title="Shop" subtitle="Merchant" topLeft={topLeft} layout="top" titleOffsetY={24}>
      <div className="w-full h-full min-h-0 max-w-6xl px-6 pb-4 flex flex-col items-center gap-6">
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
                onClick={handleRefreshClick}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={refreshDisabled ? undefined : { scale: 1.03 }}
                whileTap={refreshDisabled ? undefined : { scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <RefreshCw size={13} className="text-zinc-500" />
                <span>{refreshUsed ? 'Refresh Used' : 'Refresh Shop'}</span>
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
                frames={SHOPKEEPER_FRAMES}
                alt="Shopkeeper"
                className="h-20 w-20 object-contain"
              />
            </motion.div>
          </div>
        </motion.div>

        <div className="relative z-20 w-full min-h-0 flex-1 overflow-visible pr-1">
          <div className="w-full flex flex-col items-center gap-4 pb-1">
            {offerMode === 'cards' && (
            <div className="w-full">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Cards For Sale</p>
          <motion.div
            key={`shop-cards-${cardOffers.map(offer => offer.id).join('|')}`}
            className="mx-auto grid grid-cols-[192px_192px_192px] gap-8 justify-center items-start"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {cardOffers.map((offer, i) => {
              const canAfford = gold >= offer.price
              const pendingPurchase = pendingCardPurchaseIds.has(offer.id)
              const isSold = offer.sold === true
              if (isSold) {
                return (
                  <motion.div
                    key={offer.id}
                    variants={staggerItemVariants}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-[192px] h-[288px] rounded-2xl border border-zinc-700/40 bg-zinc-900/30 flex items-center justify-center">
                      <p className="text-xs text-zinc-600 uppercase tracking-wider">Sold</p>
                    </div>
                  </motion.div>
                )
              }
              return (
                <motion.div
                  key={offer.id}
                  variants={staggerItemVariants}
                  className="flex flex-col items-center gap-2"
                  animate={pendingPurchase ? { opacity: 0.35, y: -8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                >
                  <div className="w-[192px] h-[288px]">
                    <Card card={toInstance(offer.card, `shop-card-${i}`)} playable />
                  </div>
                  <motion.button
                    type="button"
                    disabled={!canAfford || pendingPurchase}
                    onClick={() => handleBuyCardClick(offer.id, offer.price)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={canAfford ? { scale: 1.03 } : undefined}
                    whileTap={canAfford ? { scale: 0.97 } : undefined}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  >
                    <ShoppingBag size={13} className="text-zinc-500" />
                    <span>{pendingPurchase ? 'Purchased' : 'Buy'}</span>
                    <GoldIcon size={12} />
                    <span>{offer.price}</span>
                  </motion.button>
                </motion.div>
              )
            })}
          </motion.div>
            </div>
            )}

            {offerMode === 'trinkets' && (
            <div className="w-full">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Trinkets For Sale</p>
              <div className="mx-auto w-full max-w-[760px] grid grid-cols-1 md:grid-cols-3 gap-3 justify-items-center">
                {trinketOffers.map(trinket => (
                  <motion.div
                    key={trinket.id}
                    className="w-full max-w-[236px] flex flex-col items-center gap-2"
                    animate={pendingTrinketPurchaseIds.has(trinket.id) ? { opacity: 0.35, y: -8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <TrinketInfoCard
                      id={trinket.id}
                      name={trinket.name}
                      description={trinket.description}
                      iconSrc={trinket.iconSrc}
                      className="w-full"
                    />
                    <motion.button
                      type="button"
                      disabled={gold < trinket.price || pendingTrinketPurchaseIds.has(trinket.id)}
                      onClick={() => handleBuyTrinketClick(trinket.id, trinket.price)}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={gold >= trinket.price ? { scale: 1.03 } : undefined}
                      whileTap={gold >= trinket.price ? { scale: 0.97 } : undefined}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    >
                      <ShoppingBag size={13} className="text-zinc-500" />
                      <span>{pendingTrinketPurchaseIds.has(trinket.id) ? 'Purchased' : 'Buy'}</span>
                      <GoldIcon size={12} />
                      <span>{trinket.price}</span>
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-[760px] flex flex-col items-center gap-3 pt-1">
          <motion.button
            type="button"
            disabled={destroyDisabled}
            onClick={() => setShowDestroyPanel(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={destroyDisabled ? undefined : { scale: 1.03 }}
            whileTap={destroyDisabled ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <Trash2 size={13} className="text-zinc-500" />
            <span>Remove a Card</span>
            <GoldIcon size={12} />
            <span>{destroyCardCost}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={onLeave}
            className="px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300"
            whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            Leave
          </motion.button>
        </div>

        <AnimatePresence>
          {showDestroyPanel && (
            <motion.div
              className="absolute inset-0 z-40 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(6px)' }}
            >
              <motion.div
                className="w-[min(92vw,1120px)] max-h-[82vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-5"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Shop Service</p>
                    <h3 className="text-lg font-semibold text-zinc-100">Remove a Card</h3>
                    <p className="text-xs text-zinc-500 mt-1">Select one card from your current run deck to permanently remove. Cost: {destroyCardCost} Gold.</p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setSelectedDeckIndex(null)
                      setShowDestroyPanel(false)
                    }}
                    className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  >
                    Close
                  </motion.button>
                </div>

                <div className="max-h-[56vh] overflow-y-auto px-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
                    {deckInstances.map(({ instance, index }) => {
                      const isSelected = selectedDeckIndex === index
                      return (
                        <motion.button
                          key={`${instance.uid}-${index}`}
                          type="button"
                          onClick={() => setSelectedDeckIndex(index)}
                          className="rounded-xl border-2 p-1"
                          style={{
                            borderColor: isSelected ? 'rgba(239,68,68,0.9)' : 'rgba(63,63,70,0.65)',
                            backgroundColor: isSelected ? 'rgba(127,29,29,0.22)' : 'rgba(24,24,27,0.35)',
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card card={instance} playable />
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <motion.button
                    type="button"
                    onClick={() => {
                      setSelectedDeckIndex(null)
                      setShowDestroyPanel(false)
                    }}
                    className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    disabled={selectedDeckIndex === null || destroyDisabled}
                    onClick={handleConfirmDestroy}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-700/70 bg-red-950/70 px-3 py-2 text-xs text-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={selectedDeckIndex === null || destroyDisabled ? undefined : { scale: 1.03 }}
                    whileTap={selectedDeckIndex === null || destroyDisabled ? undefined : { scale: 0.97 }}
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
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
