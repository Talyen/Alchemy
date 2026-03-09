import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import { SelectionScreenShell } from './SelectionScreenShell'

interface Props {
  characterId: string
  mysteryTitle: string
  companionName: string
  companionEnemyId: string
  onBefriend: () => void
  onFight: () => void
  topLeft?: ReactNode
}

const COMPANION_SPRITE_SOURCE_BY_ENEMY_ID: Partial<Record<string, string>> = {
  greater_mimic: 'mimic',
  greater_slime: 'swampy',
}

function getCompanionFrames(enemyId: string): string[] {
  const spriteId = COMPANION_SPRITE_SOURCE_BY_ENEMY_ID[enemyId] ?? enemyId
  return Array.from({ length: 4 }, (_, i) => `assets/${spriteId}-idle-f${i}.png`)
}

function AnimatedSprite({ frames, alt }: { frames: string[]; alt: string }) {
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length)
    }, 1000 / CHARACTER_IDLE_FPS)
    return () => clearInterval(id)
  }, [frames.length])

  return (
    <img
      src={frames[frameIdx]}
      alt={alt}
      className="h-20 w-20 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function MysteryLizardScoutScreen({ characterId, mysteryTitle, companionName, companionEnemyId, onBefriend, onFight, topLeft }: Props) {
  const companionFrames = getCompanionFrames(companionEnemyId)

  return (
    <SelectionScreenShell title={mysteryTitle} subtitle="Mystery" topLeft={topLeft} allowOverflowVisible>
      <div className="w-full max-w-5xl px-12 -mt-2">
        <motion.div
          className="mx-auto max-w-3xl rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
        >
          <p className="text-sm leading-relaxed text-zinc-300 text-center">
            Ready to fight, you encounter a {companionName}. They seem scared, and a little hungry.
          </p>
        </motion.div>

        <div className="mt-6 flex items-end justify-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <AnimatedSprite frames={getCharacterIdleFrames(characterId)} alt="Player" />
          </motion.div>

          <motion.div
            className="scale-x-[-1]"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.04 }}
          >
            <AnimatedSprite frames={companionFrames} alt={companionName} />
          </motion.div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <motion.button
            type="button"
            onClick={onBefriend}
            className="w-64 rounded-2xl border-2 border-emerald-700/70 bg-zinc-950 p-5 text-left"
            whileHover={{ y: -4, scale: 1.02, borderColor: 'rgba(52,211,153,0.75)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            style={{ boxShadow: '0 0 0 1px rgba(16,185,129,0.25) inset' }}
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Friend</p>
            <p className="mt-1 text-xs text-emerald-500/90">
              Offer food and approach slowly and warmly.
            </p>
          </motion.button>

          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">or</p>

          <motion.button
            type="button"
            onClick={onFight}
            className="w-64 rounded-2xl border-2 border-red-700/70 bg-zinc-950 p-5 text-left"
            whileHover={{ y: -4, scale: 1.02, borderColor: 'rgba(248,113,113,0.75)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            style={{ boxShadow: '0 0 0 1px rgba(239,68,68,0.25) inset' }}
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-red-300">Foe</p>
            <p className="mt-1 text-xs text-red-400/90">
              Initiate combat. You monster.
            </p>
          </motion.button>
        </div>
      </div>
    </SelectionScreenShell>
  )
}
