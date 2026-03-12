import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { CardDef } from '@/types'
import { SelectionScreenShell } from './SelectionScreenShell'
import { Card } from './Card'

interface Props {
  deckCards: CardDef[]
  onCorrupt: (deckIndex: number) => void
  onSkip: () => void
  topLeft?: ReactNode
}

function toInstance(card: CardDef, uid: string) {
  return { ...card, uid }
}

export function MysteryCorruptedForgeScreen({ deckCards, onCorrupt, onSkip, topLeft }: Props) {
  return (
    <SelectionScreenShell
      title="Corrupted Forge"
      subtitle="Mystery"
      topLeft={topLeft}
      allowOverflowVisible
    >
      <div className="w-full max-w-6xl -mt-4 flex flex-col items-center gap-5">
        <img
          src="assets/cards/icon-forge.png"
          alt="Corrupted Forge"
          className="h-12 w-12 object-contain"
          style={{ imageRendering: 'pixelated', filter: 'hue-rotate(330deg) saturate(2.8) brightness(0.75)' }}
        />
        <p className="text-xs uppercase tracking-wider text-zinc-400">Choose one card to corrupt</p>

        {deckCards.length === 0 ? (
          <p className="text-xs text-zinc-500">No cards available to corrupt.</p>
        ) : (
          <div className="max-h-[66vh] overflow-y-auto scrollbar-hidden pr-1 w-full">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
              {deckCards.map((card, index) => (
                <motion.button
                  key={`${card.id}-${index}`}
                  type="button"
                  className="origin-top"
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onCorrupt(index)}
                >
                  <Card card={toInstance(card, `corrupt-${index}`)} playable={false} dimmed={false} />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <motion.button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 rounded-lg border border-zinc-700/70 bg-zinc-900/70 text-xs text-zinc-300"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Leave the Forge
        </motion.button>
      </div>
    </SelectionScreenShell>
  )
}
