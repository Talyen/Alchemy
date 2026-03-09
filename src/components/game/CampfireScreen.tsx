import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CHARACTER_IDLE_FPS, getCharacterIdleFrames } from '@/lib/characterSprites'
import { SelectionScreenShell } from './SelectionScreenShell'

interface Props {
  characterId: string
  currentHp: number
  maxHp: number
  onRest: (healAmount: number) => void
  topLeft?: ReactNode
  showCompanion?: boolean
  companionName?: string
  companionEnemyId?: string
}

const COMPANION_SPRITE_SOURCE_BY_ENEMY_ID: Partial<Record<string, string>> = {
  greater_mimic: 'mimic',
  greater_slime: 'swampy',
}

function getCompanionFrames(enemyId: string): string[] {
  const spriteId = COMPANION_SPRITE_SOURCE_BY_ENEMY_ID[enemyId] ?? enemyId
  return Array.from({ length: 4 }, (_, i) => `assets/${spriteId}-idle-f${i}.png`)
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

type EmberFlickerState = {
  opacity: number
  scale: number
  y: number
  duration: number
}

type FlameFlickerState = {
  y: number
  x: number
  scale: number
  rotate: number
  opacity: number
  filter: string
  duration: number
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
      className="w-24 h-40 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

function CompanionSprite({ companionName, companionEnemyId }: { companionName: string; companionEnemyId: string }) {
  const frames = getCompanionFrames(companionEnemyId)
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
      alt={`${companionName} companion`}
      className="w-14 h-20 object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function CampfireScreen({ characterId, currentHp: _currentHp, maxHp, onRest, topLeft, showCompanion = false, companionName = 'Companion', companionEnemyId = 'lizard_f' }: Props) {
  const [resting, setResting] = useState(false)
  const healAmount = Math.round(maxHp * 0.3)
  const [emberFlicker, setEmberFlicker] = useState<EmberFlickerState>({
    opacity: 0.16,
    scale: 1,
    y: 0,
    duration: 0.3,
  })
  const [flameFlicker, setFlameFlicker] = useState<FlameFlickerState>({
    y: 0,
    x: 0,
    scale: 1,
    rotate: 0,
    opacity: 0.5,
    filter: 'url(#campfire-posterize) contrast(1) saturate(0.82) brightness(1.01)',
    duration: 0.32,
  })

  useEffect(() => {
    let timeoutId: number | undefined
    let active = true

    const scheduleFlicker = () => {
      if (!active) return

      const contrast = randomBetween(0.99, 1.05)
      const saturate = randomBetween(0.79, 0.87)
      const brightness = randomBetween(0.97, 1.06)

      setEmberFlicker({
        opacity: randomBetween(0.14, 0.2),
        scale: randomBetween(0.99, 1.02),
        y: randomBetween(-0.35, 0.03),
        duration: randomBetween(0.24, 0.44),
      })

      setFlameFlicker({
        y: randomBetween(-0.45, 0.14),
        x: randomBetween(-0.12, 0.12),
        scale: randomBetween(0.996, 1.012),
        rotate: randomBetween(-0.06, 0.06),
        opacity: randomBetween(0.48, 0.58),
        filter: `url(#campfire-posterize) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)})`,
        duration: randomBetween(0.24, 0.46),
      })

      timeoutId = window.setTimeout(scheduleFlicker, randomBetween(180, 420))
    }

    scheduleFlicker()
    return () => {
      active = false
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <SelectionScreenShell title="Campfire" subtitle="Rest Site" topLeft={topLeft} allowOverflowVisible titleOffsetY={14}>
      <div className="relative w-full max-w-5xl h-[72%] flex items-center justify-center overflow-visible pointer-events-none">
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden>
          <defs>
            <filter id="campfire-posterize" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="discrete" tableValues="0 0.58 1" />
                <feFuncG type="discrete" tableValues="0 0.54 1" />
                <feFuncB type="discrete" tableValues="0 0.5 1" />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>

        <div className="relative z-10 mx-auto flex w-full max-w-[460px] -translate-y-24 items-end justify-center gap-10">
          <motion.div
            className="flex w-56 justify-center"
            initial={{ opacity: 0, x: -24, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="flex items-end justify-center gap-2">
              {showCompanion && (
                <CompanionSprite companionName={companionName} companionEnemyId={companionEnemyId} />
              )}
              <CharacterSprite characterId={characterId} />
            </div>
          </motion.div>

          <motion.div
            className="relative flex w-56 flex-col items-center translate-y-[13px] overflow-visible"
            initial={{ opacity: 0, x: 24, y: 12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 }}
          >
            <motion.div
              className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-35 h-35 rounded-full"
              animate={{ opacity: [0.2, 0.3, 0.22], scale: [0.90, 1.10, 0.90] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle, rgba(251,191,36,0.22), rgba(249,115,22,0.12) 48%, rgba(120,53,15,0.05) 66%, rgba(255, 255, 255, 0) 84%)',
              }}
            />

            <div className="relative w-56 h-52 flex items-end justify-center overflow-visible">
              <motion.div
                className="pointer-events-none absolute bottom-14 left-1/2 w-20 h-16 -translate-x-1/2 rounded-full"
                animate={{ opacity: emberFlicker.opacity, scale: emberFlicker.scale, y: emberFlicker.y }}
                transition={{ duration: emberFlicker.duration, ease: 'easeInOut' }}
                style={{
                  background:
                    'radial-gradient(circle, rgba(251,191,36,0.42), rgba(249,115,22,0.22) 45%, rgba(249,115,22,0) 76%)',
                }}
              />

              <div className="relative w-5 h-5 origin-bottom scale-[7.0]">
                <img
                  src="assets/campfire-rest.png"
                  alt="Campfire"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{
                    imageRendering: 'pixelated',
                    filter: 'url(#campfire-posterize) contrast(1) saturate(0.78) brightness(1)',
                  }}
                />

                <motion.img
                  src="assets/campfire-rest.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                  animate={{
                      y: flameFlicker.y,
                      x: flameFlicker.x,
                      scale: flameFlicker.scale,
                      rotate: flameFlicker.rotate,
                      opacity: flameFlicker.opacity,
                      filter: flameFlicker.filter,
                  }}
                    transition={{ duration: flameFlicker.duration, ease: 'easeInOut' }}
                  style={{
                    imageRendering: 'pixelated',
                    clipPath: 'inset(0 0 42% 0)',
                  }}
                />
              </div>
            </div>
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

      <div className="-mt-52 w-full flex flex-col items-center gap-2 relative z-30 pointer-events-auto">
        <motion.button
          type="button"
          onClick={() => {
            if (resting) return
            setResting(true)
            window.setTimeout(() => {
              onRest(healAmount)
            }, 360)
          }}
          className="px-6 py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/85 text-sm text-emerald-300"
          whileHover={{ scale: 1.03, borderColor: 'rgba(161,161,170,0.6)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        >
          Rest
        </motion.button>
        <p className="text-xs uppercase tracking-wider text-zinc-600">
          <span className="text-emerald-300">Heal</span> {healAmount} HP
        </p>
      </div>
    </SelectionScreenShell>
  )
}
