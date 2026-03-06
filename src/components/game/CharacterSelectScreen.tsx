import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ALL_CARDS, RUN_CHARACTERS, type RunCharacter } from '@/data'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import { SelectionScreenShell } from './SelectionScreenShell'
import { Card } from './Card'
import type { CardDef, CardInstance } from '@/types'

interface Props {
  onSelect: (characterId: string) => void
  topLeft?: ReactNode
}

function toInstance(def: CardDef, uid: string): CardInstance {
  return { ...def, uid }
}

function CharacterSprite({ characterId }: { characterId: string }) {
  const frames = getCharacterIdleFrames(characterId)
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    setFrameIdx(0)
  }, [characterId])

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length)
    }, 1000 / CHARACTER_IDLE_FPS)
    return () => clearInterval(id)
  }, [frames.length])

  return (
    <img
      src={frames[frameIdx]}
      alt={`${characterId} sprite`}
      className="w-20 h-32 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

function getStarterDeckCards(character: RunCharacter): CardDef[] {
  const cardById = new Map(ALL_CARDS.map(card => [card.id, card]))
  return character.starterDeck.flatMap(({ cardId, count }) => {
    const card = cardById.get(cardId)
    if (!card) return []
    return Array.from({ length: count }, () => card)
  })
}

export function CharacterSelectScreen({ onSelect, topLeft }: Props) {
  const [showDeck, setShowDeck] = useState(false)
  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(null)
  const [elevatedDeckCards, setElevatedDeckCards] = useState<Set<string>>(new Set())
  const hideDeckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayOrder = ['rogue', 'knight', 'wizard']
  const orderedCharacters = useMemo(
    () => displayOrder.map(id => RUN_CHARACTERS.find(character => character.id === id)).filter((character): character is RunCharacter => Boolean(character)),
    [displayOrder],
  )
  const fallbackCharacter = RUN_CHARACTERS[0]
  const activeDeckCharacter = useMemo(() => {
    if (!hoveredCharacterId) return fallbackCharacter
    return orderedCharacters.find(character => character.id === hoveredCharacterId) ?? fallbackCharacter
  }, [hoveredCharacterId, fallbackCharacter, orderedCharacters])
  const deckCards = useMemo(() => getStarterDeckCards(activeDeckCharacter), [activeDeckCharacter])
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
    () => groupedDeckCards.map(({ card }, index) => ({ card, uid: `starter-preview-${activeDeckCharacter.id}-${card.id}-${index}` })),
    [groupedDeckCards, activeDeckCharacter.id],
  )

  const previewMid = (previewCards.length - 1) / 2
  const previewAnglePerCard = previewCards.length <= 1 ? 0 : Math.min(8, 24 / (previewCards.length - 1))
  const previewOverlapPx = Math.round(Math.max(10, Math.min(32, (previewCards.length - 1) * 4)) * 0.8)

  const raisePreviewCard = (uid: string) =>
    setElevatedDeckCards(prev => new Set([...prev, uid]))

  const lowerPreviewCard = (uid: string) =>
    setElevatedDeckCards(prev => {
      const next = new Set(prev)
      next.delete(uid)
      return next
    })

  const openDeck = (characterId: string) => {
    if (hideDeckTimeoutRef.current) {
      clearTimeout(hideDeckTimeoutRef.current)
      hideDeckTimeoutRef.current = null
    }
    setHoveredCharacterId(characterId)
    setShowDeck(true)
  }

  const scheduleCloseDeck = () => {
    if (hideDeckTimeoutRef.current) {
      clearTimeout(hideDeckTimeoutRef.current)
    }
    hideDeckTimeoutRef.current = setTimeout(() => {
      setShowDeck(false)
      setHoveredCharacterId(null)
      setElevatedDeckCards(new Set())
      hideDeckTimeoutRef.current = null
    }, 180)
  }

  useEffect(() => {
    return () => {
      if (hideDeckTimeoutRef.current) clearTimeout(hideDeckTimeoutRef.current)
    }
  }, [])

  return (
    <SelectionScreenShell title="Choose Character" subtitle="Start Run" layout="top" topLeft={topLeft}>
      <div className="w-full relative mt-0">
        <div className="px-4 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {orderedCharacters.map(character => (
            <motion.button
              key={character.id}
              onClick={() => onSelect(character.id)}
              onMouseEnter={() => openDeck(character.id)}
              onMouseLeave={scheduleCloseDeck}
              className="w-full max-w-[460px] h-[275px] mx-auto rounded-2xl border border-zinc-700/70 bg-zinc-900/90 px-5 py-4 flex flex-col items-center justify-center gap-3 text-center"
              whileHover={{ scale: 1.01, y: -3 }}
              whileTap={{ scale: 0.995, y: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            >
              <div className="-translate-y-[15px] flex flex-col items-center gap-3">
                <div className="shrink-0 flex items-center justify-center">
                  <CharacterSprite characterId={character.id} />
                </div>

                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-zinc-100">{character.name}</p>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-[24ch] mx-auto">{character.quirk}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

          <div className="relative mt-2 h-[396px]">
            <AnimatePresence>
              {showDeck && (
                <motion.div
                  className="absolute inset-x-0 top-0 z-[71] min-h-[380px] rounded-xl border border-zinc-700/80 bg-zinc-950/95 px-4 pt-4 pb-8"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => openDeck(activeDeckCharacter.id)}
                  onMouseLeave={scheduleCloseDeck}
                >
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3 text-center">{activeDeckCharacter.name} Starting Deck</p>
                    <div className="mt-1 min-h-[318px] flex items-center justify-center overflow-visible">
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
                          <div className="w-[192px] h-[288px] overflow-visible">
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
        </div>
      </div>
    </SelectionScreenShell>
  )
}
