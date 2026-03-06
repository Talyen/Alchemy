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

export interface ShopCardOffer {
  id: string
  card: CardDef
  price: number
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

const SHOPKEEPER_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/dwarf_f-idle-f${i}.png`)

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

export function ShopScreen({ characterId, gold, cardOffers, trinketOffers, deckCards, refreshCost, destroyCardCost, refreshUsed, destroyUsed, onRefreshShop, onBuyCard, onBuyTrinket, onDestroyCard, onLeave, topLeft }: Props) {
  const [showDestroyPanel, setShowDestroyPanel] = useState(false)
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null)
  const refreshDisabled = refreshUsed || gold < refreshCost
  const destroyDisabled = destroyUsed || gold < destroyCardCost || deckCards.length <= 1
  const characterFrames = useMemo(() => getCharacterIdleFrames(characterId), [characterId])
  const deckInstances = useMemo(
    () => deckCards.map((card, index) => ({ card, index, instance: toInstance(card, `shop-deck-${card.id}-${index}`) })),
    [deckCards],
  )

  const handleConfirmDestroy = () => {
    if (selectedDeckIndex === null) return
    if (destroyDisabled) return
    onDestroyCard(selectedDeckIndex)
    setSelectedDeckIndex(null)
    setShowDestroyPanel(false)
  }

  return (
    <SelectionScreenShell title="Shop" subtitle="Merchant" topLeft={topLeft} layout="top" titleOffsetY={24}>
      <div className="w-full h-full min-h-0 max-w-6xl px-6 pb-4 flex flex-col items-center gap-3">
        <motion.div
          className="relative mx-auto w-full max-w-[760px] flex items-end justify-center z-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <div className="absolute inset-x-0 bottom-1 mx-auto w-[640px] grid grid-cols-[192px_192px_192px] pointer-events-none">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-zinc-200">
                <GoldIcon size={13} />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Gold</span>
                <span className="text-sm font-semibold">{gold}</span>
              </div>
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

        <div className="relative z-20 w-full min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="w-full flex flex-col items-center gap-4 pb-1">
            <div className="w-full">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Cards For Sale</p>
          <motion.div
            className="mx-auto grid grid-cols-[192px_192px_192px] gap-8 justify-center items-start"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {cardOffers.map((offer, i) => {
              const canAfford = gold >= offer.price
              return (
                <motion.div key={offer.id} variants={staggerItemVariants} className="flex flex-col items-center gap-2">
                  <div className="w-[192px] h-[288px]">
                    <Card card={toInstance(offer.card, `shop-card-${i}`)} playable />
                  </div>
                  <motion.button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyCard(offer.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={canAfford ? { scale: 1.03 } : undefined}
                    whileTap={canAfford ? { scale: 0.97 } : undefined}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  >
                    <ShoppingBag size={13} className="text-zinc-500" />
                    <span>Buy</span>
                    <GoldIcon size={12} />
                    <span>{offer.price}</span>
                  </motion.button>
                </motion.div>
              )
            })}
          </motion.div>
            </div>

            <div className="w-full">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Trinkets For Sale</p>
              <div className="mx-auto w-full max-w-[760px] grid grid-cols-1 md:grid-cols-3 gap-3 justify-items-center">
                {trinketOffers.map(trinket => (
                  <div key={trinket.id} className="w-full max-w-[236px] flex flex-col items-center gap-2">
                    <TrinketInfoCard
                      id={trinket.id}
                      name={trinket.name}
                      description={trinket.description}
                      iconSrc={trinket.iconSrc}
                      className="w-full"
                    />
                    <motion.button
                      type="button"
                      disabled={gold < trinket.price}
                      onClick={() => onBuyTrinket(trinket.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={gold >= trinket.price ? { scale: 1.03 } : undefined}
                      whileTap={gold >= trinket.price ? { scale: 0.97 } : undefined}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    >
                      <ShoppingBag size={13} className="text-zinc-500" />
                      <span>Buy</span>
                      <GoldIcon size={12} />
                      <span>{trinket.price}</span>
                    </motion.button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[760px] grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
          <motion.button
            type="button"
            disabled={refreshDisabled}
            onClick={onRefreshShop}
            className="justify-self-center md:justify-self-end inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={refreshDisabled ? undefined : { scale: 1.03 }}
            whileTap={refreshDisabled ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <RefreshCw size={13} className="text-zinc-500" />
            <span>Refresh Shop</span>
            <GoldIcon size={12} />
            <span>{refreshCost}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={onLeave}
            className="justify-self-center px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300"
            whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            Leave Shop
          </motion.button>

          <motion.button
            type="button"
            disabled={destroyDisabled}
            onClick={() => setShowDestroyPanel(true)}
            className="justify-self-center md:justify-self-start inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={destroyDisabled ? undefined : { scale: 1.03 }}
            whileTap={destroyDisabled ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <Trash2 size={13} className="text-zinc-500" />
            <span>Destroy a Card</span>
            <GoldIcon size={12} />
            <span>{destroyCardCost}</span>
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
                    <h3 className="text-lg font-semibold text-zinc-100">Destroy a Card</h3>
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
                    <span>Destroy</span>
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
