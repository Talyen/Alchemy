import { useState, useEffect, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useAnimationControls } from 'framer-motion'
import { FlaskConical, RotateCcw, Sword } from 'lucide-react'
import { applyCompanionStrike, beginNextPlayerTurn, createGame, playCard, resolveEnemyAction, resolveEnemyStartOfTurn, startEnemyTurn, startExtraTurnTransition } from './combat'
import { ALL_CARDS, BESTIARY_ENEMIES, getCharacterStarterCards, getRunCharacter, makeCardInstances } from './data'
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
import { GlobalScreenMenu } from './components/game/GlobalScreenMenu'
import { ShopScreen, type ShopCardOffer, type ShopTrinketOffer } from './components/game/ShopScreen'
import { ensureCtx, ensureRandomBGM, playDefeat, playVictory, stopBGM } from './sounds'

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

// ─── Main menu ───────────────────────────────────────────────────────────────

function MainMenu({
  onStart,
  onResume,
  canResume,
  onCollection,
}: {
  onStart: () => void
  onResume: () => void
  canResume: boolean
  onCollection: () => void
}) {
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
        style={{ width: 'min(95vw, calc(94vh * (16 / 9)), 1440px)', aspectRatio: '16 / 9' }}
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
            <div className="relative flex items-center gap-4">
              <div className="relative">
                <h1
                  className="text-8xl font-bold tracking-tight text-zinc-100 whitespace-nowrap leading-[1.16]"
                >
                  Alchemy
                </h1>
              </div>
              <FlaskConical
                size={56}
                className="shrink-0"
                style={{ color: '#f4f4f5' }}
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
                Resume
              </motion.button>
            )}

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

            <motion.button
              onClick={onCollection}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl border border-zinc-700/70 text-sm font-semibold tracking-widest uppercase text-zinc-300"
              style={{ background: 'rgba(39,39,42,0.5)' }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(161,161,170,0.45)' } as Parameters<typeof motion.button>[0]['whileHover']}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
            >
              Collection
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

type Screen = 'menu' | 'character-select' | 'game' | 'reward' | 'destination' | 'collection' | 'wish' | 'shop' | 'campfire' | 'mystery' | 'mystery-reward' | 'mystery-gold-reward'
type RunScreen = 'game' | 'reward' | 'destination' | 'wish' | 'shop' | 'campfire' | 'mystery' | 'mystery-reward' | 'mystery-gold-reward'

type PersistedProgressV1 = {
  encounteredEnemyIds: string[]
  encounteredCardIds: string[]
  encounteredTrinketIds: string[]
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
  shopRefreshUsed?: boolean
  shopDestroyUsed?: boolean
  runTrinkets: TrinketDef[]
  rewardGoldFound: number
  mysteryGoldFound: number
  encounteredEnemyIds: string[]
  encounteredCardIds: string[]
  encounteredTrinketIds: string[]
}

const RUN_SCREENS: RunScreen[] = ['game', 'reward', 'destination', 'wish', 'shop', 'campfire', 'mystery', 'mystery-reward', 'mystery-gold-reward']
const PROGRESSION_STORAGE_KEY = 'alchemy.progress.v1'
const RUN_STORAGE_KEY = 'alchemy.run.v1'

const LIZARD_SCOUT_COLLAR: TrinketDef = {
  id: 'lizard_scout_collar',
  name: 'Lizard Scout Collar',
  description: 'A loyal scout strikes at the end of your turn.',
}
const LIZARD_SCOUT_MYSTERY_TITLE = "He's Just a Little Guy"
const CACHE_OF_COINS_MYSTERY_TITLE = 'Cache of Coins'

const MYSTERY_EVENT_POOL = ['lizard_scout', 'cache_of_coins'] as const

const ALL_TRINKET_OFFERS: ShopTrinketOffer[] = [
  {
    id: LIZARD_SCOUT_COLLAR.id,
    name: LIZARD_SCOUT_COLLAR.name,
    description: LIZARD_SCOUT_COLLAR.description,
    price: 24,
    iconSrc: 'assets/trinkets/lizard-scout-collar.png',
  },
  {
    id: 'special_delivery',
    name: 'Special Delivery',
    description: 'Draw 1 extra card each turn.',
    price: 22,
    iconSrc: 'assets/trinkets/special-delivery.png',
  },
  {
    id: 'campfire',
    name: 'Campfire',
    description: 'Heal 10 HP after each battle.',
    price: 26,
    iconSrc: 'assets/trinkets/campfire.png',
  },
  {
    id: 'equivalent_exchange',
    name: 'Equivalent Exchange',
    description: 'Randomize 1 card each turn.',
    price: 27,
    iconSrc: 'assets/trinkets/equivalent-exchange.png',
  },
  {
    id: 'green_thumb',
    name: 'Green Thumb',
    description: 'Heal effect increased by 1.',
    price: 21,
    iconSrc: 'assets/trinkets/green-thumb.png',
  },
  {
    id: 'torch',
    name: 'Torch',
    description: 'Enemies start combat with 5 Burn.',
    price: 24,
    iconSrc: 'assets/trinkets/torch.png',
  },
  {
    id: 'spell_tome',
    name: 'Spell Tome',
    description: 'Start combat with two random Wizard cards.',
    price: 28,
    iconSrc: 'assets/trinkets/spell-tome.png',
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
  { type: 'mystery', title: 'Mystery', subtitle: 'An unknown event awaits.' },
]

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
  const [musicEnabled, setMusicEnabled]   = useState(true)
  const musicEnabledRef = useRef(musicEnabled)
  const hasHydratedPersistenceRef = useRef(false)
  const [collectionReturnScreen, setCollectionReturnScreen] = useState<Screen>('menu')
  const [lastRunScreen, setLastRunScreen] = useState<RunScreen>('game')
  const [savedRun, setSavedRun] = useState<PersistedRunV1 | null>(null)
  const [runInProgress, setRunInProgress] = useState(false)
  const [shopOffers, setShopOffers] = useState<ShopCardOffer[]>([])
  const [shopTrinketOffers, setShopTrinketOffers] = useState<ShopTrinketOffer[]>([])
  const [shopRefreshUsed, setShopRefreshUsed] = useState(false)
  const [shopDestroyUsed, setShopDestroyUsed] = useState(false)
  const [runTrinkets, setRunTrinkets] = useState<TrinketDef[]>([])
  const [rewardGoldFound, setRewardGoldFound] = useState(0)
  const [mysteryGoldFound, setMysteryGoldFound] = useState(0)
  const [pendingCompanionTurn, setPendingCompanionTurn] = useState(false)
  const [companionAttackTick, setCompanionAttackTick] = useState(0)
  const [encounteredEnemyIds, setEncounteredEnemyIds] = useState<Set<string>>(new Set())
  const [encounteredCardIds, setEncounteredCardIds] = useState<Set<string>>(new Set())
  const [encounteredTrinketIds, setEncounteredTrinketIds] = useState<Set<string>>(new Set())
  const hasLizardScoutCompanion = runTrinkets.some(trinket => trinket.id === LIZARD_SCOUT_COLLAR.id)
  const canResume = runInProgress || savedRun !== null

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
    setShopRefreshUsed(snapshot.shopRefreshUsed ?? false)
    setShopDestroyUsed(snapshot.shopDestroyUsed ?? false)
    setRunTrinkets(snapshot.runTrinkets)
    setRewardGoldFound(snapshot.rewardGoldFound)
    setMysteryGoldFound(snapshot.mysteryGoldFound)
    setEncounteredEnemyIds(new Set(snapshot.encounteredEnemyIds))
    setEncounteredCardIds(new Set(snapshot.encounteredCardIds))
    setEncounteredTrinketIds(new Set(snapshot.encounteredTrinketIds))
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
    }
    window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(progress))
  }, [encounteredEnemyIds, encounteredCardIds, encounteredTrinketIds])

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
      shopRefreshUsed,
      shopDestroyUsed,
      runTrinkets,
      rewardGoldFound,
      mysteryGoldFound,
      encounteredEnemyIds: Array.from(encounteredEnemyIds),
      encounteredCardIds: Array.from(encounteredCardIds),
      encounteredTrinketIds: Array.from(encounteredTrinketIds),
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
    shopRefreshUsed,
    shopDestroyUsed,
    runTrinkets,
    rewardGoldFound,
    mysteryGoldFound,
    encounteredEnemyIds,
    encounteredCardIds,
    encounteredTrinketIds,
  ])

  useEffect(() => {
    if (RUN_SCREENS.includes(screen as RunScreen)) {
      setLastRunScreen(screen as RunScreen)
      setRunInProgress(true)
    }
  }, [screen])

  useEffect(() => {
    if (previewMode === 'destination') {
      setDestinationOptions(pickRandom(DESTINATION_POOL, 3))
      setCurrentRoomLabel('Combat')
      setScreen('destination')
      return
    }

  }, [previewMode])

  useEffect(() => {
    musicEnabledRef.current = musicEnabled
  }, [musicEnabled])

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

  const handleToggleMusic = useCallback(() => {
    setMusicEnabled(prev => !prev)
  }, [])

  const isPlayerTurn = gameState.phase === 'player_turn'

  // ── Menu → First combat ──
  const resetRunState = useCallback(() => {
    setRunExtraCards([])
    setRunDeckCards([])
    setPersistentHp(30)
    setPersistentGold(0)
    setDestinationOptions([])
    setCurrentRoomLabel('Start')
    setShopOffers([])
    setShopTrinketOffers([])
    setShopRefreshUsed(false)
    setShopDestroyUsed(false)
    setRunTrinkets([])
    setRewardGoldFound(0)
    setMysteryGoldFound(0)
    setPendingCompanionTurn(false)
    setCompanionAttackTick(0)
  }, [])

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
    const starterCards = getCharacterStarterCards(characterId)
    const starterCardIds = new Set(getCharacterStarterCards(characterId).map(card => card.id))
    setRunDeckCards(starterCards)
    setEncounteredCardIds(prev => new Set([...prev, ...starterCardIds]))
    setCurrentRoomLabel('Combat')
    setGameState(createGame(30, [], 'basic', 0, characterId, undefined, [], starterCards))
    setLastRunScreen('game')
    setRunInProgress(true)
    setScreen('game')
  }

  const buildShopOffers = useCallback((): ShopCardOffer[] => {
    const cards = pickRandom(ALL_CARDS, 3)
    return cards.map((card, index) => {
      const typeBonus = card.type === 'upgrade' ? 2 : card.type === 'heal' ? 1 : 0
      const price = Math.max(3, card.cost * 3 + typeBonus + 1)
      return { id: `shop-${card.id}-${Date.now()}-${index}`, card, price }
    })
  }, [])

  const buildShopTrinketOffers = useCallback((): ShopTrinketOffer[] => {
    const SHOP_TRINKET_OFFER_COUNT = 3
    const ownedIds = new Set(runTrinkets.map(trinket => trinket.id))
    const available = ALL_TRINKET_OFFERS.filter(offer => !ownedIds.has(offer.id))
    return pickRandom(available, Math.min(SHOP_TRINKET_OFFER_COUNT, available.length))
  }, [runTrinkets])

  // ── Combat actions ──
  const handlePlayCard = (uid: string) => {
    const card = gameState.hand.find(entry => entry.uid === uid)
    if (card) {
      setEncounteredCardIds(prev => new Set([...prev, card.id]))
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
    if (!hasLizardScoutCompanion) {
      startEnemySequence()
      return
    }

    setCompanionAttackTick(prev => prev + 1)
    setGameState(prev => applyCompanionStrike(prev, 6, 'Lizard Scout'))
    setPendingCompanionTurn(true)
  }, [hasLizardScoutCompanion, startEnemySequence])

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
    const healedHp = hasCampfireTrinket ? Math.min(30, gameState.player.hp + 10) : gameState.player.hp

    setRewardGoldFound(foundGold)
    setPersistentHp(healedHp)
    setPersistentGold(gameState.gold + foundGold)
    setPickOptions(pickRandom(ALL_CARDS, 3))
    setScreen('reward')
  }

  // ── Reward pick → Destination choice ──
  const handleRewardPick = (card: CardDef) => {
    setRunExtraCards(prev => [...prev, card])
    setRunDeckCards(prev => [...prev, card])
    setEncounteredCardIds(prev => new Set([...prev, card.id]))
    setRewardGoldFound(0)
    setDestinationOptions(pickRandom(DESTINATION_POOL, 3))
    setScreen('destination')
  }

  // ── Destination choice → Combat ──
  const handleDestinationChoose = (type: DestinationType) => {
    const selected = DESTINATION_POOL.find(room => room.type === type)
    const label = selected?.title ?? 'Combat'

    if (type === 'shop') {
      setCurrentRoomLabel(label)
      setShopOffers(buildShopOffers())
      setShopTrinketOffers(buildShopTrinketOffers())
      setShopRefreshUsed(false)
      setShopDestroyUsed(false)
      setScreen('shop')
      return
    }

    if (type === 'rest') {
      setCurrentRoomLabel(label)
      setScreen('campfire')
      return
    }

    if (type === 'mystery') {
      const mysteryEvent = MYSTERY_EVENT_POOL[Math.floor(Math.random() * MYSTERY_EVENT_POOL.length)]
      if (mysteryEvent === 'cache_of_coins') {
        const found = Math.floor(Math.random() * 11) + 20
        setMysteryGoldFound(found)
        setPersistentGold(prev => prev + found)
        setCurrentRoomLabel(CACHE_OF_COINS_MYSTERY_TITLE)
        setScreen('mystery-gold-reward')
        return
      }

      setCurrentRoomLabel(LIZARD_SCOUT_MYSTERY_TITLE)
      setScreen('mystery')
      return
    }

    let nextHp = persistentHp

    setCurrentRoomLabel(label)
    setPersistentHp(nextHp)
    setGameState(createGame(nextHp, runExtraCards, type === 'elite' ? 'elite' : 'basic', persistentGold, selectedCharacterId, undefined, runTrinkets.map(trinket => trinket.id), runDeckCards))
    setScreen('game')
  }

  const handleBuyShopCard = (offerId: string) => {
    const offer = shopOffers.find(entry => entry.id === offerId)
    if (!offer) return
    if (persistentGold < offer.price) return
    setPersistentGold(prev => prev - offer.price)
    setRunExtraCards(prev => [...prev, offer.card])
    setRunDeckCards(prev => [...prev, offer.card])
    setEncounteredCardIds(prev => new Set([...prev, offer.card.id]))
    setShopOffers(prev => prev.filter(entry => entry.id !== offerId))
  }

  const handleRefreshShop = () => {
    const SHOP_REFRESH_COST = 15
    if (shopRefreshUsed) return
    if (persistentGold < SHOP_REFRESH_COST) return
    setPersistentGold(prev => prev - SHOP_REFRESH_COST)
    setShopOffers(buildShopOffers())
    setShopTrinketOffers(buildShopTrinketOffers())
    setShopRefreshUsed(true)
  }

  const handleDestroyShopCard = (deckIndex: number) => {
    const DESTROY_CARD_COST = 35
    if (shopDestroyUsed) return
    if (persistentGold < DESTROY_CARD_COST) return
    if (deckIndex < 0 || deckIndex >= runDeckCards.length) return
    if (runDeckCards.length <= 1) return

    const removedCard = runDeckCards[deckIndex]
    setPersistentGold(prev => prev - DESTROY_CARD_COST)
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
    setDestinationOptions(pickRandom(DESTINATION_POOL, 3))
    setScreen('destination')
  }

  const handleCampfireRest = (healAmount: number) => {
    setPersistentHp(prev => Math.min(30, prev + healAmount))
    returnToDestination()
  }

  const handleMysteryBefriend = () => {
    setRunTrinkets(prev => (prev.some(trinket => trinket.id === LIZARD_SCOUT_COLLAR.id) ? prev : [...prev, LIZARD_SCOUT_COLLAR]))
    setEncounteredTrinketIds(prev => new Set([...prev, LIZARD_SCOUT_COLLAR.id]))
    setScreen('mystery-reward')
  }

  const handleMysteryFight = () => {
    setCurrentRoomLabel('Lizard Scout')
    setGameState(createGame(persistentHp, runExtraCards, 'basic', persistentGold, selectedCharacterId, 'lizard_f', runTrinkets.map(trinket => trinket.id), runDeckCards))
    setScreen('game')
  }

  const handleWishPick = (card: CardDef) => {
    setEncounteredCardIds(prev => new Set([...prev, card.id]))
    setGameState(prev => {
      const instance = makeCardInstances([card])[0]
      return {
        ...prev,
        hand: [...prev.hand, instance],
        wishOptions: [],
        log: [...prev.log, `Wish grants ${card.name}.`].slice(-10),
      }
    })
    setScreen('game')
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

  // ── Lose / abandon → Menu ──
  const handleRestart = () => {
    resetRunState()
    setRunInProgress(false)
    setSavedRun(null)
    window.localStorage.removeItem(RUN_STORAGE_KEY)
    setScreen('menu')
  }

  const handleDevSkipCombat = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      enemy: { ...prev.enemy, hp: 0 },
      phase: 'win',
      log: [...prev.log, 'DEV: Encounter skipped.'].slice(-10),
    }))
  }, [])

  const renderGlobalMenu = (opts?: { direction?: 'up' | 'down'; align?: 'left' | 'right'; onSkipDevCombat?: () => void }) => (
    <GlobalScreenMenu
      onGoMainMenu={handleReturnToMainMenu}
      onGoCharacterSelect={handleOpenCharacterSelect}
      onOpenCollection={() => openCollection(screen)}
      musicEnabled={musicEnabled}
      onToggleMusic={handleToggleMusic}
      onSkipDevCombat={opts?.onSkipDevCombat}
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
          deckCards={runDeckCards}
          refreshCost={15}
          destroyCardCost={35}
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

      {screen === 'mystery' && (
        <MysteryLizardScoutScreen
          key="mystery"
          characterId={selectedCharacterId}
          onBefriend={handleMysteryBefriend}
          onFight={handleMysteryFight}
          topLeft={renderGlobalMenu({ direction: 'up', align: 'right' })}
        />
      )}

      {screen === 'mystery-reward' && (
        <MysteryTrinketRewardScreen
          key="mystery-reward"
          trinketName={LIZARD_SCOUT_COLLAR.name}
          trinketIconSrc="assets/trinkets/lizard-scout-collar.png"
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

      {screen === 'campfire' && (
        <CampfireScreen
          key="campfire"
          characterId={selectedCharacterId}
          currentHp={persistentHp}
          maxHp={30}
          onRest={handleCampfireRest}
          showLizardCompanion={hasLizardScoutCompanion}
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
            style={{ width: 'min(95vw, calc(94vh * (16 / 9)), 1440px)', aspectRatio: '16 / 9' }}
          >
            <div className="absolute right-24 bottom-6 z-[90]">
              {renderGlobalMenu({
                direction: 'up',
                align: 'right',
                onSkipDevCombat:
                  isDevBuild && gameState.phase !== 'win' && gameState.phase !== 'lose'
                    ? handleDevSkipCombat
                    : undefined,
              })}
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
                    trinkets={runTrinkets}
                    showLizardCompanion={hasLizardScoutCompanion}
                    companionAttackTick={companionAttackTick}
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
                log={gameState.log}
                lastCardPlayedId={gameState.lastCardPlayedId}
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
