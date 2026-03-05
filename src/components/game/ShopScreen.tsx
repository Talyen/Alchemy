import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Gem, ShoppingBag, Sparkles } from 'lucide-react'
import type { CardDef, CardInstance } from '@/types'
import { Card } from './Card'
import { SelectionScreenShell, staggerContainerVariants, staggerItemVariants } from './SelectionScreenShell'

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
}

interface Props {
  gold: number
  cardOffers: ShopCardOffer[]
  trinketOffers: ShopTrinketOffer[]
  onBuyCard: (offerId: string) => void
  onLeave: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function ShopScreen({ gold, cardOffers, trinketOffers, onBuyCard, onLeave, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Shop" subtitle="Merchant" topLeft={topLeft}>
      <div className="w-full max-w-6xl px-8 flex flex-col items-center gap-8">
        <div className="w-full flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/80 px-4 py-2 text-zinc-200">
            <Gem size={14} className="text-amber-400" />
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
                    Buy ({offer.price}g)
                  </motion.button>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        <div className="w-full">
          <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-zinc-600">Trinkets (Soon)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trinketOffers.map(trinket => (
              <div key={trinket.id} className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2">
                    <Sparkles size={14} className="text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-300">{trinket.name}</p>
                  </div>
                  <span className="text-xs text-zinc-500">{trinket.price}g</span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">{trinket.description}</p>
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
