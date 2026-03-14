import { useEffect, useState } from 'react'
import { ALL_CARDS, type RunCharacter } from '@/data'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import { cn } from '@/lib/utils'
import type { CardDef } from '@/types'
import { Stack } from '@/ui/primitives'

type RunCharacterShowcaseCardProps = {
  character: RunCharacter
  locked?: boolean
  lockedDescription?: string
  className?: string
  spriteClassName?: string
  contentClassName?: string
  testId?: string
}

export function CharacterSprite({ characterId }: { characterId: string }) {
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
      className="h-32 w-20 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function getStarterDeckCards(character: RunCharacter): CardDef[] {
  const cardById = new Map(ALL_CARDS.map(card => [card.id, card]))
  return character.starterDeck.flatMap(({ cardId, count }) => {
    const card = cardById.get(cardId)
    if (!card) return []
    return Array.from({ length: count }, () => card)
  })
}

export function RunCharacterShowcaseCard({
  character,
  locked = false,
  lockedDescription,
  className,
  spriteClassName,
  contentClassName,
  testId,
}: RunCharacterShowcaseCardProps) {
  const description = locked ? lockedDescription ?? 'Locked' : character.quirk

  return (
    <div
      data-testid={testId}
      className={cn(
        'mx-auto flex min-h-64 w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl px-5 py-4 text-center',
        locked ? 'border border-zinc-800/90 bg-zinc-950/95 text-zinc-500' : 'border border-zinc-700/70 bg-zinc-900/90',
        className,
      )}
    >
      <Stack align="center" gap="sm" className={contentClassName}>
        <div className={cn('flex shrink-0 items-center justify-center', locked ? 'grayscale brightness-75 contrast-90' : '', spriteClassName)}>
          <CharacterSprite characterId={character.id} />
        </div>

        <div className="min-w-0">
          <p className={cn('text-2xl font-semibold', locked ? 'text-zinc-400' : 'text-zinc-100')}>{character.name}</p>
          <p className={cn('mx-auto mt-2 max-w-[24ch] break-words text-xs leading-relaxed', locked ? 'text-zinc-500' : 'text-zinc-400')}>
            {description}
          </p>
          {locked && (
            <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-400/90">Locked</p>
          )}
        </div>
      </Stack>
    </div>
  )
}