import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { ShoppingBag } from 'lucide-react'
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
  gold: number
  cardOffers: ShopCardOffer[]
  trinketOffers: ShopTrinketOffer[]
  onBuyCard: (offerId: string) => void
  onBuyTrinket: (offerId: string) => void
  onLeave: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function ShopScreen({ gold, cardOffers, trinketOffers, onBuyCard, onBuyTrinket, onLeave, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Shop" subtitle="Merchant" topLeft={topLeft}>
      <div className="w-full max-w-6xl px-8 flex flex-col items-center gap-8">
        <div className="w-full flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-4 py-2 text-zinc-200">
            <GoldIcon size={14} />
            <span className="text-xs uppercase tracking-wider text-zinc-500">Gold</span>
            <span className="text-sm font-semibold">{gold}</span>
          </div>
        </div>

        <div className="w-full">
          <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-zinc-600">Cards For Sale</p>
          <motion.div
            className="flex items-start justify-center gap-8"
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
          <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-zinc-600">Trinkets For Sale</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trinketOffers.map(trinket => (
              <div key={trinket.id} className="flex flex-col items-center gap-2">
                <TrinketInfoCard
                  id={trinket.id}
                  name={trinket.name}
                  description={trinket.description}
                  iconSrc={trinket.iconSrc}
                  className="w-full max-w-[220px] min-h-[118px]"
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

        <motion.button
          type="button"
          onClick={onLeave}
          className="px-5 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-300"
          style={{ background: 'rgba(39,39,42,0.8)' }}
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          Leave Shop
        </motion.button>
      </div>
    </SelectionScreenShell>
  )
}
