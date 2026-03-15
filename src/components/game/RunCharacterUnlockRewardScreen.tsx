import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { RunCharacter } from '@/data'
import type { CardDef, CardInstance } from '@/types'
import { playUnlockReward } from '@/sounds'
import { Card } from './Card'
import { SelectionScreenShell } from './SelectionScreenShell'
import { getStarterDeckCards, RunCharacterShowcaseCard } from './RunCharacterShowcaseCard'

type Props = {
  character: RunCharacter
  onContinue: () => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

export function RunCharacterUnlockRewardScreen({ character, onContinue, topLeft }: Props) {
  const [showDeck, setShowDeck] = useState(false)
  const [elevatedDeckCards, setElevatedDeckCards] = useState<Set<string>>(new Set())
  const hideDeckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deckCards = useMemo(() => getStarterDeckCards(character), [character])
  const groupedDeckCards = useMemo(() => {
    const grouped: Array<{ card: CardDef; count: number }> = []
    for (const card of deckCards) {
      const existing = grouped.find(entry => entry.card.id === card.id)
      if (existing) {
        existing.count += 1
      } else {
        grouped.push({ card, count: 1 })
      }
    }
    return grouped
  }, [deckCards])
  const previewCards = useMemo(
    () => groupedDeckCards.map(({ card }, index) => ({ card, uid: `reward-starter-preview-${character.id}-${card.id}-${index}` })),
    [groupedDeckCards, character.id],
  )
  const previewMid = (previewCards.length - 1) / 2
  const previewAnglePerCard = previewCards.length <= 1 ? 0 : Math.min(8, 24 / (previewCards.length - 1))
  const previewOverlapPx = Math.round(Math.max(10, Math.min(32, (previewCards.length - 1) * 4)) * 0.8)

  useEffect(() => {
    playUnlockReward()
  }, [])

  useEffect(() => {
    return () => {
      if (hideDeckTimeoutRef.current) clearTimeout(hideDeckTimeoutRef.current)
    }
  }, [])

  const openDeck = () => {
    if (hideDeckTimeoutRef.current) {
      clearTimeout(hideDeckTimeoutRef.current)
      hideDeckTimeoutRef.current = null
    }
    setShowDeck(true)
  }

  const scheduleCloseDeck = () => {
    if (hideDeckTimeoutRef.current) {
      clearTimeout(hideDeckTimeoutRef.current)
    }
    hideDeckTimeoutRef.current = setTimeout(() => {
      setShowDeck(false)
      setElevatedDeckCards(new Set())
      hideDeckTimeoutRef.current = null
    }, 180)
  }

  const raisePreviewCard = (uid: string) => {
    setElevatedDeckCards(prev => new Set([...prev, uid]))
  }

  const lowerPreviewCard = (uid: string) => {
    setElevatedDeckCards(prev => {
      const next = new Set(prev)
      next.delete(uid)
      return next
    })
  }

  return (
    <SelectionScreenShell title="Character Unlocked" subtitle="Progression" topLeft={topLeft} allowOverflowVisible>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4">
        <motion.div
          className="w-full max-w-md"
          data-testid="run-character-reward-card"
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onMouseEnter={openDeck}
          onMouseLeave={scheduleCloseDeck}
          onFocus={openDeck}
          onBlur={scheduleCloseDeck}
        >
          <RunCharacterShowcaseCard character={character} testId="run-character-reward-showcase" />
        </motion.div>

        <div className="relative min-h-72 w-full max-w-6xl">
          <AnimatePresence>
            {showDeck && (
              // ui-allow-absolute: hover deck overlay matches character select preview behavior
              <motion.div
                className="absolute inset-x-0 top-0 z-[71] min-h-72 rounded-xl border border-zinc-700/80 bg-zinc-950/95 px-4 pt-4 pb-10"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={openDeck}
                onMouseLeave={scheduleCloseDeck}
              >
                <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-zinc-600">{character.name} Starting Deck</p>
                <div className="mt-1 flex min-h-56 items-center justify-center overflow-visible">
                  {previewCards.map(({ card, uid }, index) => {
                    const offset = index - previewMid
                    const rotate = offset * previewAnglePerCard
                    const yDip = -6 + offset * offset * 1.05
                    const zBase = index + 1

                    return (
                      <motion.div
                        key={uid}
                        className="relative flex flex-col items-center gap-1"
                        style={{
                          marginLeft: index === 0 ? 0 : -previewOverlapPx,
                          zIndex: elevatedDeckCards.has(uid) ? 100 : zBase,
                        }}
                        initial={{ opacity: 0, x: -240, y: 100, scale: 0.75, rotate }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          y: yDip,
                          scale: 1,
                          rotate,
                          transition: { type: 'spring', stiffness: 150, damping: 20, delay: index * 0.08 },
                        }}
                        whileHover={{
                          y: yDip - 56,
                          rotate: 0,
                          transition: { type: 'spring', stiffness: 220, damping: 28 },
                        }}
                        onHoverStart={() => raisePreviewCard(uid)}
                        onHoverEnd={() => lowerPreviewCard(uid)}
                        transition={{ type: 'spring', stiffness: 220, damping: 28, delay: index * 0.06 }}
                      >
                        <div className="aspect-[2/3] w-28 overflow-visible sm:w-32 md:w-36 lg:w-40">
                          <div className="origin-top-left scale-100">
                            <Card card={toInstance(card, uid)} playable />
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          onClick={onContinue}
          className="rounded-xl border border-zinc-700/80 bg-zinc-900/85 px-6 py-2.5 text-sm text-zinc-200"
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          data-testid="run-character-reward-continue"
        >
          Continue
        </motion.button>
      </div>
    </SelectionScreenShell>
  )
}