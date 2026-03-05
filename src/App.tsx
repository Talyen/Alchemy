import { useState, useEffect, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useAnimationControls } from 'framer-motion'
import { FlaskConical, RotateCcw, Sword } from 'lucide-react'
import { beginNextPlayerTurn, createGame, playCard, resolveEnemyAction, resolveEnemyStartOfTurn, startEnemyTurn } from './combat'
import { ALL_CARDS, getRunCharacter, makeCardInstances } from './data'
import type { CardDef, GameState } from './types'
import { EnemyPanel }      from './components/game/EnemyPanel'
import { PlayerPanel }     from './components/game/PlayerPanel'
import { Hand }            from './components/game/Hand'
import { CardPickScreen }  from './components/game/CardPickScreen'
import { CollectionScreen } from './components/game/CollectionScreen'
import { CharacterSelectScreen } from './components/game/CharacterSelectScreen'
import { ChooseDestinationScreen, type DestinationOption, type DestinationType } from './components/game/ChooseDestinationScreen'
import { CampfireScreen } from './components/game/CampfireScreen'
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
  onCollection,
  topLeft,
}: {
  onStart: () => void
  onCollection: () => void
  topLeft?: ReactNode
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
        {topLeft ? <div className="absolute left-5 top-5 z-50">{topLeft}</div> : null}

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
// Container is 512 px wide: player center @ 88 px, enemy center @ 424 px.
function TurnIndicator({ isPlayerTurn }: { isPlayerTurn: boolean }) {
  return (
    <div className="relative h-9" style={{ width: 512 }}>
      <motion.div
        className="absolute top-0 flex flex-col items-center whitespace-nowrap"
        style={{ translateX: '-50%' }}
        animate={{
          left:  isPlayerTurn ? 88 : 424,
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

type Screen = 'menu' | 'character-select' | 'game' | 'reward' | 'destination' | 'collection' | 'wish' | 'shop' | 'campfire'

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

const SHOP_TRINKET_PLACEHOLDERS: ShopTrinketOffer[] = [
  { id: 'trinket-1', name: 'Lucky Coin', description: 'Trinket system coming soon.', price: 18 },
  { id: 'trinket-2', name: 'Traveler Charm', description: 'Trinket system coming soon.', price: 22 },
  { id: 'trinket-3', name: 'Ashen Relic', description: 'Trinket system coming soon.', price: 26 },
]

export default function App() {
  const ENEMY_START_DELAY_MS = 350
  const ENEMY_ACTION_DELAY_MS = 850
  const ENEMY_END_DELAY_MS = 650

  const previewMode = getPreviewMode()
  const [screen, setScreen]               = useState<Screen>('menu')
  const [persistentHp, setPersistentHp]   = useState(30)
  const [persistentGold, setPersistentGold] = useState(0)
  const [runExtraCards, setRunExtraCards] = useState<CardDef[]>([])
  const [pickOptions, setPickOptions]     = useState<CardDef[]>([])
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([])
  const [currentRoomLabel, setCurrentRoomLabel] = useState('Start')
  const [selectedCharacterId, setSelectedCharacterId] = useState('knight')
  const [gameState, setGameState]         = useState<GameState>(createGame)
  const [isEnemyActing, setIsEnemyActing] = useState(false)
  const [musicEnabled, setMusicEnabled]   = useState(true)
  const [collectionReturnScreen, setCollectionReturnScreen] = useState<Screen>('menu')
  const [shopOffers, setShopOffers] = useState<ShopCardOffer[]>([])

  useEffect(() => {
    if (previewMode === 'destination') {
      setDestinationOptions(pickRandom(DESTINATION_POOL, 3))
      setCurrentRoomLabel('Combat')
      setScreen('destination')
      return
    }

  }, [previewMode])

  // pre‑warm audio context on first user interaction to avoid jank
  useEffect(() => {
    const listener = () => {
      ensureCtx()
      if (musicEnabled) {
        ensureRandomBGM()
      }
    }
    window.addEventListener('click', listener, { once: true })
    return () => window.removeEventListener('click', listener)
  }, [musicEnabled])

  useEffect(() => {
    if (musicEnabled) {
      ensureCtx()
      ensureRandomBGM()
    } else {
      stopBGM()
    }

    return () => {
      stopBGM()
    }
  }, [musicEnabled])

  const isPlayerTurn = gameState.phase === 'player_turn'

  // ── Menu → First combat ──
  const resetRunState = useCallback(() => {
    setRunExtraCards([])
    setPersistentHp(30)
    setPersistentGold(0)
    setDestinationOptions([])
    setCurrentRoomLabel('Start')
    setShopOffers([])
  }, [])

  const openCollection = (from: Screen) => {
    setCollectionReturnScreen(from)
    setScreen('collection')
  }

  const handleOpenCharacterSelect = () => {
    resetRunState()
    setScreen('character-select')
  }

  const handleStart = (characterId: string) => {
    resetRunState()
    setSelectedCharacterId(characterId)
    setCurrentRoomLabel('Combat')
    setGameState(createGame(30, [], 'basic', 0, characterId))
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

  // ── Combat actions ──
  const handlePlayCard = (uid: string) => setGameState(prev => playCard(prev, uid))

  const handleEndTurn = useCallback(() => {
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
  }, [ENEMY_ACTION_DELAY_MS, ENEMY_END_DELAY_MS, ENEMY_START_DELAY_MS])

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
    setPersistentHp(gameState.player.hp)
    setPersistentGold(gameState.gold)
    setPickOptions(pickRandom(ALL_CARDS, 3))
    setScreen('reward')
  }

  // ── Reward pick → Destination choice ──
  const handleRewardPick = (card: CardDef) => {
    setRunExtraCards(prev => [...prev, card])
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
      setScreen('shop')
      return
    }

    if (type === 'rest') {
      setCurrentRoomLabel(label)
      setScreen('campfire')
      return
    }

    let nextHp = persistentHp
    if (type === 'mystery') {
      // simple mystery effect for now
      const mysteryHeal = Math.random() < 0.5 ? 4 : 0
      nextHp = Math.min(30, persistentHp + mysteryHeal)
    }

    setCurrentRoomLabel(label)
    setPersistentHp(nextHp)
    setGameState(createGame(nextHp, runExtraCards, type === 'elite' ? 'elite' : 'basic', persistentGold, selectedCharacterId))
    setScreen('game')
  }

  const handleBuyShopCard = (offerId: string) => {
    const offer = shopOffers.find(entry => entry.id === offerId)
    if (!offer) return
    if (persistentGold < offer.price) return
    setPersistentGold(prev => prev - offer.price)
    setRunExtraCards(prev => [...prev, offer.card])
    setShopOffers(prev => prev.filter(entry => entry.id !== offerId))
  }

  const returnToDestination = () => {
    setDestinationOptions(pickRandom(DESTINATION_POOL, 3))
    setScreen('destination')
  }

  const handleCampfireRest = () => {
    const healed = Math.min(30, persistentHp + Math.ceil(30 * 0.3))
    setPersistentHp(healed)
    returnToDestination()
  }

  const handleWishPick = (card: CardDef) => {
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

  // ── Lose / abandon → Menu ──
  const handleRestart = () => {
    resetRunState()
    setScreen('menu')
  }

  const renderGlobalMenu = () => (
    <GlobalScreenMenu
      onGoMainMenu={handleRestart}
      onGoCharacterSelect={handleOpenCharacterSelect}
      onOpenCollection={() => openCollection(screen)}
      musicEnabled={musicEnabled}
      onToggleMusic={() => setMusicEnabled(prev => !prev)}
    />
  )

  return (
    <>
      <AnimatePresence mode="wait">

      {screen === 'menu' && (
        <MainMenu
          key="menu"
          onStart={handleOpenCharacterSelect}
          onCollection={() => openCollection('menu')}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'character-select' && (
        <CharacterSelectScreen
          key="character-select"
          onSelect={handleStart}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          key="collection"
          cards={ALL_CARDS}
          onBack={() => setScreen(collectionReturnScreen === 'collection' ? 'menu' : collectionReturnScreen)}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'reward' && (
        <CardPickScreen
          key="reward"
          title="Choose a Reward"
          subtitle="Victory"
          options={pickOptions}
          onPick={handleRewardPick}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'destination' && (
        <ChooseDestinationScreen
          key="destination"
          currentRoomLabel={currentRoomLabel}
          options={destinationOptions}
          onChoose={handleDestinationChoose}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'wish' && (
        <CardPickScreen
          key="wish"
          title="Wish"
          subtitle="Choose 1 of 3"
          options={gameState.wishOptions}
          onPick={handleWishPick}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'shop' && (
        <ShopScreen
          key="shop"
          gold={persistentGold}
          cardOffers={shopOffers}
          trinketOffers={SHOP_TRINKET_PLACEHOLDERS}
          onBuyCard={handleBuyShopCard}
          onLeave={returnToDestination}
          topLeft={renderGlobalMenu()}
        />
      )}

      {screen === 'campfire' && (
        <CampfireScreen
          key="campfire"
          characterId={selectedCharacterId}
          currentHp={persistentHp}
          maxHp={30}
          onRest={handleCampfireRest}
          topLeft={renderGlobalMenu()}
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
            <div className="absolute left-5 top-5 z-[90]">{renderGlobalMenu()}</div>

            <main className="flex-1 flex items-center justify-center px-8 pt-8 min-h-0">
              <div className="flex flex-col items-center gap-4 translate-y-6">
                <div className="flex items-start gap-52">
                  <PlayerPanel
                    player={gameState.player}
                    gold={gameState.gold}
                    characterName={getRunCharacter(gameState.characterId).name}
                    isActive={isPlayerTurn && !isEnemyActing}
                    lastCardPlayedId={gameState.lastCardPlayedId}
                    activeUpgrades={gameState.activeUpgrades}
                  />
                  <EnemyPanel
                    enemy={gameState.enemy}
                    isActing={isEnemyActing}
                    isActive={isEnemyActing}
                    lastCardPlayedId={gameState.lastCardPlayedId}
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
