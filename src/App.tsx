import { useState, useEffect, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useAnimationControls } from 'framer-motion'
import { RotateCcw, Sword } from 'lucide-react'
import { applyCompanionEffect, beginNextPlayerTurn, createGame, grantCardsToHand, playCard, resolveEnemyAction, resolveEnemyStartOfTurn, startEnemyTurn, startExtraTurnTransition } from './combat'
import { ALL_CARDS, BESTIARY_ENEMIES, getCharacterStarterCards, getRunCharacter } from './data'
import type { CardDef, GameState, TrinketDef } from './types'
import { EnemyPanel }      from './components/game/EnemyPanel'
import { PlayerPanel }     from './components/game/PlayerPanel'
import { Hand }            from './components/game/Hand'
import { CardPickScreen }  from './components/game/CardPickScreen'
import { CollectionScreen } from './components/game/CollectionScreen'
import { CharacterSelectScreen } from './components/game/CharacterSelectScreen'
import { ChooseDestinationScreen, type DestinationOption, type DestinationType } from './components/game/ChooseDestinationScreen'
import { CampfireScreen } from './components/game/CampfireScreen'
import { MysteryLizardScoutScreen } from './components/game/MysteryLizardScoutScreen'
import { MysteryGoldRewardScreen } from './components/game/MysteryGoldRewardScreen'
import { MysteryTrinketRewardScreen } from './components/game/MysteryTrinketRewardScreen'
import { MysteryTreasureChestScreen, type TreasureChestReward } from './components/game/MysteryTreasureChestScreen'
import { MysteryCorruptedForgeScreen } from './components/game/MysteryCorruptedForgeScreen'
import { GlobalScreenMenu } from './components/game/GlobalScreenMenu'
import { DevQaMenu } from './components/game/DevQaMenu'
import { ShopScreen, type ShopCardOffer, type ShopTrinketOffer } from './components/game/ShopScreen'
import { AlchemyScreen, type AlchemyTransformKind, type AlchemyTransformOffer } from './components/game/AlchemyScreen'
import { TalentsScreen } from './components/game/TalentsScreen'
import { OptionsScreen, type GameSettings, type OptionsTab } from './components/game/OptionsScreen'
import { TALENT_KEYWORDS, type TalentKeyword, canUnlockTalent, getEmptyUnlockedTalentNodeIdsByKeyword, getTalentBonusesFromKeywordTrees, getTalentLinksForNodes, getTalentNodesForKeyword } from './lib/talents'
import { canAppearAfter } from './lib/destinationRules'
import { ensureCtx, ensureRandomBGM, playDefeat, playGoldGain, playVictory, setAudioMix, stopBGM } from './sounds'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(pool: T[], count: number): T[] {
  return shuffle(pool).slice(0, count)
}

function textHasKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase())
}

function cardMatchesKeyword(card: CardDef, keyword: string): boolean {
  return textHasKeyword(`${card.name} ${card.description}`, keyword)
}

function trinketMatchesKeyword(trinket: ShopTrinketOffer, keyword: string): boolean {
  return textHasKeyword(`${trinket.name} ${trinket.description}`, keyword)
}

function cardWeightForTrinkets(card: CardDef, trinketIds: Set<string>): number {
  let weight = 1
  if (trinketIds.has('lucky_coin') && (cardMatchesKeyword(card, 'Gold') || cardMatchesKeyword(card, 'Holy'))) {
    weight *= 2
  }
  if (trinketIds.has('emerald') && (cardMatchesKeyword(card, 'Poison') || cardMatchesKeyword(card, 'Heal'))) {
    weight *= 2
  }
  if (trinketIds.has('ruby') && (cardMatchesKeyword(card, 'Burn') || cardMatchesKeyword(card, 'Leech'))) {
    weight *= 2
  }
  if (trinketIds.has('sapphire') && (cardMatchesKeyword(card, 'Mana') || cardMatchesKeyword(card, 'Block') || cardMatchesKeyword(card, 'Mana Crystal'))) {
    weight *= 2
  }
  return weight
}

function trinketWeightForTrinkets(trinket: ShopTrinketOffer, trinketIds: Set<string>): number {
  let weight = 1
  if (trinketIds.has('lucky_coin') && (trinketMatchesKeyword(trinket, 'Gold') || trinketMatchesKeyword(trinket, 'Holy'))) {
    weight *= 2
  }
  if (trinketIds.has('emerald') && (trinketMatchesKeyword(trinket, 'Poison') || trinketMatchesKeyword(trinket, 'Heal'))) {
    weight *= 2
  }
  if (trinketIds.has('ruby') && (trinketMatchesKeyword(trinket, 'Burn') || trinketMatchesKeyword(trinket, 'Leech'))) {
    weight *= 2
  }
  if (trinketIds.has('sapphire') && (trinketMatchesKeyword(trinket, 'Mana') || trinketMatchesKeyword(trinket, 'Block') || trinketMatchesKeyword(trinket, 'Mana Crystal'))) {
    weight *= 2
  }
  return weight
}

function weightedPickOne<T>(pool: T[], weightFn: (entry: T) => number): T | null {
  if (pool.length === 0) return null
  const weighted = pool.map(entry => ({ entry, weight: Math.max(0, weightFn(entry)) }))
  const total = weighted.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return weighted[0].entry
  let roll = Math.random() * total
  for (const item of weighted) {
    roll -= item.weight
    if (roll <= 0) return item.entry
  }
  return weighted[weighted.length - 1].entry
}

function weightedPickMany<T>(pool: T[], count: number, weightFn: (entry: T) => number): T[] {
  const nextPool = [...pool]
  const picks: T[] = []
  for (let i = 0; i < count && nextPool.length > 0; i++) {
    const picked = weightedPickOne(nextPool, weightFn)
    if (!picked) break
    picks.push(picked)
    const index = nextPool.indexOf(picked)
    if (index >= 0) nextPool.splice(index, 1)
  }
  return picks
}

function rollVisitPrice(): number {
  return Math.floor(Math.random() * 21) + 20
}

type ShopOfferMode = 'cards' | 'trinkets'

const SHOP_SYNERGY_KEYWORDS = [
  'Burn',
  'Poison',
  'Bleed',
  'Heal',
  'Block',
  'Armor',
  'Mana',
  'Mana Crystal',
  'Holy',
  'Leech',
  'Gold',
  'Slash',
  'Pierce',
  'Blunt',
  'Trap',
  'Wish',
  'Consume',
] as const

function getDeckDominantKeyword(deck: CardDef[]): string | null {
  const counts = new Map<string, number>()
  for (const card of deck) {
    const haystack = `${card.name} ${card.description}`
    for (const keyword of SHOP_SYNERGY_KEYWORDS) {
      if (!textHasKeyword(haystack, keyword)) continue
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
    }
  }

  let bestKeyword: string | null = null
  let bestCount = 0
  for (const [keyword, count] of counts.entries()) {
    if (count > bestCount) {
      bestKeyword = keyword
      bestCount = count
    }
  }

  return bestKeyword
}

// ─── Main menu ───────────────────────────────────────────────────────────────

function MainMenu({
  onStart,
  onResume,
  canResume,
  onCollection,
  onTalents,
  onOptions,
}: {
  onStart: () => void
  onResume: () => void
  canResume: boolean
  onCollection: () => void
  onTalents: () => void
  onOptions: () => void
}) {
  const MAIN_MENU_LOGO_SRC = 'assets/Alchemy Logo/Alchemy Logo-transparent.png'

  const sheenControls = useAnimationControls()
  const logoControls = useAnimationControls()
  const sheenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const rawX = useMotionValue(0.5)
  const rawY = useMotionValue(0.5)
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const rotateY = useSpring(useTransform(rawX, [0, 1], [-8, 8]), { stiffness: 420, damping: 34 })
  const rotateX = useSpring(useTransform(rawY, [0, 1], [6, -6]), { stiffness: 420, damping: 34 })
  const rotateZ = useSpring(useTransform(dragX, [-220, 220], [-8, 8]), { stiffness: 420, damping: 34 })

  const runSheenSweep = useCallback(() => {
    void sheenControls.start({
      x: 860,
      transition: { duration: 1.15, ease: [0.4, 0, 0.6, 1] },
    })
  }, [sheenControls])

  useEffect(() => {
    sheenControls.set({ x: -460 })
    runSheenSweep()
    sheenTimerRef.current = setInterval(() => {
      sheenControls.set({ x: -460 })
      runSheenSweep()
    }, 3200)
    return () => {
      if (sheenTimerRef.current) clearInterval(sheenTimerRef.current)
    }
  }, [runSheenSweep, sheenControls])

  const onTitleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    rawX.set((e.clientX - rect.left) / rect.width)
    rawY.set((e.clientY - rect.top) / rect.height)
  }

  const onTitleLeave = () => {
    rawX.set(0.5)
    rawY.set(0.5)
  }

  const handleLogoStart = useCallback(() => {
    if (isStarting) return
    setIsStarting(true)
    void logoControls.start({
      scale: [1, 0.96, 1.05, 1],
      transition: { duration: 0.24, times: [0, 0.35, 0.7, 1], ease: [0.22, 1, 0.36, 1] },
    }).then(() => {
      onStart()
    })
  }, [isStarting, logoControls, onStart])

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="relative flex items-center justify-center bg-zinc-950 overflow-hidden"
        style={{
          width: 'min(95vw, calc(94vh * var(--alchemy-viewport-ratio, 16 / 9)), var(--alchemy-viewport-width, 1440px))',
          aspectRatio: 'var(--alchemy-viewport-ratio, 16 / 9)',
        }}
      >
        <motion.div
          className="flex flex-col items-center gap-10"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
        >
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950 px-6 py-7"
            style={{ x: dragX, y: dragY, rotateX, rotateY, rotateZ, transformPerspective: 1000 }}
            animate={logoControls}
            onTap={handleLogoStart}
            drag
            dragElastic={0.22}
            dragMomentum={false}
            dragSnapToOrigin
            dragTransition={{ bounceStiffness: 380, bounceDamping: 28 }}
            whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            whileHover={{ cursor: 'grab' }}
            onMouseMove={onTitleMove}
            onMouseLeave={onTitleLeave}
          >
            <div className="relative">
              <img
                src={MAIN_MENU_LOGO_SRC}
                alt="Alchemy"
                data-testid="main-menu-logo"
                className="max-h-[140px] w-auto object-contain select-none pointer-events-none"
                style={{ imageRendering: 'auto' }}
                draggable={false}
              />
            </div>
            <motion.div
              className="absolute top-0 left-0 h-full w-1/2 pointer-events-none"
              style={{
                background: 'linear-gradient(102deg, transparent 22%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.06) 54%, transparent 78%)',
              }}
              initial={{ x: -460 }}
              animate={sheenControls}
            />
          </motion.div>

          <div className="flex items-center gap-3">
            {canResume && (
              <motion.button
                onClick={onResume}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
                style={{ background: 'rgba(39,39,42,0.5)' }}
                whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.22 } }}
              >
                <Sword size={14} className="opacity-60" />
                Resume
              </motion.button>
            )}

            {!canResume && (
              <motion.button
                onClick={onStart}
                className="flex items-center gap-2.5 px-8 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
                style={{ background: 'rgba(39,39,42,0.5)' }}
                whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
              >
                <Sword size={14} className="opacity-60" />
                Play
              </motion.button>
            )}

            <motion.button
              onClick={onTalents}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
              style={{ background: 'rgba(39,39,42,0.5)' }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
            >
              Talents
            </motion.button>

            <motion.button
              onClick={onCollection}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
              style={{ background: 'rgba(39,39,42,0.5)' }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.34 } }}
            >
              Collection
            </motion.button>

            <motion.button
              onClick={onOptions}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
              style={{ background: 'rgba(39,39,42,0.5)' }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.38 } }}
            >
              Options
            </motion.button>

          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─── Turn indicator ──────────────────────────────────────────────────────────

