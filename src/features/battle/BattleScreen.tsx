import {
  IconBook2,
  IconBolt,
  IconCoins,
  IconDoorExit,
  IconFlask2,
  IconListDetails,
  IconMenu2,
  IconSettings,
  IconShoppingBag,
  IconSmartHome,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ManaPool } from '@/entities/cards/types';
import { CombatantPanel, type FloatingCombatText } from '@/features/battle/CombatantPanel';
import { enemyStatusIcons, playerStatusIcons } from '@/features/battle/CombatantStatusCard';
import { HandFan } from '@/features/battle/HandFan';
import { PileToken } from '@/features/battle/PileToken';
import { cardsById } from '@/shared/content/cards';
import { effectColorPalette } from '@/shared/content/keywords';
import { manaTypeOrder, ManaCrystalIcon } from '@/shared/ui/ManaCrystal';

type CombatantSide = 'enemy' | 'player';

type FloatingTextState = FloatingCombatText & {
  side: CombatantSide;
};

function getTotalMana(pool: ManaPool) {
  return manaTypeOrder.reduce((total, type) => total + pool[type], 0);
}

function ManaCounter({ mana, maxMana }: { mana: ManaPool; maxMana: ManaPool }) {
  const totalCurrentMana = getTotalMana(mana);
  const totalMaxMana = getTotalMana(maxMana);
  const manaCrystals = manaTypeOrder.flatMap((type) =>
    Array.from({ length: maxMana[type] }).map((_, index) => ({
      active: index < mana[type],
      type,
    })),
  );

  return (
    <Card
      data-current-mana={totalCurrentMana}
      data-max-mana={totalMaxMana}
      data-testid="mana-counter"
      className="rounded-full border-[rgba(116,198,255,0.24)] bg-[rgba(17,15,14,0.94)] px-3 py-2"
    >
      <div className="flex flex-wrap gap-1.5">
        {manaCrystals.map((crystal, index) => (
          <ManaCrystalIcon active={crystal.active} key={`mana-${crystal.type}-${index}`} size={16} type={crystal.type} />
        ))}
      </div>
    </Card>
  );
}

function BattleSidePanel({
  children,
  onClose,
  side,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  side: 'left' | 'right';
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <div className={`absolute top-0 h-full w-full max-w-md p-4 ${side === 'left' ? 'left-0' : 'right-0'}`} onClick={(event) => event.stopPropagation()}>
        <Card className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button aria-label={`Close ${title}`} onClick={onClose} size="icon" variant="ghost">
              <IconX size={18} stroke={2.1} />
            </Button>
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">{children}</div>
        </Card>
      </div>
    </div>
  );
}

