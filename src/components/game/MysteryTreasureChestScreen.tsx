import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SelectionScreenShell } from './SelectionScreenShell'
import { Card } from './Card'
import { TrinketInfoCard } from './TrinketInfoCard'
import type { CardDef } from '@/types'
import { playGoldGain } from '@/sounds'

export type TreasureChestReward =
  | { type: 'card'; card: CardDef }
  | { type: 'trinket'; id: string; name: string; description: string; iconSrc?: string }

interface Props {
  reward: TreasureChestReward | null
  onOpen: () => void
  onTake: () => void
  onSkip: () => void
  topLeft?: ReactNode
}

function toInstance(card: CardDef) {
  return { ...card, uid: `chest-${card.id}` }
}

export function MysteryTreasureChestScreen({ reward, onOpen, onTake, onSkip, topLeft }: Props) {
  return (
    <SelectionScreenShell title="Treasure Chest" subtitle="Mystery" topLeft={topLeft} allowOverflowVisible>
      <div className="w-full max-w-4xl -mt-4 flex flex-col items-center gap-6">
        <motion.img
          src="assets/mystery/treasure-chest.png"
          alt="Treasure Chest"
          className="h-24 w-24 object-contain"
          style={{ imageRendering: 'pixelated' }}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        />

        {!reward && (
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={onOpen}
              className="px-6 py-2.5 rounded-xl border border-amber-700/80 bg-zinc-900/85 text-sm text-amber-200"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Open Chest
            </motion.button>
          </div>
        )}

        {reward && (
          <>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Inside you found:</p>

            {reward.type === 'card' ? (
              <div className="w-[192px] h-[288px]">
                <Card card={toInstance(reward.card)} playable />
              </div>
            ) : (
              <div className="w-[260px]">
                <TrinketInfoCard
                  id={reward.id}
                  name={reward.name}
                  description={reward.description}
                  iconSrc={reward.iconSrc}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                onClick={onTake}
                className="px-6 py-2.5 rounded-xl border border-emerald-700/80 bg-zinc-900/85 text-sm text-emerald-200"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Take Reward
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  playGoldGain()
                  onSkip()
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-900/60 bg-zinc-900/70 text-xs text-amber-200"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Salvage for 25 Gold
              </motion.button>
            </div>
          </>
        )}
      </div>
    </SelectionScreenShell>
  )
}