// Text turn indicator that slides between player (left) and enemy (right).
// Match combat row geometry: two `w-44` panels (176 px each) with `gap-52` (208 px).
// Row width is 560 px, lane centers are 88 px and 472 px.
function TurnIndicator({ isPlayerTurn }: { isPlayerTurn: boolean }) {
  return (
    <div className="relative h-9" style={{ width: 560 }}>
      <motion.div
        className="absolute top-0 flex flex-col items-center whitespace-nowrap"
        style={{ translateX: '-50%' }}
        animate={{
          left:  isPlayerTurn ? 88 : 472,
          color: isPlayerTurn ? '#93c5fd' : '#fca5a5',
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      >
        <motion.div
          className="w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: `11px solid ${isPlayerTurn ? '#93c5fd' : '#fca5a5'}`,
          }}
          animate={{ y: [-5, -7, -5] }}
          transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut' }}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={isPlayerTurn ? 'player' : 'enemy'}
            className="mt-1 text-[10px] font-semibold tracking-[0.12em] uppercase"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.12 }}
          >
            {isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

type Screen = 'menu' | 'character-select' | 'game' | 'reward' | 'destination' | 'collection' | 'talents' | 'options' | 'wish' | 'shop' | 'alchemy' | 'campfire' | 'mystery' | 'mystery-chest' | 'mystery-reward' | 'mystery-gold-reward' | 'mystery-corrupted-forge' | 'mystery-mirage-market'
type RunScreen = 'game' | 'reward' | 'destination' | 'wish' | 'shop' | 'alchemy' | 'campfire' | 'mystery' | 'mystery-chest' | 'mystery-reward' | 'mystery-gold-reward' | 'mystery-corrupted-forge' | 'mystery-mirage-market'

type MetaProgressionV1 = {
  runsCompleted: number
  insight: number
  startingGoldBonus: number
  alchemyUnlocked: boolean
  roomsPlayedTotal: number
  keywordTalentPointsEarned: Record<TalentKeyword, number>
  keywordTalentProgress: Record<TalentKeyword, number>
  talentUnlockedNodeIdsByKeyword: Record<TalentKeyword, string[]>
}

type PersistedProgressV1 = {
  encounteredEnemyIds: string[]
  encounteredCardIds: string[]
  encounteredTrinketIds: string[]
  meta?: MetaProgressionV1
  settings?: GameSettings
}

type PersistedRunV1 = {
  version: 1
  lastRunScreen: RunScreen
  persistentHp: number
  persistentGold: number
  runExtraCards: CardDef[]
  runDeckCards?: CardDef[]
  pickOptions: CardDef[]
  destinationOptions: DestinationOption[]
  currentRoomLabel: string
  selectedCharacterId: string
  gameState: GameState
  isEnemyActing: boolean
  collectionReturnScreen: Screen
  shopOffers: ShopCardOffer[]
  shopTrinketOffers: ShopTrinketOffer[]
  alchemyTransformOffers?: AlchemyTransformOffer[]
  alchemyPotionOffer?: ShopCardOffer | null
  alchemyPotionOffer2?: ShopCardOffer | null
  lastChosenDestinationType?: DestinationType | null
  shopRefreshUsed?: boolean
  shopDestroyUsed?: boolean
  alchemyRefreshUsed?: boolean
  shopRefreshCost?: number
  shopDestroyCost?: number
  alchemyRefreshCost?: number
  alchemyPotionCost?: number
  alchemyMixCost?: number
  shopVisitCount?: number
  shopOfferMode?: ShopOfferMode
  runTrinkets: TrinketDef[]
  floorsCleared?: number
  rewardGoldFound: number
  mysteryGoldFound: number
  activeMysteryCompanionEventId?: string | null
  activeRunCompanionEventId?: string | null
  chestReward?: TreasureChestReward | null
  encounteredEnemyIds: string[]
  encounteredCardIds: string[]
  encounteredTrinketIds: string[]
  seenMysteryEventIds?: string[]
}

const RUN_SCREENS: RunScreen[] = ['game', 'reward', 'destination', 'wish', 'shop', 'alchemy', 'campfire', 'mystery', 'mystery-chest', 'mystery-reward', 'mystery-gold-reward', 'mystery-corrupted-forge', 'mystery-mirage-market']
const PROGRESSION_STORAGE_KEY = 'alchemy.progress.v1'
const RUN_STORAGE_KEY = 'alchemy.run.v1'
const SETTINGS_STORAGE_KEY = 'alchemy.settings.v1'

const DEFAULT_SETTINGS: GameSettings = {
  display: { resolutionPreset: '1600x900' },
  audio: { master: 100, music: 70, sfx: 80 },
}

const TALENT_MATCH_KEYWORDS_BY_TREE: Record<TalentKeyword, string[]> = {
  Burn: ['Burn', 'Fire'],
  Poison: ['Poison'],
  Mana: ['Mana', 'Mana Crystal'],
  Gold: ['Gold', 'Consume', 'Wish'],
  Physical: ['Slash', 'Pierce', 'Blunt', 'Bleed', 'Trap', 'Leech'],
  Block: ['Block', 'Armor'],
  Heal: ['Heal', 'Leech', 'Ailment'],
  Holy: ['Holy', 'Wish', 'Cleanse'],
}

const DEFAULT_KEYWORD_POINTS: Record<TalentKeyword, number> = {
  Burn: 0,
  Poison: 0,
  Mana: 0,
  Gold: 0,
  Physical: 0,
  Block: 0,
  Heal: 0,
  Holy: 0,
}

const DEFAULT_UNLOCKED_BY_KEYWORD: Record<TalentKeyword, string[]> = {
  Burn: [],
  Poison: [],
  Mana: [],
  Gold: [],
  Physical: [],
  Block: [],
  Heal: [],
  Holy: [],
}

const DEFAULT_META_PROGRESSION: MetaProgressionV1 = {
  runsCompleted: 0,
  insight: 0,
  startingGoldBonus: 0,
  alchemyUnlocked: true,
  roomsPlayedTotal: 0,
  keywordTalentPointsEarned: { ...DEFAULT_KEYWORD_POINTS },
  keywordTalentProgress: { ...DEFAULT_KEYWORD_POINTS },
  talentUnlockedNodeIdsByKeyword: { ...DEFAULT_UNLOCKED_BY_KEYWORD },
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeSettings(settings?: Partial<GameSettings>): GameSettings {
  if (!settings) return DEFAULT_SETTINGS
  return {
    display: {
      resolutionPreset: settings.display?.resolutionPreset ?? DEFAULT_SETTINGS.display.resolutionPreset,
    },
    audio: {
      master: clampPercent(settings.audio?.master ?? DEFAULT_SETTINGS.audio.master),
      music: clampPercent(settings.audio?.music ?? DEFAULT_SETTINGS.audio.music),
      sfx: clampPercent(settings.audio?.sfx ?? DEFAULT_SETTINGS.audio.sfx),
    },
  }
}

function normalizeKeywordPoints(input?: Partial<Record<TalentKeyword, number>>): Record<TalentKeyword, number> {
  return {
    Burn: input?.Burn ?? 0,
    Poison: input?.Poison ?? 0,
    Mana: input?.Mana ?? 0,
    Gold: input?.Gold ?? 0,
    Physical: input?.Physical ?? 0,
    Block: input?.Block ?? 0,
    Heal: input?.Heal ?? 0,
    Holy: input?.Holy ?? 0,
  }
}

function normalizeUnlockedByKeyword(input?: Partial<Record<TalentKeyword, string[]>>): Record<TalentKeyword, string[]> {
  return {
    Burn: input?.Burn ?? [],
    Poison: input?.Poison ?? [],
    Mana: input?.Mana ?? [],
    Gold: input?.Gold ?? [],
    Physical: input?.Physical ?? [],
    Block: input?.Block ?? [],
    Heal: input?.Heal ?? [],
    Holy: input?.Holy ?? [],
  }
}

function normalizeMetaProgression(meta?: Partial<MetaProgressionV1>): MetaProgressionV1 {
  if (!meta) return DEFAULT_META_PROGRESSION

  const legacyTalentPointsEarned = Number((meta as any).talentPointsEarned ?? 0)
  const legacyTalentUnlockedNodeIds = Array.isArray((meta as any).talentUnlockedNodeIds)
    ? ((meta as any).talentUnlockedNodeIds as string[])
    : []

  const keywordTalentPointsEarned = normalizeKeywordPoints(meta.keywordTalentPointsEarned)
  if (legacyTalentPointsEarned > 0 && TALENT_KEYWORDS.every(keyword => keywordTalentPointsEarned[keyword] === 0)) {
    keywordTalentPointsEarned.Physical = legacyTalentPointsEarned
  }

  const unlockedByKeyword = normalizeUnlockedByKeyword(meta.talentUnlockedNodeIdsByKeyword)
  if (legacyTalentUnlockedNodeIds.length > 0 && TALENT_KEYWORDS.every(keyword => unlockedByKeyword[keyword].length === 0)) {
    unlockedByKeyword.Physical = legacyTalentUnlockedNodeIds
  }

  return {
    runsCompleted: meta.runsCompleted ?? 0,
    insight: meta.insight ?? 0,
    startingGoldBonus: meta.startingGoldBonus ?? 0,
    alchemyUnlocked: meta.alchemyUnlocked ?? true,
    roomsPlayedTotal: meta.roomsPlayedTotal ?? 0,
    keywordTalentPointsEarned,
    keywordTalentProgress: normalizeKeywordPoints(meta.keywordTalentProgress),
    talentUnlockedNodeIdsByKeyword: unlockedByKeyword,
  }
}

type CompanionAttackProfile = {
  damage?: number
  burn?: number
  poison?: number
  bleed?: number
}

type CompanionVariantDef = {
  mysteryId: string
  mysteryTitle: string
  companionName: string
  companionEnemyId: string
  attack: CompanionAttackProfile
  collarTrinket: Omit<ShopTrinketOffer, 'price'>
}

const COMPANION_MYSTERY_TITLE = 'Friend or Foe?'

const COMPANION_VARIANTS: CompanionVariantDef[] = [
  {
    mysteryId: 'lizard_scout',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Lizard Scout',
    companionEnemyId: 'lizard_f',
    attack: { damage: 6 },
    collarTrinket: {
      id: 'collar_lizard_scout',
      name: 'Scout Collar',
      description: 'Lizard Scout strikes at the end of your turn.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
  {
    mysteryId: 'lizard_raider',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Lizard Raider',
    companionEnemyId: 'lizard_m',
    attack: { damage: 7 },
    collarTrinket: {
      id: 'collar_lizard_raider',
      name: 'Raider Collar',
      description: 'Lizard Raider strikes at the end of your turn.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
  {
    mysteryId: 'imp',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Imp',
    companionEnemyId: 'imp',
    attack: { damage: 5 },
    collarTrinket: {
      id: 'collar_imp',
      name: 'Imp Collar',
      description: 'Imp strikes at the end of your turn.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
  {
    mysteryId: 'goblin',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Goblin',
    companionEnemyId: 'goblin',
    attack: { damage: 5 },
    collarTrinket: {
      id: 'collar_goblin',
      name: 'Goblin Collar',
      description: 'Goblin strikes at the end of your turn.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
  {
    mysteryId: 'skeleton',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Skeleton',
    companionEnemyId: 'skelet',
    attack: { damage: 6 },
    collarTrinket: {
      id: 'collar_skeleton',
      name: 'Skeleton Collar',
      description: 'Skeleton strikes at the end of your turn.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
  {
    mysteryId: 'snake',
    mysteryTitle: COMPANION_MYSTERY_TITLE,
    companionName: 'Snake',
    companionEnemyId: 'snake',
    attack: { damage: 4, poison: 1 },
    collarTrinket: {
      id: 'collar_snake',
      name: 'Snake Collar',
      description: 'Snake strikes at the end of your turn and inflicts Poison.',
      iconSrc: 'assets/trinkets/collar.png',
    },
  },
]

const COMPANION_VARIANTS_BY_EVENT_ID = new Map(COMPANION_VARIANTS.map(companion => [companion.mysteryId, companion]))
const LEGACY_COMPANION_COLLAR_ID = 'collar'

const CACHE_OF_COINS_MYSTERY_TITLE = 'Cache of Coins'
const TREASURE_CHEST_MYSTERY_TITLE = 'Treasure Chest'
const CORRUPTED_FORGE_MYSTERY_TITLE = 'Corrupted Forge'
const MIRAGE_MARKET_MYSTERY_TITLE = 'Mirage Market'

const MYSTERY_EVENT_POOL = ['cache_of_coins', 'treasure_chest', 'corrupted_forge', 'mirage_market', ...COMPANION_VARIANTS.map(companion => companion.mysteryId)] as const

const ALL_TRINKET_OFFERS: ShopTrinketOffer[] = [
  {
    id: 'special_delivery',
    name: 'Special Delivery',
    description: 'Create a Random card each turn.',
    price: 25,
    iconSrc: 'assets/trinkets/special-delivery.png',
  },
  {
    id: 'mail_delivery',
    name: 'Mail Delivery',
    description: 'Draw an extra card each turn.',
    price: 25,
    iconSrc: 'assets/trinkets/mail-delivery.png',
  },
  {
    id: 'campfire',
    name: 'Campfire',
    description: 'Heal 10 HP after each battle.',
    price: 25,
    iconSrc: 'assets/trinkets/fc23.png',
  },
  {
    id: 'equivalent_exchange',
    name: 'Equivalent Exchange',
    description: 'Randomize 1 card each turn.',
    price: 25,
    iconSrc: 'assets/trinkets/equivalent-exchange.png',
  },
  {
    id: 'green_thumb',
    name: 'Green Thumb',
    description: 'Heal effect increased by 1.',
    price: 25,
    iconSrc: 'assets/trinkets/green-thumb.png',
  },
  {
    id: 'torch',
    name: 'Torch',
    description: 'Enemies start combat with 5 Burn.',
    price: 25,
    iconSrc: 'assets/trinkets/torch.png',
  },
  {
    id: 'spell_tome',
    name: 'Spell Tome',
    description: 'Start combat with two random Wizard cards.',
    price: 25,
    iconSrc: 'assets/trinkets/spell-tome.png',
  },
  {
    id: 'holy_lantern',
    name: 'Holy Lantern',
    description: 'Holy Damage doubled against enemies with Burn.',
    price: 25,
    iconSrc: 'assets/trinkets/holy-lantern.png',
  },
  {
    id: 'scales_of_justice',
    name: 'Scales of Justice',
    description: 'Heal 1 to the lowest health unit when dealing Holy damage.',
    price: 25,
    iconSrc: 'assets/trinkets/scales-of-justice.png',
  },
  {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    description: 'Find more Gold and Holy cards and trinkets.',
    price: 25,
    iconSrc: 'assets/trinkets/lucky-coin.png',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Find more Poison and Heal cards and trinkets.',
    price: 25,
    iconSrc: 'assets/trinkets/emerald.png',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    description: 'Find more Burn and Leech cards and trinkets.',
    price: 25,
    iconSrc: 'assets/trinkets/ruby.png',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    description: 'Find more Mana and Block cards and trinkets.',
    price: 25,
    iconSrc: 'assets/trinkets/sapphire.png',
  },
  {
    id: 'flash_fire',
    name: 'Flash Fire',
    description: 'The first Burn card you play each combat costs 0 Mana.',
    price: 25,
    iconSrc: 'assets/trinkets/fc761.png',
  },
  {
    id: 'hidden_blade',
    name: 'Hidden Blade',
    description: 'The first Pierce card you play each combat costs 0 Mana.',
    price: 25,
    iconSrc: 'assets/trinkets/fc1444.png',
  },
  {
    id: 'shield_of_faith',
    name: 'Shield of Faith',
    description: 'Holy cards grant +1 extra Block when played.',
    price: 25,
    iconSrc: 'assets/trinkets/fc854.png',
  },
  {
    id: 'camp_kit',
    name: 'Camp Kit',
    description: 'Campfire Rest heals 10% more HP.',
    price: 25,
    iconSrc: 'assets/trinkets/fc910.png',
  },
  {
    id: 'mana_crystal_trinket',
    name: 'Mana Crystal',
    description: 'Gain +1 max Mana at the start of each combat.',
    price: 25,
    iconSrc: 'assets/trinkets/fc927.png',
  },
  {
    id: 'wardstone_shard',
    name: 'Wardstone Shard',
    description: 'Negate the first enemy debuff applied to you each combat.',
    price: 25,
    iconSrc: 'assets/trinkets/emerald.png',
  },
  {
    id: 'shieldbreaker',
    name: 'Shieldbreaker',
    description: 'Deal double direct damage to enemies that currently have Block.',
    price: 25,
    iconSrc: 'assets/trinkets/fc1107.png',
  },
  {
    id: 'heatforged_shield',
    name: 'Heatforged Shield',
    description: 'Reduce Burn damage you take by 1.',
    price: 25,
    iconSrc: 'assets/trinkets/fc853.png',
  },
  {
    id: 'golden_flail',
    name: 'Golden Flail',
    description: 'Gain 1 Gold whenever you deal Blunt damage.',
    price: 25,
    iconSrc: 'assets/trinkets/fc1555.png',
  },
  {
    id: 'golden_great_axe',
    name: 'Golden Great Axe',
    description: 'Gain 1 Gold whenever you play a Slash card.',
    price: 25,
    iconSrc: 'assets/trinkets/fc1546.png',
  },
  {
    id: 'cloak_of_flames',
    name: 'Cloak of Flames',
    description: 'At the start of your turn, inflict 1 Burn on the enemy.',
    price: 25,
    iconSrc: 'assets/trinkets/fc2095.png',
  },
]

function getPreviewMode(): 'destination' | null {
  const params = new URLSearchParams(window.location.search)
  const preview = params.get('preview')
  if (preview === 'destination') return 'destination'
  return null
}

const DESTINATION_POOL: DestinationOption[] = [
  { type: 'enemy', title: 'Combat', subtitle: 'Face a standard enemy encounter.' },
  { type: 'elite', title: 'Elite', subtitle: 'A dangerous foe with better rewards.' },
  { type: 'rest', title: 'Campfire', subtitle: 'Recover 30% of your max health.' },
  { type: 'shop', title: 'Shop', subtitle: 'A quiet stop before the next battle.' },
  { type: 'alchemy', title: "Alchemist's Hut", subtitle: 'Brew potions and transform cards.' },
  { type: 'mystery', title: 'Mystery', subtitle: 'An unknown event awaits.' },
]

const ALCHEMY_TRANSFORM_LIBRARY: Array<Pick<AlchemyTransformOffer, 'kind' | 'title' | 'description'>> = [
  {
    kind: 'cost_down',
    title: 'Transform a Card: Reduce Mana cost by 1',
    description: 'Applies to any card with cost above 0 for the remainder of this run.',
  },
  {
    kind: 'burn_up',
    title: 'Transform a Card: Increase Burn by 1',
    description: 'Applies only to cards that already have Burn.',
  },
  {
    kind: 'poison_up',
    title: 'Transform a Card: Increase Poison by 1',
    description: 'Applies only to cards that already have Poison.',
  },
  {
    kind: 'bleed_up',
    title: 'Transform a Card: Increase Bleed by 1',
    description: 'Applies only to cards that already have Bleed.',
  },
  {
    kind: 'heal_up',
    title: 'Transform a Card: Increase Heal by 2',
    description: 'Applies only to cards that already heal.',
  },
]

function isPotionCard(card: CardDef): boolean {
  return card.name.toLowerCase().includes('potion')
}

function addToKeywordLine(description: string, effectName: 'Burn' | 'Poison' | 'Bleed' | 'Heal', amount: number): string {
  const valueBeforeKeyword = new RegExp(`(\\b)(\\d+)(\\s+${effectName}\\b)`, 'i')
  if (valueBeforeKeyword.test(description)) {
    return description.replace(valueBeforeKeyword, (_match, start: string, value: string, suffix: string) => `${start}${Number(value) + amount}${suffix}`)
  }

  const valueAfterKeyword = new RegExp(`(\\b${effectName}\\s+)(\\d+)`, 'i')
  if (valueAfterKeyword.test(description)) {
    return description.replace(valueAfterKeyword, (_match, prefix: string, value: string) => `${prefix}${Number(value) + amount}`)
  }

  return description
}

function applyTransformToCard(card: CardDef, kind: AlchemyTransformKind): CardDef {
  if (kind === 'cost_down' && card.cost > 0) {
    return {
      ...card,
      cost: Math.max(0, card.cost - 1),
    }
  }

  if (kind === 'burn_up' && (card.effect.burn ?? 0) > 0) {
    return {
      ...card,
      effect: { ...card.effect, burn: (card.effect.burn ?? 0) + 1 },
      description: addToKeywordLine(card.description, 'Burn', 1),
    }
  }

  if (kind === 'poison_up' && (card.effect.poison ?? 0) > 0) {
    return {
      ...card,
      effect: { ...card.effect, poison: (card.effect.poison ?? 0) + 1 },
      description: addToKeywordLine(card.description, 'Poison', 1),
    }
  }

  if (kind === 'bleed_up' && (card.effect.bleed ?? 0) > 0) {
    return {
      ...card,
      effect: { ...card.effect, bleed: (card.effect.bleed ?? 0) + 1 },
      description: addToKeywordLine(card.description, 'Bleed', 1),
    }
  }

  if (kind === 'heal_up' && (card.effect.heal ?? 0) > 0) {
    return {
      ...card,
      effect: { ...card.effect, heal: (card.effect.heal ?? 0) + 2 },
      description: addToKeywordLine(card.description, 'Heal', 2),
    }
  }

  return card
}

function buildMixedPotionDescription(effect: CardDef['effect']): string {
  const lines: string[] = []
  if ((effect.heal ?? 0) > 0) lines.push(`Heal ${effect.heal}`)
  if ((effect.mana ?? 0) > 0) lines.push(`Gain ${effect.mana} Mana`)
  if ((effect.cleanse ?? 0) > 0) lines.push(`Remove ${effect.cleanse} Ailment${effect.cleanse === 1 ? '' : 's'}`)
  if ((effect.burn ?? 0) > 0) lines.push(`Deal ${effect.burn} Burn`)
  if ((effect.poison ?? 0) > 0) lines.push(`Deal ${effect.poison} Poison`)
  if ((effect.bleed ?? 0) > 0) lines.push(`Deal ${effect.bleed} Bleed`)
  lines.push('Consume')
  return lines.join('\n')
}

function mixPotionCards(first: CardDef, second: CardDef): CardDef {
  const effect: CardDef['effect'] = {
    heal: (first.effect.heal ?? 0) + (second.effect.heal ?? 0),
    mana: (first.effect.mana ?? 0) + (second.effect.mana ?? 0),
    cleanse: (first.effect.cleanse ?? 0) + (second.effect.cleanse ?? 0),
    burn: (first.effect.burn ?? 0) + (second.effect.burn ?? 0),
    poison: (first.effect.poison ?? 0) + (second.effect.poison ?? 0),
    bleed: (first.effect.bleed ?? 0) + (second.effect.bleed ?? 0),
  }

  return {
    id: 'mixed_potion',
    name: 'Mixed Potion',
    cost: 1,
    type: 'heal',
    description: buildMixedPotionDescription(effect),
    effect,
  }
}

function withCorruptTag(name: string): string {
  return name.includes('[Corrupt]') ? name : `${name} [Corrupt]`
}

function withCorruptNote(description: string, note: string): string {
  const clean = description.split('\n').filter(line => !line.startsWith('Corrupt:')).join('\n')
  return `${clean}\nCorrupt: ${note}`
}

function applyMirageDiscountToCardOffers(offers: ShopCardOffer[]): ShopCardOffer[] {
  return offers.map(offer => ({ ...offer, price: Math.max(1, Math.floor(offer.price / 2)) }))
}

function applyMirageDiscountToTrinketOffers(offers: ShopTrinketOffer[]): ShopTrinketOffer[] {
  return offers.map(offer => ({ ...offer, price: Math.max(1, Math.floor(offer.price / 2)) }))
}

function applyCorruptedForgeMutation(card: CardDef): CardDef {
  const numericKeys: Array<keyof CardDef['effect']> = ['damage', 'block', 'heal', 'burn', 'poison', 'bleed', 'gold', 'mana']
  const presentNumericKeys = numericKeys.filter(key => typeof card.effect[key] === 'number' && (card.effect[key] as number) > 0)
  const outcomes = ['shift', 'scale', 'bonus', 'transform'] as const
  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)]

  if (outcome === 'transform') {
    const transformed = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)]
    return {
      ...transformed,
      id: card.id,
      name: withCorruptTag(transformed.name),
      description: withCorruptNote(transformed.description, `Twisted into ${transformed.name}.`),
    }
  }

  if (outcome === 'bonus') {
    const bonusType = Math.floor(Math.random() * 3)
    if (bonusType === 0) {
      return {
        ...card,
        name: withCorruptTag(card.name),
        effect: { ...card.effect, gold: (card.effect.gold ?? 0) + 1 },
        description: withCorruptNote(card.description, 'Gain 1 Gold when played.'),
      }
    }
    if (bonusType === 1) {
      return {
        ...card,
        name: withCorruptTag(card.name),
        effect: { ...card.effect, burn: (card.effect.burn ?? 0) + 1 },
        description: withCorruptNote(card.description, 'Apply +1 Burn.'),
      }
    }
    return {
      ...card,
      name: withCorruptTag(card.name),
      effect: { ...card.effect, block: (card.effect.block ?? 0) + 2 },
      description: withCorruptNote(card.description, 'Gain +2 Block.'),
    }
  }

  if (presentNumericKeys.length === 0) {
    return {
      ...card,
      name: withCorruptTag(card.name),
      effect: { ...card.effect, gold: (card.effect.gold ?? 0) + 1 },
      description: withCorruptNote(card.description, 'Gain 1 Gold when played.'),
    }
  }

  const key = presentNumericKeys[Math.floor(Math.random() * presentNumericKeys.length)]
  const current = (card.effect[key] as number) ?? 0
  if (outcome === 'shift') {
    const delta = Math.random() < 0.5 ? -1 : 1
    const next = Math.max(0, current + delta)
    return {
      ...card,
      name: withCorruptTag(card.name),
      effect: { ...card.effect, [key]: next },
      description: withCorruptNote(card.description, `${String(key)} ${delta > 0 ? '+1' : '-1'}.`),
    }
  }

  const next = Math.max(0, Math.random() < 0.5 ? Math.floor(current / 2) : current * 2)
  return {
    ...card,
    name: withCorruptTag(card.name),
    effect: { ...card.effect, [key]: next },
    description: withCorruptNote(card.description, `${String(key)} ${next > current ? 'doubled' : 'halved'}.`),
  }
}

export default function App() {
  const ENEMY_START_DELAY_MS = 350
  const ENEMY_ACTION_DELAY_MS = 850
  const ENEMY_END_DELAY_MS = 650
  const BONUS_TURN_DRAW_DELAY_MS = 340
  const isDevBuild = import.meta.env.DEV

  const previewMode = getPreviewMode()
  const [screen, setScreen]               = useState<Screen>('menu')
  const [persistentHp, setPersistentHp]   = useState(30)
  const [persistentGold, setPersistentGold] = useState(0)
  const [runExtraCards, setRunExtraCards] = useState<CardDef[]>([])
  const [runDeckCards, setRunDeckCards] = useState<CardDef[]>([])
  const [pickOptions, setPickOptions]     = useState<CardDef[]>([])
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([])
  const [currentRoomLabel, setCurrentRoomLabel] = useState('Start')
  const [selectedCharacterId, setSelectedCharacterId] = useState('knight')
  const [gameState, setGameState]         = useState<GameState>(createGame)
  const [isEnemyActing, setIsEnemyActing] = useState(false)
  const [musicEnabled]   = useState(true)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [optionsTab, setOptionsTab] = useState<OptionsTab>('display')
  const [optionsReturnScreen, setOptionsReturnScreen] = useState<Screen>('menu')
  const [activeTalentKeyword, setActiveTalentKeyword] = useState<TalentKeyword>('Burn')
  const musicEnabledRef = useRef(musicEnabled)
  const hasHydratedPersistenceRef = useRef(false)
  const [collectionReturnScreen, setCollectionReturnScreen] = useState<Screen>('menu')
  const [lastRunScreen, setLastRunScreen] = useState<RunScreen>('game')
  const [savedRun, setSavedRun] = useState<PersistedRunV1 | null>(null)
  const [runInProgress, setRunInProgress] = useState(false)
  const [metaProgress, setMetaProgress] = useState<MetaProgressionV1>(DEFAULT_META_PROGRESSION)
  const [shopOffers, setShopOffers] = useState<ShopCardOffer[]>([])
  const [shopTrinketOffers, setShopTrinketOffers] = useState<ShopTrinketOffer[]>([])
  const [alchemyTransformOffers, setAlchemyTransformOffers] = useState<AlchemyTransformOffer[]>([])
  const [alchemyPotionOffer, setAlchemyPotionOffer] = useState<ShopCardOffer | null>(null)
  const [alchemyPotionOffer2, setAlchemyPotionOffer2] = useState<ShopCardOffer | null>(null)
  const [shopRefreshUsed, setShopRefreshUsed] = useState(false)
  const [shopDestroyUsed, setShopDestroyUsed] = useState(false)
  const [alchemyRefreshUsed, setAlchemyRefreshUsed] = useState(false)
  const [shopRefreshCost, setShopRefreshCost] = useState(25)
  const [shopDestroyCost, setShopDestroyCost] = useState(25)
  const [alchemyRefreshCost, setAlchemyRefreshCost] = useState(25)
  const [alchemyPotionCost, setAlchemyPotionCost] = useState(25)
  const [alchemyMixCost, setAlchemyMixCost] = useState(25)
  const [shopVisitCount, setShopVisitCount] = useState(0)
  const [shopOfferMode, setShopOfferMode] = useState<ShopOfferMode>('cards')
  const [runTrinkets, setRunTrinkets] = useState<TrinketDef[]>([])
  const [seenMysteryEventIds, setSeenMysteryEventIds] = useState<Set<string>>(new Set())
  const [floorsCleared, setFloorsCleared] = useState(0)
  const [rewardGoldFound, setRewardGoldFound] = useState(0)
  const [mysteryGoldFound, setMysteryGoldFound] = useState(0)
  const [lastChosenDestinationType, setLastChosenDestinationType] = useState<DestinationType | null>(null)
  const [activeMysteryCompanionEventId, setActiveMysteryCompanionEventId] = useState<string | null>(null)
  const [activeRunCompanionEventId, setActiveRunCompanionEventId] = useState<string | null>(null)
  const [mysteryChestReward, setMysteryChestReward] = useState<TreasureChestReward | null>(null)
  const [pendingCompanionTurn, setPendingCompanionTurn] = useState(false)
  const [companionAttackTick, setCompanionAttackTick] = useState(0)
  const [playerAttackTick, setPlayerAttackTick] = useState(0)
  const [encounteredEnemyIds, setEncounteredEnemyIds] = useState<Set<string>>(new Set())
  const [encounteredCardIds, setEncounteredCardIds] = useState<Set<string>>(new Set())
  const [encounteredTrinketIds, setEncounteredTrinketIds] = useState<Set<string>>(new Set())
  const activeCompanion = COMPANION_VARIANTS_BY_EVENT_ID.get(activeRunCompanionEventId ?? '') ?? null
  const activeMysteryCompanion = COMPANION_VARIANTS_BY_EVENT_ID.get(activeMysteryCompanionEventId ?? '') ?? COMPANION_VARIANTS[0]
  const hasCompanion = Boolean(
    activeCompanion
    && runTrinkets.some(trinket => trinket.id === activeCompanion.collarTrinket.id || trinket.id === LEGACY_COMPANION_COLLAR_ID),
  )
  const canResume = runInProgress || savedRun !== null
  const unlockedTalentNodeIdsByKeyword = getEmptyUnlockedTalentNodeIdsByKeyword()
  for (const keyword of TALENT_KEYWORDS) {
    unlockedTalentNodeIdsByKeyword[keyword] = new Set(metaProgress.talentUnlockedNodeIdsByKeyword[keyword] ?? [])
  }
  const unlockedTalentNodeIds = unlockedTalentNodeIdsByKeyword[activeTalentKeyword]
  const availableTalentPoints = Math.max(0, (metaProgress.keywordTalentPointsEarned[activeTalentKeyword] ?? 0) - unlockedTalentNodeIds.size)
  const talentBonuses = getTalentBonusesFromKeywordTrees(unlockedTalentNodeIdsByKeyword)
  const runMaxHp = 30 + talentBonuses.runMaxHpBonus
  const previousEnemyHpRef = useRef(gameState.enemy.hp)

  const applyTalentCardBonuses = useCallback((card: CardDef): CardDef => {
    let nextCard = card
    if (talentBonuses.burnCardBonus > 0 && (nextCard.effect.burn ?? 0) > 0) {
      nextCard = { ...nextCard, effect: { ...nextCard.effect, burn: (nextCard.effect.burn ?? 0) + talentBonuses.burnCardBonus } }
    }
    if (talentBonuses.poisonCardBonus > 0 && (nextCard.effect.poison ?? 0) > 0) {
      nextCard = { ...nextCard, effect: { ...nextCard.effect, poison: (nextCard.effect.poison ?? 0) + talentBonuses.poisonCardBonus } }
    }
    if (talentBonuses.healCardBonus > 0 && (nextCard.effect.heal ?? 0) > 0) {
      nextCard = { ...nextCard, effect: { ...nextCard.effect, heal: (nextCard.effect.heal ?? 0) + talentBonuses.healCardBonus } }
    }
    if (talentBonuses.damageCardBonus > 0 && (nextCard.effect.damage ?? 0) > 0) {
      nextCard = { ...nextCard, effect: { ...nextCard.effect, damage: (nextCard.effect.damage ?? 0) + talentBonuses.damageCardBonus } }
    }
    return nextCard
  }, [talentBonuses.burnCardBonus, talentBonuses.damageCardBonus, talentBonuses.healCardBonus, talentBonuses.poisonCardBonus])

  const applyCombatTalentBonuses = useCallback((state: GameState): GameState => {
    const maxManaBonus = talentBonuses.combatMaxManaBonus
    const blockBonus = talentBonuses.combatStartingBlockBonus
    const talentTrinketIds = [
      ...(talentBonuses.burnDamageBonus > 0 ? ['talent_controlled_burn'] : []),
      ...(talentBonuses.burnVsBlockDouble ? ['talent_melt_armor'] : []),
      ...(talentBonuses.burnDamageTakenHalf ? ['talent_avatar_of_fire'] : []),
      ...(talentBonuses.holyFromBurnPercent > 0 ? ['talent_holy_flame'] : []),
      ...(talentBonuses.drawExtraBurnCardPerTurn > 0 ? ['talent_hot_streak'] : []),
      ...(talentBonuses.pyromania ? ['talent_pyromania'] : []),
    ]
    if (maxManaBonus <= 0 && blockBonus <= 0 && talentTrinketIds.length === 0) return state

    const trinketIds = [...state.trinketIds, ...talentTrinketIds]
    return {
      ...state,
      trinketIds,
      maxMana: state.maxMana + maxManaBonus,
      mana: state.mana + maxManaBonus,
      player: {
        ...state.player,
        block: state.player.block + blockBonus,
      },
      log: [
        ...state.log,
        ...(maxManaBonus > 0 ? [`  -> Talent: +${maxManaBonus} Max Mana this combat.`] : []),
        ...(blockBonus > 0 ? [`  -> Talent: +${blockBonus} Block at combat start.`] : []),
        ...(talentTrinketIds.length > 0 ? ['  -> Talent: Burn specialization effects active.'] : []),
      ].slice(-10),
    }
  }, [talentBonuses.burnDamageBonus, talentBonuses.burnDamageTakenHalf, talentBonuses.burnVsBlockDouble, talentBonuses.combatMaxManaBonus, talentBonuses.combatStartingBlockBonus, talentBonuses.drawExtraBurnCardPerTurn, talentBonuses.holyFromBurnPercent, talentBonuses.pyromania])

  const buildDestinationOptions = useCallback((): DestinationOption[] => {
    const available = DESTINATION_POOL.filter(option => {
      if (option.type === 'alchemy' && !metaProgress.alchemyUnlocked) return false
      if (!canAppearAfter(lastChosenDestinationType, option.type)) return false
      if (lastChosenDestinationType === 'shop' && option.type === 'shop') return false
      if (lastChosenDestinationType === 'alchemy' && (option.type === 'alchemy' || option.type === 'shop')) return false
      return true
    })
    const guaranteedCombatPool = available.filter(option => option.type === 'enemy' || option.type === 'elite')

    if (!metaProgress.alchemyUnlocked) {
      const guaranteedCombat = pickRandom(guaranteedCombatPool, 1)
      const filler = pickRandom(available.filter(option => !guaranteedCombat.some(entry => entry.type === option.type)), 2)
      return shuffle([...guaranteedCombat, ...filler])
    }

    // Make Alchemist's Hut show up often enough to be discoverable while still ensuring combat appears.
    const alchemy = available.find(option => option.type === 'alchemy')
    if (!alchemy) {
      const guaranteedCombat = pickRandom(guaranteedCombatPool, 1)
      const filler = pickRandom(available.filter(option => !guaranteedCombat.some(entry => entry.type === option.type)), 2)
      return shuffle([...guaranteedCombat, ...filler])
    }

    const mustIncludeAlchemy = Math.random() < 0.6
    const seed = mustIncludeAlchemy ? [alchemy] : []
    const guaranteedCombat = pickRandom(
      guaranteedCombatPool.filter(option => !seed.some(entry => entry.type === option.type)),
      1,
    )
    const chosenTypes = new Set([...seed, ...guaranteedCombat].map(option => option.type))
    const filler = pickRandom(available.filter(option => !chosenTypes.has(option.type)), 3 - seed.length - guaranteedCombat.length)
    return shuffle([...seed, ...guaranteedCombat, ...filler])
  }, [metaProgress.alchemyUnlocked, lastChosenDestinationType])

  const applyRunSnapshot = useCallback((snapshot: PersistedRunV1) => {
    setPersistentHp(snapshot.persistentHp)
    setPersistentGold(snapshot.persistentGold)
    setRunExtraCards(snapshot.runExtraCards)
    setRunDeckCards(snapshot.runDeckCards ?? [...getCharacterStarterCards(snapshot.selectedCharacterId), ...snapshot.runExtraCards])
    setPickOptions(snapshot.pickOptions)
    setDestinationOptions(snapshot.destinationOptions)
    setCurrentRoomLabel(snapshot.currentRoomLabel)
    setSelectedCharacterId(snapshot.selectedCharacterId)
    setGameState(snapshot.gameState)
    setIsEnemyActing(snapshot.isEnemyActing)
    setCollectionReturnScreen(snapshot.collectionReturnScreen)
    setShopOffers(snapshot.shopOffers)
    setShopTrinketOffers(snapshot.shopTrinketOffers)
    setAlchemyTransformOffers(snapshot.alchemyTransformOffers ?? [])
    setAlchemyPotionOffer(snapshot.alchemyPotionOffer ?? null)
    setAlchemyPotionOffer2(snapshot.alchemyPotionOffer2 ?? null)
    setLastChosenDestinationType(snapshot.lastChosenDestinationType ?? null)
    setShopRefreshUsed(snapshot.shopRefreshUsed ?? false)
    setShopDestroyUsed(snapshot.shopDestroyUsed ?? false)
    setAlchemyRefreshUsed(snapshot.alchemyRefreshUsed ?? false)
    setShopRefreshCost(snapshot.shopRefreshCost ?? 25)
    setShopDestroyCost(snapshot.shopDestroyCost ?? 25)
    setAlchemyRefreshCost(snapshot.alchemyRefreshCost ?? 25)
    setAlchemyPotionCost(snapshot.alchemyPotionCost ?? 25)
    setAlchemyMixCost(snapshot.alchemyMixCost ?? 25)
    setShopVisitCount(snapshot.shopVisitCount ?? 0)
    setShopOfferMode(snapshot.shopOfferMode ?? 'cards')
    setRunTrinkets(snapshot.runTrinkets)
    setFloorsCleared(snapshot.floorsCleared ?? 0)
    setRewardGoldFound(snapshot.rewardGoldFound)
    setMysteryGoldFound(snapshot.mysteryGoldFound)
    setActiveMysteryCompanionEventId(snapshot.activeMysteryCompanionEventId ?? null)
    setActiveRunCompanionEventId(snapshot.activeRunCompanionEventId ?? null)
    setMysteryChestReward(snapshot.chestReward ?? null)
    setEncounteredEnemyIds(new Set(snapshot.encounteredEnemyIds))
    setEncounteredCardIds(new Set(snapshot.encounteredCardIds))
    setEncounteredTrinketIds(new Set(snapshot.encounteredTrinketIds))
    setSeenMysteryEventIds(new Set(snapshot.seenMysteryEventIds ?? []))
    setLastRunScreen(snapshot.lastRunScreen)
    setRunInProgress(true)
    setSavedRun(null)
    setScreen(snapshot.lastRunScreen)
  }, [])

  useEffect(() => {
    try {
      const progressRaw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY)
      if (progressRaw) {
        const parsed = JSON.parse(progressRaw) as PersistedProgressV1
        setEncounteredEnemyIds(new Set(parsed.encounteredEnemyIds ?? []))
        setEncounteredCardIds(new Set(parsed.encounteredCardIds ?? []))
        setEncounteredTrinketIds(new Set(parsed.encounteredTrinketIds ?? []))
        setMetaProgress(normalizeMetaProgression(parsed.meta))
        setSettings(normalizeSettings(parsed.settings))
      }

      const settingsRaw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (settingsRaw) {
        const parsedSettings = JSON.parse(settingsRaw) as GameSettings
        setSettings(normalizeSettings(parsedSettings))
      }

      const runRaw = window.localStorage.getItem(RUN_STORAGE_KEY)
      if (runRaw) {
        const parsed = JSON.parse(runRaw) as PersistedRunV1
        if (parsed.version === 1) {
          setSavedRun(parsed)
          setLastRunScreen(parsed.lastRunScreen)
        }
      }
    } catch {
      // If local save data is corrupted we skip hydration and continue with defaults.
    } finally {
      hasHydratedPersistenceRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedPersistenceRef.current) return
    const progress: PersistedProgressV1 = {
      encounteredEnemyIds: Array.from(encounteredEnemyIds),
      encounteredCardIds: Array.from(encounteredCardIds),
      encounteredTrinketIds: Array.from(encounteredTrinketIds),
      meta: metaProgress,
      settings,
    }
    window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(progress))
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [encounteredEnemyIds, encounteredCardIds, encounteredTrinketIds, metaProgress, settings])

  useEffect(() => {
    if (!hasHydratedPersistenceRef.current) return
    if (!runInProgress) return

    const snapshot: PersistedRunV1 = {
      version: 1,
      lastRunScreen,
      persistentHp,
      persistentGold,
      runExtraCards,
      runDeckCards,
      pickOptions,
      destinationOptions,
      currentRoomLabel,
      selectedCharacterId,
      gameState,
      isEnemyActing,
      collectionReturnScreen,
      shopOffers,
      shopTrinketOffers,
      alchemyTransformOffers,
      alchemyPotionOffer,
      alchemyPotionOffer2,
      lastChosenDestinationType,
      shopRefreshUsed,
      shopDestroyUsed,
      alchemyRefreshUsed,
      shopRefreshCost,
      shopDestroyCost,
      alchemyRefreshCost,
      alchemyPotionCost,
      alchemyMixCost,
      shopVisitCount,
      shopOfferMode,
      runTrinkets,
      floorsCleared,
      rewardGoldFound,
      mysteryGoldFound,
      activeMysteryCompanionEventId,
      activeRunCompanionEventId,
      chestReward: mysteryChestReward,
      encounteredEnemyIds: Array.from(encounteredEnemyIds),
      encounteredCardIds: Array.from(encounteredCardIds),
      encounteredTrinketIds: Array.from(encounteredTrinketIds),
      seenMysteryEventIds: Array.from(seenMysteryEventIds),
    }

    window.localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(snapshot))
  }, [
    runInProgress,
    lastRunScreen,
    persistentHp,
    persistentGold,
    runExtraCards,
    runDeckCards,
    pickOptions,
    destinationOptions,
    currentRoomLabel,
    selectedCharacterId,
    gameState,
    isEnemyActing,
    collectionReturnScreen,
    shopOffers,
    shopTrinketOffers,
    alchemyTransformOffers,
    alchemyPotionOffer,
    alchemyPotionOffer2,
    lastChosenDestinationType,
    shopRefreshUsed,
    shopDestroyUsed,
    alchemyRefreshUsed,
    shopRefreshCost,
    shopDestroyCost,
    alchemyRefreshCost,
    alchemyPotionCost,
    alchemyMixCost,
    shopVisitCount,
    shopOfferMode,
    runTrinkets,
    floorsCleared,
    rewardGoldFound,
    mysteryGoldFound,
    activeMysteryCompanionEventId,
    activeRunCompanionEventId,
    mysteryChestReward,
    encounteredEnemyIds,
    encounteredCardIds,
    encounteredTrinketIds,
    seenMysteryEventIds,
  ])

  useEffect(() => {
    if (RUN_SCREENS.includes(screen as RunScreen)) {
      setLastRunScreen(screen as RunScreen)
      setRunInProgress(true)
    }
  }, [screen])

  useEffect(() => {
    if (previewMode === 'destination') {
      setDestinationOptions(buildDestinationOptions())
      setCurrentRoomLabel('Combat')
      setScreen('destination')
      return
    }

  }, [previewMode, buildDestinationOptions])

  useEffect(() => {
    musicEnabledRef.current = musicEnabled
  }, [musicEnabled])

  useEffect(() => {
    const root = document.documentElement
    const preset = settings.display.resolutionPreset
    if (preset === 'auto') {
      root.style.setProperty('--alchemy-viewport-width', '1440px')
      root.style.setProperty('--alchemy-viewport-ratio', '16 / 9')
      return
    }

    const [width, height] = preset.split('x').map(value => Number(value))
    root.style.setProperty('--alchemy-viewport-width', `${width}px`)
    root.style.setProperty('--alchemy-viewport-ratio', `${width} / ${height}`)
  }, [settings.display.resolutionPreset])

  useEffect(() => {
    setAudioMix({
      master: settings.audio.master / 100,
      music: (musicEnabled ? settings.audio.music : 0) / 100,
      sfx: settings.audio.sfx / 100,
    })
  }, [settings.audio.master, settings.audio.music, settings.audio.sfx, musicEnabled])

  // pre-warm audio and keep retrying BGM start on user interactions.
  // This avoids a silent first load when the initial autoplay attempt is blocked.
  useEffect(() => {
    const listener = () => {
      ensureCtx()
      if (musicEnabledRef.current) {
        ensureRandomBGM()
      }
    }

    // Attempt immediately on mount.
    listener()

    window.addEventListener('pointerdown', listener)
    window.addEventListener('keydown', listener)
    window.addEventListener('click', listener)
    return () => {
      window.removeEventListener('pointerdown', listener)
      window.removeEventListener('keydown', listener)
      window.removeEventListener('click', listener)
    }
  }, [])

  useEffect(() => {
    if (musicEnabled) {
      ensureCtx()
      ensureRandomBGM()
    } else {
      stopBGM()
    }
  }, [musicEnabled])

  useEffect(() => {
    if (screen !== 'menu') return
    if (!musicEnabled) return
    ensureCtx()
    ensureRandomBGM()
  }, [screen, musicEnabled])

  useEffect(() => {
    return () => {
      stopBGM()
    }
  }, [])

  const isPlayerTurn = gameState.phase === 'player_turn'

  // ── Menu → First combat ──
  const resetRunState = useCallback(() => {
    setRunExtraCards([])
    setRunDeckCards([])
    setPersistentHp(runMaxHp)
    setPersistentGold(0)
    setDestinationOptions([])
    setCurrentRoomLabel('Start')
    setShopOffers([])
    setShopTrinketOffers([])
    setAlchemyTransformOffers([])
    setAlchemyPotionOffer(null)
    setAlchemyPotionOffer2(null)
    setShopRefreshUsed(false)
    setShopDestroyUsed(false)
    setAlchemyRefreshUsed(false)
    setShopRefreshCost(25)
    setShopDestroyCost(25)
    setAlchemyRefreshCost(25)
    setAlchemyPotionCost(25)
    setAlchemyMixCost(25)
    setShopVisitCount(0)
    setShopOfferMode('cards')
    setRunTrinkets([])
    setSeenMysteryEventIds(new Set())
    setFloorsCleared(0)
    setRewardGoldFound(0)
    setMysteryGoldFound(0)
    setLastChosenDestinationType(null)
    setActiveMysteryCompanionEventId(null)
    setActiveRunCompanionEventId(null)
    setMysteryChestReward(null)
    setPendingCompanionTurn(false)
    setCompanionAttackTick(0)
    setPlayerAttackTick(0)
  }, [runMaxHp])

  const openCollection = (from: Screen) => {
    setCollectionReturnScreen(from)
    setScreen('collection')
  }

  const handleOpenCharacterSelect = () => {
    resetRunState()
    setRunInProgress(false)
    setSavedRun(null)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    setScreen('character-select')
  }

  const handleStart = (characterId: string) => {
    resetRunState()
    setSavedRun(null)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    setSelectedCharacterId(characterId)
    const starterCards = getCharacterStarterCards(characterId).map(applyTalentCardBonuses)
    const starterCardIds = new Set(getCharacterStarterCards(characterId).map(card => card.id))
    const startingGold = talentBonuses.startingGold
    setRunDeckCards(starterCards)
    setPersistentHp(runMaxHp)
    setPersistentGold(startingGold)
    setEncounteredCardIds(prev => new Set([...prev, ...starterCardIds]))
    setCurrentRoomLabel('Combat')
    setGameState(applyCombatTalentBonuses(createGame(runMaxHp, [], 'basic', startingGold, characterId, undefined, [], starterCards, 0)))
    setLastRunScreen('game')
    setRunInProgress(true)
    setScreen('game')
  }

  const buildShopOffers = useCallback((): ShopCardOffer[] => {
    const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
    const dominantKeyword = getDeckDominantKeyword(runDeckCards)
    const dominantMatchPool = dominantKeyword
      ? ALL_CARDS.filter(card => cardMatchesKeyword(card, dominantKeyword))
      : []
    const guaranteedMatch = dominantMatchPool.length > 0
      ? weightedPickOne(dominantMatchPool, card => cardWeightForTrinkets(card, ownedTrinketIds))
      : null

    const remainingPool = guaranteedMatch
      ? ALL_CARDS.filter(card => card.id !== guaranteedMatch.id)
      : ALL_CARDS
    const remainingCards = weightedPickMany(remainingPool, guaranteedMatch ? 2 : 3, card => cardWeightForTrinkets(card, ownedTrinketIds))
    const cards = shuffle([...(guaranteedMatch ? [guaranteedMatch] : []), ...remainingCards]).map(applyTalentCardBonuses)

    return cards.map((card, index) => {
      const price = rollVisitPrice()
      return { id: `shop-${card.id}-${Date.now()}-${index}`, card, price }
    })
  }, [applyTalentCardBonuses, runDeckCards, runTrinkets])

  const buildShopTrinketOffers = useCallback((): ShopTrinketOffer[] => {
    const SHOP_TRINKET_OFFER_COUNT = 3
    const ownedIds = new Set(runTrinkets.map(trinket => trinket.id))
    const available = ALL_TRINKET_OFFERS.filter(offer => !ownedIds.has(offer.id))
    const dominantKeyword = getDeckDominantKeyword(runDeckCards)
    const dominantMatchPool = dominantKeyword
      ? available.filter(offer => trinketMatchesKeyword(offer, dominantKeyword))
      : []
    const guaranteedMatch = dominantMatchPool.length > 0
      ? weightedPickOne(dominantMatchPool, offer => trinketWeightForTrinkets(offer, ownedIds))
      : null
    const remainingPool = guaranteedMatch
      ? available.filter(offer => offer.id !== guaranteedMatch.id)
      : available
    const remaining = weightedPickMany(
      remainingPool,
      Math.min(SHOP_TRINKET_OFFER_COUNT - (guaranteedMatch ? 1 : 0), remainingPool.length),
      offer => trinketWeightForTrinkets(offer, ownedIds),
    )
    return shuffle([...(guaranteedMatch ? [guaranteedMatch] : []), ...remaining]).map(offer => ({
      ...offer,
      price: rollVisitPrice(),
    }))
  }, [runDeckCards, runTrinkets])

  // ── Combat actions ──
  const handlePlayCard = (uid: string) => {
    const card = gameState.hand.find(entry => entry.uid === uid)
    if (card) {
      setEncounteredCardIds(prev => new Set([...prev, card.id]))
      setMetaProgress(prev => {
        const nextProgress = { ...prev.keywordTalentProgress }
        const nextPoints = { ...prev.keywordTalentPointsEarned }
        const cardText = `${card.name} ${card.description}`

        for (const keyword of TALENT_KEYWORDS) {
          const matches = TALENT_MATCH_KEYWORDS_BY_TREE[keyword].some(matchKeyword => cardMatchesKeyword(card, matchKeyword) || textHasKeyword(cardText, matchKeyword))
          if (!matches) continue
          const updatedProgress = (nextProgress[keyword] ?? 0) + 1
          nextPoints[keyword] = (nextPoints[keyword] ?? 0) + Math.floor(updatedProgress / 10)
          nextProgress[keyword] = updatedProgress % 10
        }

        return {
          ...prev,
          keywordTalentProgress: nextProgress,
          keywordTalentPointsEarned: nextPoints,
        }
      })
    }
    setGameState(prev => playCard(prev, uid))
  }

  const startEnemySequence = useCallback(() => {
    if (gameState.extraTurns > 0) {
      setIsEnemyActing(true)
      setGameState(prev => startExtraTurnTransition(prev))

      setTimeout(() => {
        setGameState(prev => beginNextPlayerTurn(prev))
        setIsEnemyActing(false)
      }, BONUS_TURN_DRAW_DELAY_MS)
      return
    }

    setIsEnemyActing(true)
    setGameState(prev => startEnemyTurn(prev))

    setTimeout(() => {
      setGameState(prev => resolveEnemyStartOfTurn(prev))
    }, ENEMY_START_DELAY_MS)

    setTimeout(() => {
      setGameState(prev => resolveEnemyAction(prev))
    }, ENEMY_START_DELAY_MS + ENEMY_ACTION_DELAY_MS)

    setTimeout(() => {
      setGameState(prev => beginNextPlayerTurn(prev))
      setIsEnemyActing(false)
    }, ENEMY_START_DELAY_MS + ENEMY_ACTION_DELAY_MS + ENEMY_END_DELAY_MS)
  }, [BONUS_TURN_DRAW_DELAY_MS, ENEMY_ACTION_DELAY_MS, ENEMY_END_DELAY_MS, ENEMY_START_DELAY_MS, gameState.extraTurns])

  const handleEndTurn = useCallback(() => {
    if (!activeCompanion) {
      startEnemySequence()
      return
    }

    setCompanionAttackTick(prev => prev + 1)
    setGameState(prev => applyCompanionEffect(prev, activeCompanion.attack, activeCompanion.companionName))
    setPendingCompanionTurn(true)
  }, [activeCompanion, startEnemySequence])

  useEffect(() => {
    if (!pendingCompanionTurn) return
    if (screen !== 'game') {
      setPendingCompanionTurn(false)
      return
    }
    if (gameState.phase !== 'player_turn') {
      setPendingCompanionTurn(false)
      return
    }

    const id = window.setTimeout(() => {
      startEnemySequence()
      setPendingCompanionTurn(false)
    }, 640)

    return () => window.clearTimeout(id)
  }, [pendingCompanionTurn, screen, gameState.phase, startEnemySequence])

  // Auto-end turn when no card in hand is affordable
  useEffect(() => {
    if (screen !== 'game') return
    if (gameState.phase !== 'player_turn') return
    if (isEnemyActing) return
    if (gameState.hand.some(c => c.cost <= gameState.mana)) return
    const t = setTimeout(handleEndTurn, 700)
    return () => clearTimeout(t)
  }, [screen, gameState.phase, gameState.hand, gameState.mana, isEnemyActing, handleEndTurn])

  useEffect(() => {
    if (screen === 'game' && gameState.wishOptions.length > 0) {
      setScreen('wish')
      return
    }

    if (screen === 'wish' && gameState.wishOptions.length === 0) {
      setScreen('game')
    }
  }, [screen, gameState.wishOptions.length])

  useEffect(() => {
    const previousHp = previousEnemyHpRef.current
    previousEnemyHpRef.current = gameState.enemy.hp
    if (screen !== 'game') return
    if (gameState.phase !== 'player_turn') return
    if (gameState.enemy.hp < previousHp) {
      setPlayerAttackTick(prev => prev + 1)
    }
  }, [screen, gameState.enemy.hp, gameState.phase])

  // Play victory/defeat sounds
  useEffect(() => {
    if (gameState.phase === 'win') {
      playVictory()
    } else if (gameState.phase === 'lose') {
      playDefeat()
    }
  }, [gameState.phase])

  // ── Win → Reward pick ──
  const handleCombatWin = () => {
    const isEliteVictory = currentRoomLabel === 'Elite'
    const foundGold = isEliteVictory
      ? Math.floor(Math.random() * 11) + 20
      : Math.floor(Math.random() * 11) + 10
    const hasCampfireTrinket = runTrinkets.some(trinket => trinket.id === 'campfire')
    const healedHp = hasCampfireTrinket ? Math.min(runMaxHp, gameState.player.hp + 10) : gameState.player.hp

    setRewardGoldFound(foundGold)
    setPersistentHp(healedHp)
    setPersistentGold(gameState.gold + foundGold)
    const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
    setPickOptions(weightedPickMany(ALL_CARDS, 3, card => cardWeightForTrinkets(card, ownedTrinketIds)).map(applyTalentCardBonuses))
    setScreen('reward')
  }

  // ── Reward pick → Destination choice ──
  const handleRewardPick = (card: CardDef) => {
    setRunExtraCards(prev => [...prev, card])
    setRunDeckCards(prev => [...prev, card])
    setEncounteredCardIds(prev => new Set([...prev, card.id]))
    setRewardGoldFound(0)
    setDestinationOptions(buildDestinationOptions())
    setScreen('destination')
  }

  const handleRewardSkip = () => {
    setRewardGoldFound(0)
    returnToDestination()
  }

  // ── Destination choice → Combat ──
  const handleDestinationChoose = (type: DestinationType) => {
    const selected = DESTINATION_POOL.find(room => room.type === type)
    const label = selected?.title ?? 'Combat'
    const nextFloorsCleared = floorsCleared + 1

    setFloorsCleared(nextFloorsCleared)
    setLastChosenDestinationType(type)

    if (type === 'shop') {
      const nextVisitCount = shopVisitCount + 1
      const nextMode: ShopOfferMode = nextVisitCount % 2 === 1 ? 'cards' : 'trinkets'
      setCurrentRoomLabel(label)
      setShopVisitCount(nextVisitCount)
      setShopOfferMode(nextMode)
      setShopOffers(nextMode === 'cards' ? buildShopOffers() : [])
      setShopTrinketOffers(nextMode === 'trinkets' ? buildShopTrinketOffers() : [])
      setShopRefreshUsed(false)
      setShopDestroyUsed(false)
      setShopRefreshCost(rollVisitPrice())
      setShopDestroyCost(rollVisitPrice())
      setScreen('shop')
      return
    }

    if (type === 'rest') {
      setCurrentRoomLabel(label)
      setScreen('campfire')
      return
    }

    if (type === 'alchemy') {
      const potionCards = ALL_CARDS.filter(card => isPotionCard(card)).map(applyTalentCardBonuses)
      const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
      const randomPotion = weightedPickOne(potionCards, card => cardWeightForTrinkets(card, ownedTrinketIds))
      setCurrentRoomLabel(label)
      const shuffled = [...ALCHEMY_TRANSFORM_LIBRARY].sort(() => Math.random() - 0.5)
      const picked = shuffled.slice(0, 3)
      const nextPotionCost = rollVisitPrice()
      setAlchemyTransformOffers(picked.map((entry, i) => ({
        ...entry,
        cost: rollVisitPrice(),
        id: `alchemy-${entry.kind}-${Date.now()}-${i}`,
      })))
      setAlchemyPotionOffer(randomPotion ? { id: `alchemy-potion-${randomPotion.id}-${Date.now()}`, card: randomPotion, price: nextPotionCost } : null)
      const randomPotion2 = weightedPickOne(potionCards.filter(c => c.id !== randomPotion?.id), card => cardWeightForTrinkets(card, ownedTrinketIds))
      setAlchemyPotionOffer2(randomPotion2 ? { id: `alchemy-potion2-${randomPotion2.id}-${Date.now()}`, card: randomPotion2, price: nextPotionCost } : null)
      setAlchemyRefreshUsed(false)
      setAlchemyRefreshCost(rollVisitPrice())
      setAlchemyPotionCost(nextPotionCost)
      setAlchemyMixCost(rollVisitPrice())
      setScreen('alchemy')
      return
    }

    if (type === 'mystery') {
      const availableEvents = MYSTERY_EVENT_POOL.filter(eventId => {
        if (seenMysteryEventIds.has(eventId)) return false
        if (COMPANION_VARIANTS_BY_EVENT_ID.has(eventId) && hasCompanion) return false
        return true
      })
      const pool = availableEvents.length > 0
        ? availableEvents
        : MYSTERY_EVENT_POOL.filter(eventId => !COMPANION_VARIANTS_BY_EVENT_ID.has(eventId) || !hasCompanion)
      const mysteryEvent = pool[Math.floor(Math.random() * pool.length)]
      setSeenMysteryEventIds(prev => new Set([...prev, mysteryEvent]))

      if (mysteryEvent === 'cache_of_coins') {
        setActiveMysteryCompanionEventId(null)
        const found = Math.floor(Math.random() * 11) + 20
        setMysteryGoldFound(found)
        setPersistentGold(prev => prev + found)
        setCurrentRoomLabel(CACHE_OF_COINS_MYSTERY_TITLE)
        playGoldGain()
        setScreen('mystery-gold-reward')
        return
      }

      if (mysteryEvent === 'treasure_chest') {
        setActiveMysteryCompanionEventId(null)
        setMysteryChestReward(null)
        setCurrentRoomLabel(TREASURE_CHEST_MYSTERY_TITLE)
        setScreen('mystery-chest')
        return
      }

      if (mysteryEvent === 'corrupted_forge') {
        setActiveMysteryCompanionEventId(null)
        setCurrentRoomLabel(CORRUPTED_FORGE_MYSTERY_TITLE)
        setScreen('mystery-corrupted-forge')
        return
      }

      if (mysteryEvent === 'mirage_market') {
        setActiveMysteryCompanionEventId(null)
        const nextMode: ShopOfferMode = Math.random() < 0.5 ? 'cards' : 'trinkets'
        setCurrentRoomLabel(MIRAGE_MARKET_MYSTERY_TITLE)
        setShopOfferMode(nextMode)
        setShopOffers(nextMode === 'cards' ? applyMirageDiscountToCardOffers(buildShopOffers()) : [])
        setShopTrinketOffers(nextMode === 'trinkets' ? applyMirageDiscountToTrinketOffers(buildShopTrinketOffers()) : [])
        setShopRefreshUsed(true)
        setShopDestroyUsed(true)
        setScreen('mystery-mirage-market')
        return
      }

      const mysteryCompanion = COMPANION_VARIANTS_BY_EVENT_ID.get(mysteryEvent)
      setActiveMysteryCompanionEventId(mysteryCompanion?.mysteryId ?? null)
      setCurrentRoomLabel(mysteryCompanion?.mysteryTitle ?? 'Mystery')
      setScreen('mystery')
      return
    }

    let nextHp = persistentHp

    setCurrentRoomLabel(label)
    setPersistentHp(nextHp)
    setGameState(applyCombatTalentBonuses(createGame(nextHp, runExtraCards, type === 'elite' ? 'elite' : 'basic', persistentGold, selectedCharacterId, undefined, runTrinkets.map(trinket => trinket.id), runDeckCards, nextFloorsCleared)))
    setScreen('game')
  }

  const handleBuyShopCard = (offerId: string) => {
    const offer = shopOffers.find(entry => entry.id === offerId)
    if (!offer) return
    if (persistentGold < offer.price) return
    setPersistentGold(prev => prev - offer.price)
    setRunExtraCards(prev => [...prev, applyTalentCardBonuses(offer.card)])
    setRunDeckCards(prev => [...prev, applyTalentCardBonuses(offer.card)])
    setEncounteredCardIds(prev => new Set([...prev, offer.card.id]))
    setShopOffers(prev => prev.map(entry => entry.id === offerId ? { ...entry, sold: true } : entry))
  }

  const handleRefreshShop = () => {
    if (shopRefreshUsed) return
    if (persistentGold < shopRefreshCost) return
    setPersistentGold(prev => prev - shopRefreshCost)
    if (shopOfferMode === 'cards') {
      setShopOffers(buildShopOffers())
      setShopTrinketOffers([])
    } else {
      setShopOffers([])
      setShopTrinketOffers(buildShopTrinketOffers())
    }
    setShopRefreshUsed(true)
  }

  const handleRefreshAlchemy = () => {
    if (alchemyRefreshUsed) return
    if (persistentGold < alchemyRefreshCost) return
    const potionCards = ALL_CARDS.filter(card => isPotionCard(card)).map(applyTalentCardBonuses)
    const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
    const randomPotion = weightedPickOne(potionCards, card => cardWeightForTrinkets(card, ownedTrinketIds))
    const nextPotionCost = rollVisitPrice()

    setPersistentGold(prev => prev - alchemyRefreshCost)
    const shuffled = [...ALCHEMY_TRANSFORM_LIBRARY].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, 3)
    setAlchemyTransformOffers(picked.map((entry, i) => ({
      ...entry,
      cost: rollVisitPrice(),
      id: `alchemy-refresh-${entry.kind}-${Date.now()}-${i}`,
    })))
    setAlchemyPotionOffer(randomPotion ? { id: `alchemy-refresh-potion-${randomPotion.id}-${Date.now()}`, card: randomPotion, price: nextPotionCost } : null)
    const randomPotion2r = weightedPickOne(potionCards.filter(c => c.id !== randomPotion?.id), card => cardWeightForTrinkets(card, ownedTrinketIds))
    setAlchemyPotionOffer2(randomPotion2r ? { id: `alchemy-refresh-potion2-${randomPotion2r.id}-${Date.now()}`, card: randomPotion2r, price: nextPotionCost } : null)
    setAlchemyRefreshUsed(true)
    setAlchemyPotionCost(nextPotionCost)
    setAlchemyMixCost(rollVisitPrice())
  }

  const handleDestroyShopCard = (deckIndex: number) => {
    if (shopDestroyUsed) return
    if (persistentGold < shopDestroyCost) return
    if (deckIndex < 0 || deckIndex >= runDeckCards.length) return
    if (runDeckCards.length <= 1) return

    const removedCard = runDeckCards[deckIndex]
    setPersistentGold(prev => prev - shopDestroyCost)
    setRunDeckCards(prev => prev.filter((_, i) => i !== deckIndex))
    setShopDestroyUsed(true)
    setRunExtraCards(prev => {
      const idx = prev.findIndex(card => card.id === removedCard.id)
      if (idx === -1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleBuyShopTrinket = (offerId: string) => {
    const offer = shopTrinketOffers.find(entry => entry.id === offerId)
    if (!offer) return
    if (persistentGold < offer.price) return
    if (runTrinkets.some(trinket => trinket.id === offer.id)) return

    setPersistentGold(prev => prev - offer.price)
    setRunTrinkets(prev => [...prev, { id: offer.id, name: offer.name, description: offer.description }])
    setEncounteredTrinketIds(prev => new Set([...prev, offer.id]))
    setShopTrinketOffers(prev => prev.filter(entry => entry.id !== offerId))
  }

  const returnToDestination = () => {
    setActiveMysteryCompanionEventId(null)
    setMysteryChestReward(null)
    setDestinationOptions(buildDestinationOptions())
    setScreen('destination')
  }

  const handleCampfireRest = (healAmount: number) => {
    const hasCampKit = runTrinkets.some(trinket => trinket.id === 'camp_kit')
    const actualHeal = hasCampKit ? Math.round(healAmount * 1.1) : healAmount
    setPersistentHp(prev => Math.min(runMaxHp, prev + actualHeal))
    returnToDestination()
  }

  const handleMysteryBefriend = () => {
    const companion = COMPANION_VARIANTS_BY_EVENT_ID.get(activeMysteryCompanionEventId ?? '')
    if (!companion) return
    setActiveRunCompanionEventId(companion.mysteryId)
    setRunTrinkets(prev => (
      prev.some(trinket => trinket.id === companion.collarTrinket.id)
        ? prev
        : [...prev, { id: companion.collarTrinket.id, name: companion.collarTrinket.name, description: companion.collarTrinket.description }]
    ))
    setEncounteredTrinketIds(prev => new Set([...prev, companion.collarTrinket.id]))
    setScreen('mystery-reward')
  }

  const handleMysteryFight = () => {
    const companion = COMPANION_VARIANTS_BY_EVENT_ID.get(activeMysteryCompanionEventId ?? '')
    const enemyId = companion?.companionEnemyId ?? 'lizard_f'
    setCurrentRoomLabel(companion?.companionName ?? 'Companion Trial')
    setGameState(applyCombatTalentBonuses(createGame(persistentHp, runExtraCards, 'basic', persistentGold, selectedCharacterId, enemyId, runTrinkets.map(trinket => trinket.id), runDeckCards, floorsCleared)))
    setScreen('game')
  }

  const handleOpenTreasureChest = () => {
    const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
    const cardReward = weightedPickOne(ALL_CARDS, card => cardWeightForTrinkets(card, ownedTrinketIds))
    const trinketCandidates = ALL_TRINKET_OFFERS.filter(offer => !runTrinkets.some(trinket => trinket.id === offer.id))
    const trinketReward = weightedPickOne(trinketCandidates, offer => trinketWeightForTrinkets(offer, ownedTrinketIds))
    if (trinketReward && Math.random() < 0.5) {
      setMysteryChestReward({
        type: 'trinket',
        id: trinketReward.id,
        name: trinketReward.name,
        description: trinketReward.description,
        iconSrc: trinketReward.iconSrc,
      })
      return
    }
    if (cardReward) {
      setMysteryChestReward({ type: 'card', card: cardReward })
    }
  }

  const handleTakeTreasureReward = () => {
    if (!mysteryChestReward) return
    if (mysteryChestReward.type === 'card') {
      setRunExtraCards(prev => [...prev, mysteryChestReward.card])
      setRunDeckCards(prev => [...prev, mysteryChestReward.card])
      setEncounteredCardIds(prev => new Set([...prev, mysteryChestReward.card.id]))
    } else {
      if (!runTrinkets.some(trinket => trinket.id === mysteryChestReward.id)) {
        setRunTrinkets(prev => [...prev, { id: mysteryChestReward.id, name: mysteryChestReward.name, description: mysteryChestReward.description }])
      }
      setEncounteredTrinketIds(prev => new Set([...prev, mysteryChestReward.id]))
    }
    returnToDestination()
  }

  const handleWishPick = (card: CardDef) => {
    setEncounteredCardIds(prev => new Set([...prev, card.id]))
    setGameState(prev => {
      const withGrantedCard = grantCardsToHand(prev, [card], 'Wish')
      return {
        ...withGrantedCard,
        wishOptions: [],
        log: [...withGrantedCard.log, `Wish grants ${card.name}.`].slice(-10),
      }
    })
    setScreen('game')
  }

  const handleCorruptForgeCard = (deckIndex: number) => {
    if (deckIndex < 0 || deckIndex >= runDeckCards.length) return
    const before = runDeckCards[deckIndex]
    const corrupted = applyCorruptedForgeMutation(before)
    setRunDeckCards(prev => prev.map((card, index) => (index === deckIndex ? corrupted : card)))
    setRunExtraCards(prev => prev.map((card, index) => (index === deckIndex ? corrupted : card)))
    setEncounteredCardIds(prev => new Set([...prev, corrupted.id]))
    returnToDestination()
  }

  const handleResumeRun = () => {
    if (savedRun) {
      applyRunSnapshot(savedRun)
      return
    }
    setScreen(lastRunScreen)
  }

  const handleReturnToMainMenu = () => {
    setScreen('menu')
  }
  const handleClearSavedProgress = useCallback(() => {
    window.localStorage.removeItem(PROGRESSION_STORAGE_KEY)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY)

    setEncounteredEnemyIds(new Set())
    setEncounteredCardIds(new Set())
    setEncounteredTrinketIds(new Set())
    setMetaProgress(DEFAULT_META_PROGRESSION)
    setSettings(DEFAULT_SETTINGS)
    resetRunState()
    setRunInProgress(false)
    setSavedRun(null)
    setScreen('menu')
  }, [resetRunState])

  // ── Lose / abandon → Menu ──
  const handleRestart = () => {
    if (runInProgress) {
      setMetaProgress(prev => {
        const nextRuns = prev.runsCompleted + 1
        const nextRoomsPlayed = prev.roomsPlayedTotal + floorsCleared
        return {
          runsCompleted: nextRuns,
          insight: prev.insight,
          startingGoldBonus: 0,
          alchemyUnlocked: prev.alchemyUnlocked || nextRuns >= 1,
          roomsPlayedTotal: nextRoomsPlayed,
          keywordTalentPointsEarned: prev.keywordTalentPointsEarned,
          keywordTalentProgress: prev.keywordTalentProgress,
          talentUnlockedNodeIdsByKeyword: prev.talentUnlockedNodeIdsByKeyword,
        }
      })
    }

    resetRunState()
    setRunInProgress(false)
    setSavedRun(null)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    setScreen('menu')
  }
  const handleSalvageTreasureChest = () => {
    setPersistentGold(prev => prev + 25)
    returnToDestination()
  }

  const handleDevSkipCombat = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      enemy: { ...prev.enemy, hp: 0 },
      phase: 'win',
      log: [...prev.log, 'DEV: Encounter skipped.'].slice(-10),
    }))
  }, [])

  const handleDevUnlockAll = useCallback(() => {
    setEncounteredCardIds(new Set(ALL_CARDS.map(card => card.id)))
    setEncounteredEnemyIds(new Set(BESTIARY_ENEMIES.map(enemy => enemy.id)))
    setEncounteredTrinketIds(new Set(ALL_TRINKET_OFFERS.map(trinket => trinket.id)))
    setMetaProgress(prev => ({
      ...prev,
      keywordTalentPointsEarned: {
        Burn: 99,
        Poison: 99,
        Mana: 99,
        Gold: 99,
        Physical: 99,
        Block: 99,
        Heal: 99,
        Holy: 99,
      },
    }))
  }, [])

  const handleEndRun = useCallback(() => {
    if (!runInProgress && !savedRun) return
    const confirmed = window.confirm('End current run and return to main menu? This cannot be undone.')
    if (!confirmed) return
    resetRunState()
    setRunInProgress(false)
    setSavedRun(null)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    setScreen('menu')
  }, [resetRunState, runInProgress, savedRun])

  const renderGlobalMenu = (opts?: { direction?: 'up' | 'down'; align?: 'left' | 'right'; onEndTurnEarly?: () => void }) => (
    <GlobalScreenMenu
      onGoMainMenu={handleReturnToMainMenu}
      onGoCharacterSelect={handleOpenCharacterSelect}
      onOpenCollection={() => openCollection(screen)}
      onOpenOptions={() => {
        setOptionsReturnScreen(screen)
        setScreen('options')
      }}
      onEndRun={runInProgress || savedRun ? handleEndRun : undefined}
      onEndTurnEarly={opts?.onEndTurnEarly}
      direction={opts?.direction}
      align={opts?.align}
    />
  )

  useEffect(() => {
    if (screen !== 'game') return
    setEncounteredEnemyIds(prev => new Set([...prev, gameState.enemy.id]))
  }, [screen, gameState.enemy.id])

  return (
    <>
      <AnimatePresence mode="wait">

      {screen === 'menu' && (
        <MainMenu
          key="menu"
          onStart={handleOpenCharacterSelect}
          onResume={handleResumeRun}
          canResume={canResume}
          onCollection={() => openCollection('menu')}
          onTalents={() => setScreen('talents')}
          onOptions={() => {
            setOptionsReturnScreen('menu')
            setScreen('options')
          }}
        />
      )}

      {screen === 'talents' && (
        <TalentsScreen
          key="talents"
          activeKeyword={activeTalentKeyword}
          unlockedTalentNodeIds={unlockedTalentNodeIds}
          availableTalentPoints={availableTalentPoints}
          pointsProgress={metaProgress.keywordTalentProgress[activeTalentKeyword] ?? 0}
          totalPointsEarned={metaProgress.keywordTalentPointsEarned[activeTalentKeyword] ?? 0}
          onChangeKeyword={setActiveTalentKeyword}
          onUnlockTalent={(nodeId) => {
            if (availableTalentPoints <= 0) return
            const nodes = getTalentNodesForKeyword(activeTalentKeyword)
            const links = getTalentLinksForNodes(nodes)
            if (!canUnlockTalent(nodeId, unlockedTalentNodeIds, nodes, links)) return
            setMetaProgress(prev => ({
              ...prev,
              talentUnlockedNodeIdsByKeyword: {
                ...prev.talentUnlockedNodeIdsByKeyword,
                [activeTalentKeyword]: [...(prev.talentUnlockedNodeIdsByKeyword[activeTalentKeyword] ?? []), nodeId],
              },
            }))
          }}
          onRespec={() => {
            setMetaProgress(prev => ({
              ...prev,
              talentUnlockedNodeIdsByKeyword: { ...DEFAULT_UNLOCKED_BY_KEYWORD },
            }))
          }}
          onBack={() => setScreen('menu')}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'options' && (
        <OptionsScreen
          key="options"
          settings={settings}
          activeTab={optionsTab}
          onChangeTab={setOptionsTab}
          onSetResolutionPreset={(preset) => setSettings(prev => ({ ...prev, display: { ...prev.display, resolutionPreset: preset } }))}
          onSetAudio={(channel, value) => setSettings(prev => ({ ...prev, audio: { ...prev.audio, [channel]: clampPercent(value) } }))}
          onResetAudioDefaults={() => setSettings(prev => ({ ...prev, audio: { ...DEFAULT_SETTINGS.audio } }))}
          onClearSavedProgress={handleClearSavedProgress}
          onBack={() => setScreen(optionsReturnScreen === 'options' ? 'menu' : optionsReturnScreen)}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'character-select' && (
        <CharacterSelectScreen
          key="character-select"
          onSelect={handleStart}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          key="collection"
          cards={ALL_CARDS}
          enemies={BESTIARY_ENEMIES}
          trinkets={ALL_TRINKET_OFFERS.map(offer => ({ id: offer.id, name: offer.name, description: offer.description, iconSrc: offer.iconSrc }))}
          encounteredCardIds={encounteredCardIds}
          encounteredEnemyIds={encounteredEnemyIds}
          encounteredTrinketIds={encounteredTrinketIds}
          onBack={() => setScreen(collectionReturnScreen === 'collection' ? 'menu' : collectionReturnScreen)}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'reward' && (
        <CardPickScreen
          key="reward"
          title="Choose a Reward"
          subtitle="Victory"
          options={pickOptions}
          onPick={handleRewardPick}
          onSkip={handleRewardSkip}
          foundGold={rewardGoldFound}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'destination' && (
        <ChooseDestinationScreen
          key="destination"
          options={destinationOptions}
          onChoose={handleDestinationChoose}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'wish' && (
        <CardPickScreen
          key="wish"
          title="Wish"
          subtitle="Choose 1 of 3"
          options={gameState.wishOptions}
          onPick={handleWishPick}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}


      {screen === 'shop' && (
        <ShopScreen
          key="shop"
          characterId={selectedCharacterId}
          gold={persistentGold}
          cardOffers={shopOffers}
          trinketOffers={shopTrinketOffers}
          offerMode={shopOfferMode}
          deckCards={runDeckCards}
          refreshCost={shopRefreshCost}
          destroyCardCost={shopDestroyCost}
          refreshUsed={shopRefreshUsed}
          destroyUsed={shopDestroyUsed}
          onRefreshShop={handleRefreshShop}
          onBuyCard={handleBuyShopCard}
          onBuyTrinket={handleBuyShopTrinket}
          onDestroyCard={handleDestroyShopCard}
          onLeave={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'alchemy' && (
        <AlchemyScreen
          key="alchemy"
          characterId={selectedCharacterId}
          gold={persistentGold}
          deckCards={runDeckCards}
          transformOffers={alchemyTransformOffers}
          potionOffer={alchemyPotionOffer}
          potionOffer2={alchemyPotionOffer2}
          potionCost={alchemyPotionCost}
          mixCost={alchemyMixCost}
          refreshUsed={alchemyRefreshUsed}
          refreshCost={alchemyRefreshCost}
          onRefreshOffers={handleRefreshAlchemy}
          onBuyPotion={() => {
            if (!alchemyPotionOffer) return
            if (persistentGold < alchemyPotionCost) return
            setPersistentGold(prev => prev - alchemyPotionCost)
            setRunExtraCards(prev => [...prev, alchemyPotionOffer.card])
            setRunDeckCards(prev => [...prev, alchemyPotionOffer.card])
            setEncounteredCardIds(prev => new Set([...prev, alchemyPotionOffer.card.id]))
            const potionCards = ALL_CARDS.filter(card => isPotionCard(card)).map(applyTalentCardBonuses)
            const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
            const nextPotion = weightedPickOne(potionCards.filter(c => c.id !== alchemyPotionOffer2?.card.id), card => cardWeightForTrinkets(card, ownedTrinketIds))
            setAlchemyPotionOffer(nextPotion ? { id: `alchemy-potion-${nextPotion.id}-${Date.now()}`, card: nextPotion, price: alchemyPotionCost } : null)
          }}
          onBuyPotion2={() => {
            if (!alchemyPotionOffer2) return
            if (persistentGold < alchemyPotionCost) return
            setPersistentGold(prev => prev - alchemyPotionCost)
            setRunExtraCards(prev => [...prev, alchemyPotionOffer2.card])
            setRunDeckCards(prev => [...prev, alchemyPotionOffer2.card])
            setEncounteredCardIds(prev => new Set([...prev, alchemyPotionOffer2.card.id]))
            const potionCards = ALL_CARDS.filter(card => isPotionCard(card)).map(applyTalentCardBonuses)
            const ownedTrinketIds = new Set(runTrinkets.map(trinket => trinket.id))
            const nextPotion2 = weightedPickOne(potionCards.filter(c => c.id !== alchemyPotionOffer?.card.id), card => cardWeightForTrinkets(card, ownedTrinketIds))
            setAlchemyPotionOffer2(nextPotion2 ? { id: `alchemy-potion2-${nextPotion2.id}-${Date.now()}`, card: nextPotion2, price: alchemyPotionCost } : null)
          }}
          onApplyTransform={(offerId, deckIndex) => {
            const offer = alchemyTransformOffers.find(o => o.id === offerId)
            if (!offer) return
            if (persistentGold < offer.cost) return
            if (deckIndex < 0 || deckIndex >= runDeckCards.length) return
            const card = runDeckCards[deckIndex]
            const transformed = applyTransformToCard(card, offer.kind)
            setPersistentGold(prev => prev - offer.cost)
            setRunDeckCards(prev => prev.map((c, i) => i === deckIndex ? transformed : c))
            setRunExtraCards(prev => prev.map((c, i) => i === deckIndex ? transformed : c))
            setAlchemyTransformOffers(prev => prev.map(o => o.id === offerId ? { ...o, purchased: true } : o))
            setEncounteredCardIds(prev => new Set([...prev, transformed.id]))
          }}
          onMixPotions={(firstDeckIndex, secondDeckIndex) => {
            if (persistentGold < alchemyMixCost) return
            if (firstDeckIndex === secondDeckIndex) return
            if (firstDeckIndex < 0 || firstDeckIndex >= runDeckCards.length) return
            if (secondDeckIndex < 0 || secondDeckIndex >= runDeckCards.length) return
            const first = runDeckCards[firstDeckIndex]
            const second = runDeckCards[secondDeckIndex]
            if (!isPotionCard(first) || !isPotionCard(second)) return
            const mixed = mixPotionCards(first, second)
            // Remove the two potions and add the mixed potion
            setPersistentGold(prev => prev - alchemyMixCost)
            setRunDeckCards(prev => {
              const arr = prev.filter((_, i) => i !== firstDeckIndex && i !== secondDeckIndex)
              arr.push(mixed)
              return arr
            })
            setRunExtraCards(prev => {
              const arr = prev.filter((_, i) => i !== firstDeckIndex && i !== secondDeckIndex)
              arr.push(mixed)
              return arr
            })
            setEncounteredCardIds(prev => new Set([...prev, mixed.id]))
          }}
          onLeave={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery' && (
        <MysteryLizardScoutScreen
          key="mystery"
          characterId={selectedCharacterId}
          mysteryTitle={activeMysteryCompanion.mysteryTitle}
          companionName={activeMysteryCompanion.companionName}
          companionEnemyId={activeMysteryCompanion.companionEnemyId}
          onBefriend={handleMysteryBefriend}
          onFight={handleMysteryFight}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-chest' && (
        <MysteryTreasureChestScreen
          key="mystery-chest"
          reward={mysteryChestReward}
          onOpen={handleOpenTreasureChest}
          onTake={handleTakeTreasureReward}
          onSkip={handleSalvageTreasureChest}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-reward' && (
        <MysteryTrinketRewardScreen
          key="mystery-reward"
          subtitle={activeMysteryCompanion.mysteryTitle}
          trinketName={activeMysteryCompanion.collarTrinket.name}
          trinketIconSrc={activeMysteryCompanion.collarTrinket.iconSrc ?? 'assets/trinkets/collar.png'}
          trinketDescription={activeMysteryCompanion.collarTrinket.description}
          onContinue={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-gold-reward' && (
        <MysteryGoldRewardScreen
          key="mystery-gold-reward"
          foundGold={mysteryGoldFound}
          onContinue={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-corrupted-forge' && (
        <MysteryCorruptedForgeScreen
          key="mystery-corrupted-forge"
          deckCards={runDeckCards}
          onCorrupt={handleCorruptForgeCard}
          onSkip={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-mirage-market' && (
        <ShopScreen
          key="mystery-mirage-market"
          characterId={selectedCharacterId}
          gold={persistentGold}
          cardOffers={shopOffers}
          trinketOffers={shopTrinketOffers}
          offerMode={shopOfferMode}
          deckCards={runDeckCards}
          refreshCost={shopRefreshCost}
          destroyCardCost={shopDestroyCost}
          refreshUsed
          destroyUsed
          onRefreshShop={() => undefined}
          onBuyCard={handleBuyShopCard}
          onBuyTrinket={handleBuyShopTrinket}
          onDestroyCard={() => undefined}
          onLeave={returnToDestination}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'campfire' && (
        <CampfireScreen
          key="campfire"
          characterId={selectedCharacterId}
          currentHp={persistentHp}
          maxHp={runMaxHp}
          onRest={handleCampfireRest}
          showCompanion={hasCompanion}
          companionName={activeCompanion?.companionName}
          companionEnemyId={activeCompanion?.companionEnemyId}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'game' && (
        <motion.div
          key="game"
          className="min-h-screen flex items-center justify-center p-6 bg-zinc-950"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div
            className="relative flex flex-col bg-zinc-950 overflow-hidden"
            style={{
              width: 'min(95vw, calc(94vh * var(--alchemy-viewport-ratio, 16 / 9)), var(--alchemy-viewport-width, 1440px))',
              aspectRatio: 'var(--alchemy-viewport-ratio, 16 / 9)',
            }}
          >
            <div className="absolute right-24 bottom-6 z-[90]">
              <div className="flex items-center gap-2">
                {isDevBuild && gameState.phase !== 'win' && gameState.phase !== 'lose' && (
                  <DevQaMenu onSkipCombat={handleDevSkipCombat} onUnlockAll={handleDevUnlockAll} />
                )}
                {renderGlobalMenu({
                  direction: 'up',
                  align: 'right',
                  onEndTurnEarly: gameState.phase === 'player_turn' && !isEnemyActing ? handleEndTurn : undefined,
                })}
              </div>
            </div>

            <main className="flex-1 flex items-center justify-center px-8 pt-8 min-h-0">
              <div className="flex flex-col items-center gap-4 translate-y-6">
                <div className="flex items-start gap-52">
                  <PlayerPanel
                    player={gameState.player}
                    gold={gameState.gold}
                    characterId={gameState.characterId}
                    characterName={getRunCharacter(gameState.characterId).name}
                    isActive={isPlayerTurn && !isEnemyActing}
                    lastCardPlayedId={gameState.lastCardPlayedId}
                    activeUpgrades={gameState.activeUpgrades}
                    trinkets={[]}
                    showCompanion={hasCompanion}
                    companionName={activeCompanion?.companionName}
                    companionEnemyId={activeCompanion?.companionEnemyId}
                    companionAttackTick={companionAttackTick}
                    playerAttackTick={playerAttackTick}
                  />
                  <EnemyPanel
                    enemy={gameState.enemy}
                    isActing={isEnemyActing}
                    isActive={isEnemyActing}
                    lastCardPlayedId={gameState.lastCardPlayedId}
                    isEliteEncounter={currentRoomLabel === 'Elite'}
                  />
                </div>
                <TurnIndicator isPlayerTurn={!isEnemyActing && gameState.phase === 'player_turn'} />
              </div>
            </main>

            <div className="shrink-0 h-[300px] border-t border-zinc-800/40 relative">
              <Hand
                cards={gameState.hand}
                mana={gameState.mana}
                maxMana={gameState.maxMana}
                gold={gameState.gold}
                onPlay={handlePlayCard}
                disabled={!isPlayerTurn}
                isEnemyActing={isEnemyActing}
                drawCount={gameState.drawPile.length}
                discardCount={gameState.discardPile.length}
                drawPileCards={gameState.drawPile}
                discardPileCards={gameState.discardPile}
                trinkets={runTrinkets}
                log={gameState.log}
                lastCardPlayedId={gameState.lastCardPlayedId}
                overflowDiscardFxToken={gameState.overflowDiscardFxToken}
                overflowDiscardFxCount={gameState.overflowDiscardFxCount}
              />
            </div>

            {/* Win / Lose overlay */}
            <AnimatePresence>
              {(gameState.phase === 'win' || gameState.phase === 'lose') && (
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(10px)' }}
                >
                  <motion.div
                    initial={{ scale: 0.85, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <span
                      className="text-5xl font-bold tracking-tight"
                      style={{ color: gameState.phase === 'win' ? '#f59e0b' : '#ef4444' }}
                    >
                      {gameState.phase === 'win' ? 'Victory' : 'Defeat'}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {gameState.phase === 'win'
                        ? 'The enemy has been slain.'
                        : 'You have been defeated.'}
                    </span>
                  </motion.div>

                  <motion.button
                    onClick={gameState.phase === 'win' ? handleCombatWin : handleRestart}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-300 font-medium"
                    style={{ background: 'rgba(39,39,42,0.8)' }}
                    whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.6)' } as Parameters<typeof motion.button>[0]['whileHover']}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
                  >
                    {gameState.phase === 'win'
                      ? 'Continue →'
                      : <><RotateCcw size={14} /> Give Up</>}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      </AnimatePresence>
    </>
  )
}