export function BattleScreen() {
  const navigate = useNavigate();
  const [combatLogOpened, setCombatLogOpened] = useState(false);
  const [inventoryOpened, setInventoryOpened] = useState(false);
  const [screenMenuOpen, setScreenMenuOpen] = useState(false);
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const screenMenuRef = useRef<HTMLDivElement | null>(null);
  const floatingTextTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const previousCombatSnapshotRef = useRef<{
    enemyHealth: number;
    playerArmor: number;
    playerBlock: number;
    playerForge: number;
    playerHealth: number;
  } | null>(null);
  const [attackPulse, setAttackPulse] = useState({ enemy: 0, player: 0 });
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextState[]>([]);
  const { battle, battleWins, currentCharacter, deckCardIds, endTurn, playCard, player, resetRun, resolveWish, result, rewardChoices, skipCombatDevMode } = useGame();

  const pushFloatingTexts = useCallback((entries: Array<Omit<FloatingTextState, 'id'>>) => {
    const nextEntries = entries.map((entry) => ({
      ...entry,
      id: `${entry.side}-${Math.random().toString(36).slice(2, 9)}`,
    }));

    setFloatingTexts((current) => [...current, ...nextEntries]);

    for (const entry of nextEntries) {
      const timeout = setTimeout(() => {
        setFloatingTexts((current) => current.filter((item) => item.id !== entry.id));
        floatingTextTimeoutsRef.current.delete(entry.id);
      }, 820);

      floatingTextTimeoutsRef.current.set(entry.id, timeout);
    }
  }, []);

  useEffect(
    () => () => {
      for (const timeout of floatingTextTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
    },
    [],
  );

  useEffect(() => {
    if (!screenMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!screenMenuRef.current?.contains(event.target as Node)) {
        setScreenMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setScreenMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [screenMenuOpen]);

  useEffect(() => {
    if (!battle || !player) {
      previousCombatSnapshotRef.current = null;
      return;
    }

    const previousSnapshot = previousCombatSnapshotRef.current;

    if (previousSnapshot) {
      const nextTexts: Array<Omit<FloatingTextState, 'id'>> = [];

      if (battle.enemy.health < previousSnapshot.enemyHealth) {
        nextTexts.push({ color: effectColorPalette.targetHostile, label: `-${previousSnapshot.enemyHealth - battle.enemy.health}`, side: 'enemy' });
        setAttackPulse((current) => ({ ...current, player: current.player + 1 }));
      }

      if (player.health > previousSnapshot.playerHealth) {
        nextTexts.push({ color: effectColorPalette.targetRestore, label: `+${player.health - previousSnapshot.playerHealth}`, side: 'player' });
      }

      if (player.health < previousSnapshot.playerHealth) {
        nextTexts.push({ color: effectColorPalette.targetHostile, label: `-${previousSnapshot.playerHealth - player.health}`, side: 'player' });
        setAttackPulse((current) => ({ ...current, enemy: current.enemy + 1 }));
      }

      if (player.block > previousSnapshot.playerBlock) {
        nextTexts.push({ color: effectColorPalette.targetBlock, label: `+${player.block - previousSnapshot.playerBlock} Block`, side: 'player' });
      }

      if (player.armor > previousSnapshot.playerArmor) {
        nextTexts.push({ color: effectColorPalette.targetArmor, label: `+${player.armor - previousSnapshot.playerArmor} Armor`, side: 'player' });
      }

      if (player.forge > previousSnapshot.playerForge) {
        nextTexts.push({ color: effectColorPalette.targetForge, label: `+${player.forge - previousSnapshot.playerForge} Forge`, side: 'player' });
      }

      if (nextTexts.length > 0) {
        pushFloatingTexts(nextTexts);
      }
    }

    previousCombatSnapshotRef.current = {
      enemyHealth: battle.enemy.health,
      playerArmor: player.armor,
      playerBlock: player.block,
      playerForge: player.forge,
      playerHealth: player.health,
    };
  }, [battle, player, pushFloatingTexts]);

  useEffect(() => {
    if (!battle || battle.status !== 'victory') {
      return;
    }

    if (result?.result === 'victory') {
      navigate('/run/end', { replace: true });
      return;
    }

    if (rewardChoices.length > 0) {
      navigate('/battle/reward', { replace: true });
    }
  }, [battle, navigate, result?.result, rewardChoices.length]);

  const handCards = useMemo(
    () =>
      battle && player
        ? battle.hand.map((cardInstance) => ({
            card: cardsById[cardInstance.cardId],
            instanceId: cardInstance.instanceId,
            playable: battle.status === 'player-turn' && getTotalMana(player.mana) > 0,
          }))
        : [],
    [battle, player],
  );
  const playerStatuses = useMemo(
    () =>
      player
        ? [
            { ...playerStatusIcons.block, id: 'block', value: player.block },
            { ...playerStatusIcons.armor, id: 'armor', value: player.armor },
            { ...playerStatusIcons.forge, id: 'forge', value: player.forge },
          ]
        : [],
    [player],
  );
  const enemyStatuses = useMemo(
    () =>
      battle
        ? [
            { ...enemyStatusIcons.burn, id: 'burn', value: battle.enemy.statusEffects.burn },
            { ...enemyStatusIcons.bleed, id: 'bleed', value: battle.enemy.statusEffects.bleed },
            { ...enemyStatusIcons.poison, id: 'poison', value: battle.enemy.statusEffects.poison },
            { ...enemyStatusIcons.freeze, id: 'freeze', value: battle.enemy.statusEffects.freeze },
            { ...enemyStatusIcons.stun, id: 'stun', value: battle.enemy.statusEffects.stun },
            { ...enemyStatusIcons.skipTurn, id: 'skip-turn', value: battle.enemy.statusEffects.skipTurn ? 1 : 0 },
          ]
        : [],
    [battle],
  );
  const deckCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const cardId of deckCardIds) {
      counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([cardId, count]) => ({ card: cardsById[cardId], count }))
      .sort((left, right) => left.card.title.localeCompare(right.card.title));
  }, [deckCardIds]);
  const canSkipCombat = Boolean(import.meta.env.DEV && battle && battle.status === 'player-turn' && !result);
  const closeCombatLog = () => setCombatLogOpened(false);
  const closeInventory = () => setInventoryOpened(false);

  if (!battle || !player || !currentCharacter) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-battle-empty">
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">No Active Battle</h2>
            <p className="text-muted-foreground">Start a new run to enter battle.</p>
            <Button onClick={() => navigate('/run/new')}>
              Go to character select
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const combatantArtFrame = {
    height: 'clamp(144px, 1vh, 220px)',
    width: 'clamp(232px, 1vw, 304px)',
  } as const;

  return (
    <div className="relative h-full px-6 py-8" data-testid="screen-battle">
      {combatLogOpened ? (
        <BattleSidePanel onClose={closeCombatLog} side="right" title="Combat Log">
          <div className="space-y-3">
            {battle.log.length > 0 ? (
              battle.log.map((entry, index) => (
                <Card className="p-4" key={`${entry}-${index}`}>
                  <p className="text-sm text-muted-foreground">{entry}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">The combat log is empty.</p>
            )}
          </div>
        </BattleSidePanel>
      ) : null}

      {inventoryOpened ? (
        <BattleSidePanel onClose={closeInventory} side="left" title="Inventory">
          <div className="space-y-4">
            <Card className="rounded-3xl bg-[rgba(17,15,14,0.96)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">Gold</p>
                <div className="flex items-center gap-1.5">
                  <IconCoins color={effectColorPalette.gold} size={18} stroke={2.2} />
                  <span className="font-extrabold" style={{ color: effectColorPalette.gold }}>
                    {player.gold}
                  </span>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <p className="font-bold">Deck</p>
              {deckCounts.map((entry) => (
                <Card className="rounded-3xl bg-[rgba(17,15,14,0.96)] p-4" key={entry.card.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span>{entry.card.title}</span>
                    <span className="text-sm text-muted-foreground">x{entry.count}</span>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="rounded-3xl bg-[rgba(17,15,14,0.96)] p-4">
              <div className="space-y-1">
                <p className="font-bold">Trinkets</p>
                <p className="text-sm text-muted-foreground">No trinkets collected yet.</p>
              </div>
            </Card>
          </div>
        </BattleSidePanel>
      ) : null}

      <div className="absolute right-6 top-6 z-40" ref={screenMenuRef}>
        <Button
          aria-label="Screen menu"
          className="h-[52px] w-[52px] rounded-full border-primary/30 bg-primary text-primary-foreground shadow-panel hover:bg-primary/90"
          onClick={() => setScreenMenuOpen((current) => !current)}
          size="icon"
        >
          <IconMenu2 size={24} />
        </Button>

        {screenMenuOpen ? (
          <Card className="absolute right-0 mt-3 w-[240px] p-2 shadow-panel">
            <div className="space-y-1">
              {[
                { icon: IconSmartHome, label: 'Main Menu', onSelect: () => navigate('/') },
                { icon: IconSettings, label: 'Options', onSelect: () => navigate('/options') },
                { icon: IconBook2, label: 'Collection', onSelect: () => navigate('/collection') },
                { icon: IconFlask2, label: 'Test Lab', onSelect: () => navigate('/test-lab') },
                { icon: IconListDetails, label: 'Combat Log', onSelect: () => setCombatLogOpened(true) },
              ].map((action) => {
                const Icon = action.icon;

                return (
                  <Button
                    className="w-full justify-start rounded-2xl"
                    key={action.label}
                    onClick={() => {
                      setScreenMenuOpen(false);
                      action.onSelect();
                    }}
                    variant="ghost"
                  >
                    <Icon size={16} stroke={2.1} />
                    <span>{action.label}</span>
                  </Button>
                );
              })}

              {canSkipCombat ? (
                <Button
                  className="w-full justify-start rounded-2xl"
                  onClick={() => {
                    setScreenMenuOpen(false);
                    skipCombatDevMode();
                    navigate(battleWins + 1 >= 3 ? '/run/end' : '/battle/reward');
                  }}
                  variant="ghost"
                >
                  <IconBolt size={16} stroke={2.1} />
                  <span>Skip Combat (Dev Mode)</span>
                </Button>
              ) : null}

              <div className="my-1 h-px bg-white/10" />

              <Button
                className="w-full justify-start rounded-2xl text-red-300 hover:bg-red-500/10 hover:text-red-200"
                onClick={() => {
                  setScreenMenuOpen(false);
                  resetRun();
                  navigate('/');
                }}
                variant="ghost"
              >
                <IconDoorExit size={16} stroke={2.1} />
                <span>End Run</span>
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <div className="grid h-full gap-0 overflow-visible" style={{ gridTemplateRows: 'minmax(0, 1fr) 450px' }}>
        <div
          data-testid="battle-combatants"
          style={{
            alignItems: 'end',
            display: 'grid',
            gap: 'clamp(120px, 16vw, 240px)',
            gridTemplateColumns: 'repeat(2, minmax(232px, 304px))',
            justifyContent: 'center',
            marginInline: 'auto',
            minHeight: 0,
            position: 'relative',
            width: 'min(100%, 1180px)',
            zIndex: 10,
          }}
          className="pt-10"
        >
          <CombatantPanel
            attackPulse={attackPulse.player}
            artPath={currentCharacter.artPath}
            currentHealth={player.health}
            floatingTextSide="right"
            floatingTexts={floatingTexts.filter((entry) => entry.side === 'player')}
            frameHeight={combatantArtFrame.height}
            frameWidth={combatantArtFrame.width}
            maxHealth={player.maxHealth}
            name={currentCharacter.name}
            side="player"
            statusIcons={playerStatuses}
          />

          <CombatantPanel
            attackPulse={attackPulse.enemy}
            artPath={battle.enemy.artPath}
            currentHealth={battle.enemy.health}
            floatingTextSide="left"
            floatingTexts={floatingTexts.filter((entry) => entry.side === 'enemy')}
            frameHeight={combatantArtFrame.height}
            frameWidth={combatantArtFrame.width}
            maxHealth={battle.enemy.maxHealth}
            name={battle.enemy.name}
            side="enemy"
            statusIcons={enemyStatuses}
          />
        </div>

        <div style={{ overflow: 'visible', position: 'relative' }}>
          <div
            style={{
              height: '100%',
              marginInline: 'auto',
              maxWidth: 1320,
              overflow: 'visible',
              position: 'relative',
              width: '100%',
              zIndex: 30,
            }}
          >
            <div className="absolute bottom-[42px] left-0 z-[5]">
              <div className="flex flex-col items-start gap-3">
                <ManaCounter mana={player.mana} maxMana={player.maxMana} />

                <div className="flex items-center gap-3">
                  <Card className="rounded-full border-[rgba(217,178,71,0.28)] bg-[rgba(17,15,14,0.94)] px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <IconCoins color={effectColorPalette.gold} size={16} stroke={2.2} />
                      <span className="text-sm font-extrabold" style={{ color: effectColorPalette.gold }}>
                        {player.gold}
                      </span>
                    </div>
                  </Card>

                  <Button aria-label="Inventory" onClick={() => setInventoryOpened(true)} size="icon" variant="outline">
                    <IconShoppingBag size={18} stroke={2.1} />
                  </Button>
                </div>

                <div ref={drawPileRef}>
                  <PileToken
                    count={battle.drawPile.length}
                    imagePath="/assets/ui/draw-pile-placeholder.svg"
                    label="Draw Pile"
                  />
                </div>
              </div>
            </div>

            <div style={{ height: '100%', minWidth: 0, overflow: 'visible', paddingInline: 'clamp(120px, 12vw, 180px)', position: 'relative' }}>
              <HandFan
                cards={handCards}
                discardAnchorRef={discardPileRef}
                drawAnchorRef={drawPileRef}
                onPlayCard={(instanceId) => {
                  if (battle.status !== 'player-turn') {
                    return;
                  }

                  playCard(instanceId);
                }}
              />
            </div>

            <div className="absolute bottom-[42px] right-0 z-[5]">
              <div className="flex flex-col items-center gap-4">
                {battle.status === 'player-turn' ? (
                  <Button onClick={endTurn} size="lg" variant="outline">
                    End Turn
                  </Button>
                ) : null}
                {battle.status === 'victory' && result?.result === 'victory' ? (
                  <Button onClick={() => navigate('/run/end')} size="lg">
                    Finish Run
                  </Button>
                ) : null}
                {battle.status === 'defeat' ? (
                  <Button onClick={() => navigate('/run/end')} size="lg" variant="destructive">
                    View Run Result
                  </Button>
                ) : null}
                <div ref={discardPileRef}>
                  <PileToken
                    count={battle.discardPile.length}
                    imagePath="/assets/ui/discard-pile-placeholder.svg"
                    label="Discard Pile"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {battle.wishChoices.length > 0 ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6">
          <Card className="w-full max-w-[640px] p-6">
            <div className="flex flex-col items-center gap-6">
              <h3 className="text-xl font-semibold">Wish — Choose a card</h3>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {battle.wishChoices.map((card) => (
                  <Button
                    key={card.id}
                    onClick={() => resolveWish(card.id)}
                    size="lg"
                    variant="outline"
                  >
                    {card.title}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
