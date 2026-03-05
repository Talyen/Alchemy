import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { SelectionScreenShell } from './SelectionScreenShell'

interface Props {
  characterId: string
  currentHp: number
  maxHp: number
  onRest: () => void
  topLeft?: ReactNode
}

const KNIGHT_FRAMES = Array.from({ length: 4 }, (_, i) => `/assets/knight-idle-f${i}.png`)
const KNIGHT_FPS = 8

function CharacterSprite({ characterId }: { characterId: string }) {
  const frames = characterId === 'knight' ? KNIGHT_FRAMES : KNIGHT_FRAMES
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length)
    }, 1000 / KNIGHT_FPS)
    return () => clearInterval(id)
  }, [frames.length])

  return (
    <img
      src={frames[frameIdx]}
      alt={`${characterId} sprite`}
      className="w-24 h-40 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function CampfireScreen({ characterId, currentHp, maxHp, onRest, topLeft }: Props) {
  const [resting, setResting] = useState(false)
  const healAmount = Math.ceil(maxHp * 0.3)

  return (
    <SelectionScreenShell title="Campfire" subtitle="Rest Site" topLeft={topLeft}>
      <div className="relative w-full max-w-5xl h-[66%] flex items-center justify-center">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 0.65 }}
          style={{
            background:
              'radial-gradient(circle at 50% 72%, rgba(245,158,11,0.2), rgba(120,53,15,0.08) 36%, rgba(10,10,12,0) 64%)',
          }}
        />

        <div className="relative z-10 flex items-end justify-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -24, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <CharacterSprite characterId={characterId} />
          </motion.div>

          <motion.div
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, x: 24, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 }}
          >
            <motion.div
              className="absolute -top-12 w-20 h-20 rounded-full"
              animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.2, 0.42, 0.2] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.45), rgba(251,146,60,0.08) 70%)' }}
            />
            <Flame size={56} className="text-amber-400" />
            <div className="mt-1 h-2 w-16 rounded-full bg-amber-900/50" />
          </motion.div>
        </div>

        <AnimatePresence>
          {resting && (
            <motion.div
              className="absolute inset-0 z-20 bg-zinc-950"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-col items-center gap-2">
        <p className="text-xs text-zinc-500">HP {currentHp}/{maxHp}</p>
        <motion.button
          type="button"
          onClick={() => {
            if (resting) return
            setResting(true)
            window.setTimeout(() => {
              onRest()
            }, 360)
          }}
          className="px-6 py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/85 text-sm text-zinc-200"
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        >
          Rest
        </motion.button>
        <p className="text-xs uppercase tracking-wider text-zinc-600">Heal 30% HP ({healAmount})</p>
      </div>
    </SelectionScreenShell>
  )
}
