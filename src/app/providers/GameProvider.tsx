import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { manaTypes, type CardDefinition, type ManaPool, type ManaType } from '@/entities/cards/types';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';
import { charactersById, type CharacterDefinition, type CharacterId } from '@/shared/content/characters';
import { cardsById, characterStarterDeckIds, starterDeckIds } from '@/shared/content/cards';
import {
  destinationDefinitions,
  getRandomDestinations,
  type DestinationDefinition,
  type DestinationType,
} from '@/shared/content/destinations';
import { createSkeletonEnemy, type EnemyState } from '@/shared/content/enemies';
import { getRandomMysteryEvent, type MysteryEventState } from '@/shared/content/mysteries';

type CardInstance = {
  instanceId: string;
  cardId: CardDefinition['id'];
};

type PlayerState = {
  armor: number;
  block: number;
  characterId: CharacterId;
  forge: number;
  gold: number;
  health: number;
  mana: ManaPool;
  maxHealth: number;
  maxMana: ManaPool;
};

export type BattleState = {
  battleIndex: number;
  discardPile: CardInstance[];
  drawPile: CardInstance[];
  enemy: EnemyState;
  hand: CardInstance[];
  log: string[];
  status: 'player-turn' | 'victory' | 'defeat';
  turn: number;
  variant: BattleVariant;
  wishChoices: CardDefinition[];
  extraTurn: boolean;
};

export type ShopOffer = {
  cardId: CardDefinition['id'];
  cost: number;
};

type RunResult = {
  result: 'victory' | 'defeat';
  summary: string;
};

type RunState = {
  battle: BattleState | null;
  battleWins: number;
  currentCharacter: CharacterDefinition | null;
  deckCardIds: CardDefinition['id'][];
  destinationChoices: DestinationDefinition[];
  lastDestinationOutcome: string | null;
  mysteryEvent: MysteryEventState | null;
  player: PlayerState | null;
  result: RunResult | null;
  roomsVisited: number;
  runEndUnlockedCardIds: CardDefinition['id'][];
  rewardGoldAmount: number;
  rewardChoices: CardDefinition[];
  shopOffers: ShopOffer[];
  shopRefreshAvailable: boolean;
};

type ProgressState = {
  unlockedCardIds: CardDefinition['id'][];
  unlockedCharacterIds: CharacterId[];
};

type GameContextValue = {
  allCards: CardDefinition[];
  battle: BattleState | null;
  battleWins: number;
  beginRun: (characterId: CharacterId) => void;
  claimBattleReward: (cardId: CardDefinition['id']) => void;
  currentCharacter: CharacterDefinition | null;
  deckCardIds: CardDefinition['id'][];
  destinationChoices: DestinationDefinition[];
  destinationDefinitions: Record<DestinationType, DestinationDefinition>;
  buyShopOffer: (cardId: CardDefinition['id']) => void;
  continueMysteryEvent: () => void;
  enterCampfire: () => void;
  endRunEarly: () => void;
  endTurn: () => void;
  lastDestinationOutcome: string | null;
  leaveMerchantShop: () => void;
  mysteryEvent: MysteryEventState | null;
  openMysteryEvent: () => void;
  playCard: (instanceId: string) => void;
  player: PlayerState | null;
  refreshShopOffers: () => void;
  resolveWish: (cardId: CardDefinition['id']) => void;
  restAtCampfire: () => void;
  resetRun: () => void;
  resolveDestination: (destinationType: DestinationType) => void;
  result: RunResult | null;
  roomsVisited: number;
  runEndUnlockedCards: CardDefinition[];
  rewardGoldAmount: number;
  rewardChoices: CardDefinition[];
  skipBattleReward: () => void;
  shopOffers: ShopOffer[];
  shopRefreshAvailable: boolean;
  skipCombatDevMode: () => void;
  unlockedCardIds: CardDefinition['id'][];
  unlockedCharacterIds: CharacterId[];
};

type BattleVariant = 'elite' | 'normal';

const FINAL_BATTLE_COUNT = 3;

const initialRunState: RunState = {
  battle: null,
  battleWins: 0,
  currentCharacter: null,
  deckCardIds: [],
  destinationChoices: [],
  lastDestinationOutcome: null,
  mysteryEvent: null,
  player: null,
  result: null,
  roomsVisited: 0,
  runEndUnlockedCardIds: [],
  rewardGoldAmount: 0,
  rewardChoices: [],
  shopOffers: [],
  shopRefreshAvailable: false,
};

const defaultProgressState: ProgressState = {
  unlockedCardIds: [...characterStarterDeckIds.knight],
  unlockedCharacterIds: ['knight'],
};

const GameContext = createContext<GameContextValue | null>(null);

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function shouldUseOrderedDeck() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem('alchemy-test-deck') === 'ordered';
}

function getTestDeckOverride() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem('alchemy-test-deck-card-ids');

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const cardIds = parsed.filter(
      (value): value is CardDefinition['id'] => typeof value === 'string' && Boolean(cardsById[value]),
    );

    return cardIds.length > 0 ? cardIds : null;
  } catch {
    return null;
  }
}

function instantiateDeck(cardIds: readonly CardDefinition['id'][] = starterDeckIds) {
  return cardIds.map((cardId, index) => ({
    instanceId: `${cardId}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    cardId,
  }));
}

function drawCards(drawPile: CardInstance[], discardPile: CardInstance[], count: number) {
  const nextHand: CardInstance[] = [];
  let nextDrawPile = [...drawPile];
  let nextDiscardPile = [...discardPile];

  while (nextHand.length < count) {
    if (nextDrawPile.length === 0) {
      if (nextDiscardPile.length === 0) {
        break;
      }

      nextDrawPile = shuffle(nextDiscardPile);
      nextDiscardPile = [];
    }

    const nextCard = nextDrawPile.shift();

    if (!nextCard) {
      break;
    }

    nextHand.push(nextCard);
  }

  return {
    discardPile: nextDiscardPile,
    drawPile: nextDrawPile,
    hand: nextHand,
  };
}

function applyDamage(targetHealth: number, targetBlock: number, incomingDamage: number) {
  const absorbed = Math.min(targetBlock, incomingDamage);
  const remainingDamage = incomingDamage - absorbed;

  return {
    block: targetBlock - absorbed,
    health: Math.max(0, targetHealth - remainingDamage),
  };
}

function hasPlayableCard(hand: CardInstance[], mana: ManaPool) {
  return hand.some((entry) => hasManaForCard(mana, cardsById[entry.cardId]));
}

function getRandomRewardCards(unlockedCardIds: readonly CardDefinition['id'][], count = 3) {
  return shuffle(unlockedCardIds.map((cardId) => cardsById[cardId]).filter(Boolean)).slice(0, count);
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomGoldReward(variant: BattleVariant) {
  return variant === 'elite' ? getRandomInt(30, 50) : getRandomInt(15, 30);
}

function getRandomShopOffers(unlockedCardIds: readonly CardDefinition['id'][], count = 3): ShopOffer[] {
  return shuffle(unlockedCardIds.map((cardId) => cardsById[cardId]).filter(Boolean))
    .slice(0, count)
    .map((card) => ({
      cardId: card.id,
      cost: 20,
    }));
}

function getNextUnlockedCards(unlockedCardIds: readonly CardDefinition['id'][], count = 3) {
  return shuffle(Object.values(cardsById).filter((card) => !unlockedCardIds.includes(card.id)))
    .slice(0, count)
    .map((card) => card.id);
}

function resolveBattleVictory(
  current: RunState,
  nextPlayer: PlayerState,
  nextBattle: BattleState,
  unlockedCardIds: readonly CardDefinition['id'][],
): RunState {
  const nextBattleWins = current.battleWins + 1;
  const rewardGoldAmount = getRandomGoldReward(nextBattle.variant);
  const rewardedPlayer = {
    ...nextPlayer,
    gold: nextPlayer.gold + rewardGoldAmount,
    mana: createEmptyManaPool(),
    maxMana: createEmptyManaPool(),
  };
  const nextResult =
    nextBattleWins >= FINAL_BATTLE_COUNT
      ? {
          result: 'victory' as const,
          summary: `The ${current.currentCharacter?.name ?? 'party'} survived ${FINAL_BATTLE_COUNT} skeleton encounters and cleared the first expedition route.`,
        }
      : current.result;

  return {
    ...current,
    battle: {
      ...nextBattle,
      status: 'victory',
    },
    battleWins: nextBattleWins,
    destinationChoices: nextBattleWins < FINAL_BATTLE_COUNT ? getRandomDestinations() : [],
    player: rewardedPlayer,
    rewardGoldAmount,
    result: nextResult,
    rewardChoices: nextBattleWins < FINAL_BATTLE_COUNT ? getRandomRewardCards(unlockedCardIds) : [],
    shopOffers: [],
  };
}

function resolveEnemyTurn(
  battle: BattleState,
  player: PlayerState,
  currentCharacter: CharacterDefinition | null,
  prefixLog: string[] = [],
) {
  const statusLog: string[] = [];
  let enemy = { ...battle.enemy, statusEffects: { ...battle.enemy.statusEffects } };
  let currentPlayer = { ...player };

  // Process bleed (deals damage, then disappears)
  if (enemy.statusEffects.bleed > 0) {
    const bleedDamage = enemy.statusEffects.bleed;
    enemy.health = Math.max(0, enemy.health - bleedDamage);
    if (enemy.statusEffects.bleedLeech > 0) {
      currentPlayer.health = Math.min(currentPlayer.maxHealth, currentPlayer.health + enemy.statusEffects.bleedLeech);
      enemy.statusEffects.bleedLeech = 0;
    }
    enemy.statusEffects.bleed = 0;
    statusLog.push(`${enemy.name} took ${bleedDamage} Bleed damage.`);
  }

  // Process burn (deals damage, then halves)
  if (enemy.statusEffects.burn > 0) {
    const burnDamage = enemy.statusEffects.burn;
    enemy.health = Math.max(0, enemy.health - burnDamage);
    enemy.statusEffects.burn = Math.floor(burnDamage / 2);
    statusLog.push(`${enemy.name} took ${burnDamage} Burn damage.`);
  }

  // Process poison (deals damage, then reduces by 1)
  if (enemy.statusEffects.poison > 0) {
    const poisonDamage = enemy.statusEffects.poison;
    enemy.health = Math.max(0, enemy.health - poisonDamage);
    enemy.statusEffects.poison = Math.max(0, poisonDamage - 1);
    statusLog.push(`${enemy.name} took ${poisonDamage} Poison damage.`);
  }

  // Check if enemy died from status effects
  if (enemy.health <= 0) {
    const discardedHand = [...battle.discardPile, ...battle.hand];
    const log = [...statusLog, ...prefixLog, ...battle.log].slice(0, 8);

    return {
      battle: {
        ...battle,
        discardPile: discardedHand,
        enemy,
        hand: [],
        log,
        status: 'victory' as const,
        wishChoices: [],
        extraTurn: false,
      },
      player: currentPlayer,
      result: null,
    };
  }

  // Handle skip turn from freeze
  if (enemy.statusEffects.skipTurn) {
    enemy.statusEffects.skipTurn = false;
    const discardedHand = [...battle.discardPile, ...battle.hand];
    const nextDraw = drawCards(battle.drawPile, discardedHand, 5);
    const log = [`${enemy.name} is frozen and loses their turn.`, ...statusLog, ...prefixLog, ...battle.log].slice(0, 8);

    return {
      battle: {
        ...battle,
        discardPile: nextDraw.discardPile,
        drawPile: nextDraw.drawPile,
        enemy,
        hand: nextDraw.hand,
        log,
        turn: battle.turn + 1,
        wishChoices: [],
        extraTurn: false,
      },
      player: {
        ...currentPlayer,
        block: Math.floor(currentPlayer.block / 2),
        mana: restoreManaToMax(currentPlayer.maxMana),
      },
      result: null,
    };
  }

  const enemyDamage = Math.max(0, enemy.intent.damage - currentPlayer.armor);
  const absorbedByArmor = Math.min(currentPlayer.armor, enemy.intent.damage);
  const discardedHand = [...battle.discardPile, ...battle.hand];
  currentPlayer.armor = Math.max(0, currentPlayer.armor - absorbedByArmor);
  const afterHit = applyDamage(currentPlayer.health, currentPlayer.block, Math.max(0, enemy.intent.damage - absorbedByArmor));
  const log = [`${enemy.name} dealt ${enemyDamage} damage.`, ...statusLog, ...prefixLog, ...battle.log].slice(0, 8);

  if (afterHit.health <= 0) {
    return {
      battle: {
        ...battle,
        discardPile: discardedHand,
        enemy,
        hand: [],
        log,
        status: 'defeat' as const,
        wishChoices: [],
        extraTurn: false,
      },
      player: {
        ...currentPlayer,
        block: afterHit.block,
        health: 0,
        mana: createEmptyManaPool(),
      },
      result: {
        result: 'defeat' as const,
        summary: `${currentCharacter?.name ?? 'The party'} fell on battle ${battle.battleIndex} against ${enemy.name}.`,
      },
    };
  }

  const nextDraw = drawCards(battle.drawPile, discardedHand, 5);

  return {
    battle: {
      ...battle,
      discardPile: nextDraw.discardPile,
      drawPile: nextDraw.drawPile,
      enemy,
      hand: nextDraw.hand,
      log,
      turn: battle.turn + 1,
      wishChoices: [],
      extraTurn: false,
    },
    player: {
      ...currentPlayer,
      block: Math.floor(afterHit.block / 2),
      health: afterHit.health,
      mana: restoreManaToMax(currentPlayer.maxMana),
    },
    result: null,
  };
}

function startBattleState(battleIndex: number, nextPlayer: PlayerState, deckCardIds: readonly CardDefinition['id'][], variant: BattleVariant = 'normal') {
  const baseEnemy = createSkeletonEnemy(battleIndex);
  const enemy: EnemyState =
    variant === 'elite'
      ? {
          ...baseEnemy,
          health: baseEnemy.health + 12,
          intent: {
            ...baseEnemy.intent,
            damage: baseEnemy.intent.damage + 2,
            label: `Heavy ${baseEnemy.intent.label}`,
          },
          maxHealth: baseEnemy.maxHealth + 12,
          name: `Elite ${baseEnemy.name}`,
        }
      : baseEnemy;
  const openingDeck = shouldUseOrderedDeck() ? instantiateDeck(deckCardIds) : shuffle(instantiateDeck(deckCardIds));
  const firstDraw = drawCards(openingDeck, [], 5);
  const startingManaPool = createStartingManaPool(charactersById[nextPlayer.characterId]?.maxMana ?? 3);

  return {
    battle: {
      battleIndex,
      discardPile: firstDraw.discardPile,
      drawPile: firstDraw.drawPile,
      enemy,
      hand: firstDraw.hand,
      log: [
        `Battle ${battleIndex} begins against ${enemy.name}.`,
        `${enemy.name} intends to ${enemy.intent.label.toLowerCase()}.`,
      ],
      status: 'player-turn' as const,
      turn: 1,
      variant,
      wishChoices: [],
      extraTurn: false,
    },
    player: {
      ...nextPlayer,
      armor: 0,
      block: 0,
      forge: 0,
      mana: startingManaPool,
      maxMana: startingManaPool,
    },
  };
}

type GameProviderProps = {
  children: ReactNode;
};

export function GameProvider({ children }: GameProviderProps) {
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [progressState, setProgressState] = useLocalStorage<ProgressState>({
    defaultValue: defaultProgressState,
    key: 'alchemy-progression',
  });

  const finalizeCompletedRun = useCallback(
    (nextState: RunState) => {
      if (!nextState.result) {
        return nextState;
      }

      const unlockedCardIds = nextState.roomsVisited >= 3 ? getNextUnlockedCards(progressState.unlockedCardIds, 3) : [];

      if (unlockedCardIds.length > 0) {
        setProgressState({
          ...progressState,
          unlockedCardIds: [...progressState.unlockedCardIds, ...unlockedCardIds],
        });
      }

      return {
        ...nextState,
        runEndUnlockedCardIds: unlockedCardIds,
      };
    },
    [progressState, setProgressState],
  );

  const beginRun = useCallback((characterId: CharacterId) => {
    if (!progressState.unlockedCharacterIds.includes(characterId)) {
      return;
    }

    const character = charactersById[characterId];
    const player: PlayerState = {
      armor: 0,
      block: 0,
      characterId,
      forge: 0,
      gold: 0,
      health: character.maxHealth,
      mana: createEmptyManaPool(),
      maxHealth: character.maxHealth,
      maxMana: createEmptyManaPool(),
    };
    const openingDeckIds = [...(getTestDeckOverride() ?? characterStarterDeckIds[characterId] ?? starterDeckIds)];
    const openingBattle = startBattleState(1, player, openingDeckIds);

    setRunState({
      battle: openingBattle.battle,
      battleWins: 0,
      currentCharacter: character,
      deckCardIds: openingDeckIds,
      destinationChoices: [],
      lastDestinationOutcome: null,
      mysteryEvent: null,
      player: openingBattle.player,
      result: null,
      roomsVisited: 1,
      runEndUnlockedCardIds: [],
      rewardGoldAmount: 0,
      rewardChoices: [],
      shopOffers: [],
      shopRefreshAvailable: false,
    });
  }, [progressState.unlockedCharacterIds]);

  const playCard = useCallback((instanceId: string) => {
    setRunState((current) => {
      if (!current.battle || !current.player || current.battle.status !== 'player-turn') {
        return current;
      }

      const cardInstance = current.battle.hand.find((entry) => entry.instanceId === instanceId);

      if (!cardInstance) {
        return current;
      }

      const card = cardsById[cardInstance.cardId];

      if (!hasManaForCard(current.player.mana, card)) {
        return current;
      }

      let nextPlayer = {
        ...current.player,
        mana: cloneManaPool(current.player.mana),
        maxMana: cloneManaPool(current.player.maxMana),
      };
      nextPlayer.mana.arcane -= 1;
      let nextEnemy = { ...current.battle.enemy, statusEffects: { ...current.battle.enemy.statusEffects } };
      let actionLog = `${card.title} was played.`;
      let leechHeal = 0;
      let consumeCard = false;
      let extraTurn = current.battle.extraTurn;
      let wishChoices: CardDefinition[] = current.battle.wishChoices;
      let nextDeckCardIds = current.deckCardIds;

      switch (card.id) {
        case 'slash': {
          const damage = 4 + nextPlayer.forge;
          nextEnemy.health = Math.max(0, nextEnemy.health - damage);
          actionLog = `${card.title} dealt ${damage} Physical damage.`;
          break;
        }
        case 'bash': {
          const stunDamage = 3;
          nextEnemy.health = Math.max(0, nextEnemy.health - stunDamage);
          nextEnemy.statusEffects.stun += stunDamage;
          if (nextEnemy.statusEffects.stun > nextEnemy.health / 2) {
            nextEnemy.statusEffects.skipTurn = true;
            nextEnemy.statusEffects.stun = 0;
            actionLog = `${card.title} dealt ${stunDamage} Stun damage. ${nextEnemy.name} is stunned!`;
          } else {
            actionLog = `${card.title} dealt ${stunDamage} Stun damage.`;
          }
          break;
        }
        case 'block':
          nextPlayer.block += 6;
          actionLog = `${card.title} granted 6 Block.`;
          break;
        case 'anvil':
          nextPlayer.forge += 1;
          actionLog = `${card.title} granted 1 Forge.`;
          break;
        case 'plate-mail':
          nextPlayer.armor += 1;
          actionLog = `${card.title} granted 1 Armor.`;
          break;
        case 'apple':
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 4);
          actionLog = `${card.title} restored 4 Health.`;
          break;
        case 'bread':
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 6);
          actionLog = `${card.title} restored 6 Health.`;
          break;
        case 'stab': {
          const damage = 4;
          nextEnemy.health = Math.max(0, nextEnemy.health - damage);
          actionLog = `${card.title} dealt 2 damage twice.`;
          break;
        }
        case 'meteor': {
          const burnAmount = 15;
          nextEnemy.health = Math.max(0, nextEnemy.health - burnAmount);
          nextEnemy.statusEffects.burn += burnAmount;
          const lostCrystal = removeRandomManaCrystal(nextPlayer.mana, nextPlayer.maxMana);
          nextPlayer.mana = lostCrystal.mana;
          nextPlayer.maxMana = lostCrystal.maxMana;
          actionLog = lostCrystal.lostType
            ? `${card.title} dealt ${burnAmount} Burn damage and shattered a Mana Crystal.`
            : `${card.title} dealt ${burnAmount} Burn damage.`;
          break;
        }
        case 'steal':
          nextPlayer.gold += 4;
          actionLog = `${card.title} stole 4 Gold.`;
          break;
        case 'blessed-aegis': {
          const holyDamage = nextPlayer.block;
          nextEnemy.health = Math.max(0, nextEnemy.health - holyDamage);
          actionLog = `${card.title} dealt ${holyDamage} Holy damage.`;
          break;
        }
        case 'wish': {
          wishChoices = getRandomRewardCards(progressState.unlockedCardIds, 3);
          actionLog = `${card.title}: Choose a card to add to your hand.`;
          break;
        }
        case 'cleanse': {
          // Remove first ailment status (burn, poison, bleed — as player ailments not yet implemented, no-op with log)
          actionLog = `${card.title} removed an Ailment.`;
          break;
        }
        case 'heal':
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 6);
          actionLog = `${card.title} restored 6 Health.`;
          break;
        case 'haste':
          extraTurn = true;
          consumeCard = true;
          actionLog = `${card.title}: Take an extra turn after this one.`;
          break;
        case 'poison-dagger': {
          const poisonAmount = 2;
          nextEnemy.health = Math.max(0, nextEnemy.health - poisonAmount);
          nextEnemy.statusEffects.poison += poisonAmount;
          actionLog = `${card.title} dealt ${poisonAmount} Poison damage.`;
          break;
        }
        case 'fireball': {
          const burnAmount = 3;
          nextEnemy.health = Math.max(0, nextEnemy.health - burnAmount);
          nextEnemy.statusEffects.burn += burnAmount;
          actionLog = `${card.title} dealt ${burnAmount} Burn damage.`;
          break;
        }
        case 'fangs': {
          const bleedDamage = 2;
          nextEnemy.health = Math.max(0, nextEnemy.health - bleedDamage);
          nextEnemy.statusEffects.bleed += bleedDamage * 2;
          nextEnemy.statusEffects.bleedLeech += bleedDamage * 2;
          leechHeal += bleedDamage;
          actionLog = `${card.title} dealt ${bleedDamage} Bleed damage (${bleedDamage * 2} follow-up).`;
          break;
        }
        case 'frostbolt': {
          const freezeDamage = 3;
          nextEnemy.health = Math.max(0, nextEnemy.health - freezeDamage);
          nextEnemy.statusEffects.freeze += freezeDamage;
          if (nextEnemy.statusEffects.freeze >= nextEnemy.health / 2) {
            nextEnemy.statusEffects.skipTurn = true;
            nextEnemy.statusEffects.freeze = 0;
            actionLog = `${card.title} dealt ${freezeDamage} Freeze damage. ${nextEnemy.name} is frozen!`;
          } else {
            actionLog = `${card.title} dealt ${freezeDamage} Freeze damage.`;
          }
          break;
        }
        case 'health-potion':
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 8);
          consumeCard = true;
          actionLog = `${card.title} restored 8 Health.`;
          break;
        case 'mana-berries':
          nextPlayer.mana = restoreRandomMana(nextPlayer.mana, nextPlayer.maxMana, 2);
          consumeCard = true;
          actionLog = `${card.title} restored 2 Mana.`;
          break;
        case 'mana-crystals': {
          nextPlayer.maxMana = addManaCrystal(nextPlayer.maxMana, 'arcane');
          nextPlayer.mana = addManaCrystal(nextPlayer.mana, 'arcane');
          actionLog = `${card.title} granted 1 Mana Crystal.`;
          break;
        }
        case 'mana-potion':
          nextPlayer.mana = restoreRandomMana(nextPlayer.mana, nextPlayer.maxMana, 2);
          consumeCard = true;
          actionLog = `${card.title} restored 2 Mana.`;
          break;
        case 'panacea-potion':
          // Remove all player ailments (placeholder — player ailments not yet tracked)
          consumeCard = true;
          actionLog = `${card.title} removed all Ailments.`;
          break;
        default:
          break;
      }

      // Apply leech healing
      if (leechHeal > 0) {
        nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + leechHeal);
      }

      // Handle consume: remove card from draw/discard for this battle
      let nextHandAfterPlay = current.battle.hand.filter((entry) => entry.instanceId !== instanceId);
      let nextDiscardPile = consumeCard
        ? current.battle.discardPile
        : [...current.battle.discardPile, cardInstance];
      let nextDrawPile = current.battle.drawPile;
      nextDeckCardIds = current.deckCardIds;

      // Handle wish: pause for card selection (don't move to discard yet, card stays consumed-like)
      if (wishChoices.length > 0) {
        const nextBattle: BattleState = {
          ...current.battle,
          discardPile: nextDiscardPile,
          drawPile: nextDrawPile,
          enemy: nextEnemy,
          hand: nextHandAfterPlay,
          log: [actionLog, ...current.battle.log].slice(0, 8),
          status: current.battle.status,
          wishChoices,
          extraTurn,
        };

        return {
          ...current,
          battle: nextBattle,
          deckCardIds: nextDeckCardIds,
          player: nextPlayer,
        };
      }

      const nextBattle: BattleState = {
        ...current.battle,
        discardPile: nextDiscardPile,
        drawPile: nextDrawPile,
        enemy: nextEnemy,
        hand: nextHandAfterPlay,
        log: [actionLog, ...current.battle.log].slice(0, 8),
        status: current.battle.status,
        wishChoices: [],
        extraTurn,
      };

      if (nextEnemy.health === 0) {
        const victoryState = resolveBattleVictory(current, nextPlayer, nextBattle, progressState.unlockedCardIds);

        return victoryState.result ? finalizeCompletedRun(victoryState) : victoryState;
      }

      if (nextEnemy.health > 0 && !hasPlayableCard(nextHandAfterPlay, nextPlayer.mana)) {
        // If haste was played, grant extra turn before enemy turn
        if (extraTurn) {
          const nextDraw = drawCards(nextBattle.drawPile, nextBattle.discardPile, 5);

          return {
            ...current,
            battle: {
              ...nextBattle,
              discardPile: nextDraw.discardPile,
              drawPile: nextDraw.drawPile,
              hand: nextDraw.hand,
              turn: nextBattle.turn + 1,
              extraTurn: false,
              log: ['Haste: Extra turn begins!', ...nextBattle.log].slice(0, 8),
            },
            deckCardIds: nextDeckCardIds,
            player: { ...nextPlayer, mana: restoreManaToMax(nextPlayer.maxMana) },
          };
        }

        const resolvedTurn = resolveEnemyTurn(nextBattle, nextPlayer, current.currentCharacter, [
          'No playable cards remain. Turn ended automatically.',
        ]);

        if (resolvedTurn.battle.status === 'victory') {
          const victoryState = resolveBattleVictory(current, resolvedTurn.player, resolvedTurn.battle, progressState.unlockedCardIds);

          return victoryState.result ? finalizeCompletedRun(victoryState) : victoryState;
        }

        return {
          ...current,
          battle: resolvedTurn.battle,
          battleWins: current.battleWins,
          deckCardIds: nextDeckCardIds,
          player: resolvedTurn.player,
          result: resolvedTurn.result ?? current.result,
        };
      }

      const nextState = {
        ...current,
        battle: nextBattle,
        deckCardIds: nextDeckCardIds,
        player: nextPlayer,
        runEndUnlockedCardIds: [],
        rewardGoldAmount: 0,
      };

      return nextState.result ? finalizeCompletedRun(nextState) : nextState;
    });
  }, [finalizeCompletedRun, progressState.unlockedCardIds]);

  const endTurn = useCallback(() => {
    setRunState((current) => {
      if (!current.battle || !current.player || current.battle.status !== 'player-turn') {
        return current;
      }

      // If haste granted an extra turn, start the next player turn instead
      if (current.battle.extraTurn) {
        const discardedHand = [...current.battle.discardPile, ...current.battle.hand];
        const nextDraw = drawCards(current.battle.drawPile, discardedHand, 5);

        return {
          ...current,
          battle: {
            ...current.battle,
            discardPile: nextDraw.discardPile,
            drawPile: nextDraw.drawPile,
            hand: nextDraw.hand,
            turn: current.battle.turn + 1,
            extraTurn: false,
            log: ['Haste: Extra turn begins!', ...current.battle.log].slice(0, 8),
          },
          player: { ...current.player, mana: restoreManaToMax(current.player.maxMana) },
        };
      }

      const resolvedTurn = resolveEnemyTurn(current.battle, current.player, current.currentCharacter);

      if (resolvedTurn.battle.status === 'victory') {
        const victoryState = resolveBattleVictory(current, resolvedTurn.player, resolvedTurn.battle, progressState.unlockedCardIds);

        return victoryState.result ? finalizeCompletedRun(victoryState) : victoryState;
      }

      const nextState = {
        ...current,
        battle: resolvedTurn.battle,
        player: resolvedTurn.player,
        result: resolvedTurn.result ?? current.result,
      };

      return resolvedTurn.result ? finalizeCompletedRun(nextState) : nextState;
    });
  }, [finalizeCompletedRun, progressState.unlockedCardIds]);

  const claimBattleReward = useCallback((cardId: CardDefinition['id']) => {
    setRunState((current) => {
      if (!current.rewardChoices.some((card) => card.id === cardId)) {
        return current;
      }

      return {
        ...current,
        deckCardIds: [...current.deckCardIds, cardId],
        rewardGoldAmount: 0,
        rewardChoices: [],
      };
    });
  }, []);

  const resolveWish = useCallback((cardId: CardDefinition['id']) => {
    setRunState((current) => {
      if (!current.battle || !current.player) {
        return current;
      }

      const chosenCard = current.battle.wishChoices.find((card) => card.id === cardId);

      if (!chosenCard) {
        return current;
      }

      const newCardInstance: CardInstance = {
        instanceId: `${cardId}-wish-${Math.random().toString(36).slice(2, 9)}`,
        cardId,
      };

      return {
        ...current,
        battle: {
          ...current.battle,
          hand: [...current.battle.hand, newCardInstance],
          log: [`Wish: ${chosenCard.title} added to hand.`, ...current.battle.log].slice(0, 8),
          wishChoices: [],
        },
      };
    });
  }, []);

  const skipBattleReward = useCallback(() => {
    setRunState((current) => ({
      ...current,
      rewardGoldAmount: 0,
      rewardChoices: [],
    }));
  }, []);

  const skipCombatDevMode = useCallback(() => {
    setRunState((current) => {
      if (!current.battle || !current.player || current.result) {
        return current;
      }

      const nextBattle: BattleState = {
        ...current.battle,
        enemy: {
          ...current.battle.enemy,
          health: 0,
        },
        log: ['Dev mode skip: encounter resolved instantly.', ...current.battle.log].slice(0, 8),
      };

      const victoryState = resolveBattleVictory(current, current.player, nextBattle, progressState.unlockedCardIds);

      return victoryState.result ? finalizeCompletedRun(victoryState) : victoryState;
    });
  }, [finalizeCompletedRun, progressState.unlockedCardIds]);

  const endRunEarly = useCallback(() => {
    setRunState((current) => {
      if (!current.currentCharacter || !current.player || current.result) {
        return current;
      }

      return finalizeCompletedRun({
        ...current,
        battle: current.battle
          ? {
              ...current.battle,
              log: ['Run ended from the screen menu.', ...current.battle.log].slice(0, 8),
              status: 'defeat',
            }
          : null,
        result: {
          result: 'defeat',
          summary: `${current.currentCharacter.name} withdrew after ${current.roomsVisited} rooms.`,
        },
      });
    });
  }, [finalizeCompletedRun]);

  const refreshShopOffers = useCallback(() => {
    setRunState((current) => {
      if (!current.player || !current.shopRefreshAvailable || current.player.gold < 40) {
        return current;
      }

      return {
        ...current,
        player: {
          ...current.player,
          gold: current.player.gold - 40,
        },
        shopOffers: getRandomShopOffers(progressState.unlockedCardIds),
        shopRefreshAvailable: false,
      };
    });
  }, [progressState.unlockedCardIds]);

  const buyShopOffer = useCallback((cardId: CardDefinition['id']) => {
    setRunState((current) => {
      if (!current.player) {
        return current;
      }

      const offer = current.shopOffers.find((entry) => entry.cardId === cardId);

      if (!offer || offer.cost > current.player.gold) {
        return current;
      }

      return {
        ...current,
        deckCardIds: [...current.deckCardIds, cardId],
        player: {
          ...current.player,
          gold: current.player.gold - offer.cost,
        },
        shopOffers: current.shopOffers.filter((entry) => entry.cardId !== cardId),
      };
    });
  }, []);

  const leaveMerchantShop = useCallback(() => {
    setRunState((current) => ({
      ...current,
      destinationChoices: getRandomDestinations(),
      lastDestinationOutcome: 'You leave the merchant and chart a fresh route forward.',
      mysteryEvent: null,
      shopOffers: [],
      shopRefreshAvailable: false,
    }));
  }, []);

  const openMysteryEvent = useCallback(() => {
    setRunState((current) => {
      if (!current.player || !current.mysteryEvent || current.mysteryEvent.status === 'opened') {
        return current;
      }

      const goldFound = getRandomInt(20, 100);

      return {
        ...current,
        lastDestinationOutcome: `You crack open the chest and discover ${goldFound} Gold.`,
        mysteryEvent: {
          ...current.mysteryEvent,
          goldFound,
          status: 'opened',
        },
        player: {
          ...current.player,
          gold: current.player.gold + goldFound,
        },
      };
    });
  }, []);

  const continueMysteryEvent = useCallback(() => {
    setRunState((current) => {
      if (!current.mysteryEvent || current.mysteryEvent.status !== 'opened') {
        return current;
      }

      return {
        ...current,
        destinationChoices: getRandomDestinations(),
        mysteryEvent: null,
      };
    });
  }, []);

  const enterCampfire = useCallback(() => {
    setRunState((current) => {
      if (!current.player || current.result) {
        return current;
      }

      return {
        ...current,
        battle: null,
        destinationChoices: [],
        lastDestinationOutcome: 'You settle beside the campfire for a brief rest.',
        mysteryEvent: null,
        roomsVisited: current.roomsVisited + 1,
        rewardGoldAmount: 0,
        rewardChoices: [],
        shopOffers: [],
        shopRefreshAvailable: false,
      };
    });
  }, []);

  const restAtCampfire = useCallback(() => {
    setRunState((current) => {
      if (!current.player || current.result) {
        return current;
      }

      const restoreAmount = Math.max(1, Math.round(current.player.maxHealth * 0.3));
      const nextHealth = Math.min(current.player.maxHealth, current.player.health + restoreAmount);
      const restored = nextHealth - current.player.health;

      return {
        ...current,
        destinationChoices: getRandomDestinations(),
        lastDestinationOutcome:
          restored > 0
            ? `You rest at the campfire and restore ${restored} Health.`
            : 'You take a steady breath by the campfire and continue at full strength.',
        mysteryEvent: null,
        player: {
          ...current.player,
          health: nextHealth,
        },
        rewardGoldAmount: 0,
        rewardChoices: [],
        shopOffers: [],
        shopRefreshAvailable: false,
      };
    });
  }, []);

  const resolveDestination = useCallback((destinationType: DestinationType) => {
    setRunState((current) => {
      if (!current.player) {
        return current;
      }

      let nextPlayer = { ...current.player };
      let battleVariant: BattleVariant = 'normal';
      let openingArmorBonus = 0;
      let openingForgeBonus = 0;
      let outcome = destinationDefinitions[destinationType].summary;

      switch (destinationType) {
        case 'campfire':
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 12);
          outcome = 'You rest at the campfire and restore 12 Health.';
          break;
        case 'merchant-shop':
          return {
            ...current,
            battle: null,
            destinationChoices: [],
            lastDestinationOutcome: "You step into the merchant's stall.",
            mysteryEvent: null,
            player: nextPlayer,
            roomsVisited: current.roomsVisited + 1,
            rewardGoldAmount: 0,
            rewardChoices: [],
            shopOffers: getRandomShopOffers(progressState.unlockedCardIds),
            shopRefreshAvailable: true,
          };
        case 'mystery': {
          return {
            ...current,
            battle: null,
            destinationChoices: [],
            lastDestinationOutcome: 'A curious mystery waits to be uncovered.',
            mysteryEvent: getRandomMysteryEvent(),
            player: nextPlayer,
            roomsVisited: current.roomsVisited + 1,
            rewardGoldAmount: 0,
            rewardChoices: [],
            shopOffers: [],
            shopRefreshAvailable: false,
          };
        }
        case 'alchemists-hut':
          openingForgeBonus += 1;
          nextPlayer.health = Math.min(nextPlayer.maxHealth, nextPlayer.health + 4);
          outcome = "The alchemist reinforces your brew. Gain 1 Forge for the next battle and restore 4 Health.";
          break;
        case 'elite-combat':
          battleVariant = 'elite';
          outcome = 'You march into a harder elite encounter.';
          break;
        case 'normal-combat':
          outcome = 'You press forward immediately into another battle.';
          break;
        default:
          break;
      }

      const nextBattle = startBattleState(current.battleWins + 1, nextPlayer, current.deckCardIds, battleVariant);
      const battleReadyPlayer = {
        ...nextBattle.player,
        armor: nextBattle.player.armor + openingArmorBonus,
        forge: nextBattle.player.forge + openingForgeBonus,
      };

      return {
        ...current,
        battle: nextBattle.battle,
        destinationChoices: [],
        lastDestinationOutcome: outcome,
        mysteryEvent: null,
        player: battleReadyPlayer,
        roomsVisited: current.roomsVisited + 1,
        rewardGoldAmount: 0,
        rewardChoices: [],
        shopOffers: [],
        shopRefreshAvailable: false,
      };
    });
  }, [progressState.unlockedCardIds]);

  const resetRun = useCallback(() => {
    setRunState(initialRunState);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      allCards: Object.values(cardsById),
      battle: runState.battle,
      battleWins: runState.battleWins,
      beginRun,
      buyShopOffer,
      claimBattleReward,
      continueMysteryEvent,
      currentCharacter: runState.currentCharacter,
      deckCardIds: runState.deckCardIds,
      destinationChoices: runState.destinationChoices,
      destinationDefinitions,
      enterCampfire,
      endRunEarly,
      endTurn,
      lastDestinationOutcome: runState.lastDestinationOutcome,
      leaveMerchantShop,
      mysteryEvent: runState.mysteryEvent,
      openMysteryEvent,
      playCard,
      player: runState.player,
      refreshShopOffers,
      resolveWish,
      restAtCampfire,
      resetRun,
      resolveDestination,
      result: runState.result,
      roomsVisited: runState.roomsVisited,
      runEndUnlockedCards: runState.runEndUnlockedCardIds.map((cardId) => cardsById[cardId]).filter(Boolean),
      rewardGoldAmount: runState.rewardGoldAmount,
      rewardChoices: runState.rewardChoices,
      skipBattleReward,
      shopOffers: runState.shopOffers,
      shopRefreshAvailable: runState.shopRefreshAvailable,
      skipCombatDevMode,
      unlockedCardIds: progressState.unlockedCardIds,
      unlockedCharacterIds: progressState.unlockedCharacterIds,
    }),
    [beginRun, buyShopOffer, claimBattleReward, continueMysteryEvent, endRunEarly, endTurn, enterCampfire, leaveMerchantShop, openMysteryEvent, playCard, progressState.unlockedCardIds, progressState.unlockedCharacterIds, refreshShopOffers, resetRun, resolveDestination, resolveWish, restAtCampfire, runState, skipBattleReward, skipCombatDevMode],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }

  return context;
}

function createEmptyManaPool(): ManaPool {
  return Object.fromEntries(manaTypes.map((type) => [type, 0])) as ManaPool;
}

function cloneManaPool(pool: ManaPool): ManaPool {
  return { ...pool };
}

function getTotalMana(pool: ManaPool) {
  return manaTypes.reduce((total, type) => total + pool[type], 0);
}

function getRandomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createStartingManaPool(crystalCount: number): ManaPool {
  const nextPool = createEmptyManaPool();
  nextPool.arcane = Math.max(0, crystalCount);

  return nextPool;
}

function restoreManaToMax(maxMana: ManaPool): ManaPool {
  return cloneManaPool(maxMana);
}

function getMissingManaTypes(mana: ManaPool, maxMana: ManaPool) {
  const missingTypes: ManaType[] = [];

  for (const type of manaTypes) {
    const missingCount = Math.max(0, maxMana[type] - mana[type]);

    for (let index = 0; index < missingCount; index += 1) {
      missingTypes.push(type);
    }
  }

  return missingTypes;
}

function restoreRandomMana(mana: ManaPool, maxMana: ManaPool, amount: number): ManaPool {
  const nextMana = cloneManaPool(mana);

  for (let restoreIndex = 0; restoreIndex < amount; restoreIndex += 1) {
    const missingTypes = getMissingManaTypes(nextMana, maxMana);

    if (missingTypes.length === 0) {
      break;
    }

    const restoredType = getRandomItem(missingTypes);
    nextMana[restoredType] += 1;
  }

  return nextMana;
}

function addManaCrystal(mana: ManaPool, type: ManaType, amount = 1): ManaPool {
  const nextMana = cloneManaPool(mana);
  nextMana[type] += amount;

  return nextMana;
}

function removeRandomManaCrystal(mana: ManaPool, maxMana: ManaPool) {
  const occupiedTypes = manaTypes.filter((type) => maxMana[type] > 0);

  if (occupiedTypes.length === 0) {
    return {
      lostType: null,
      mana: cloneManaPool(mana),
      maxMana: cloneManaPool(maxMana),
    };
  }

  const lostType = getRandomItem(occupiedTypes);
  const nextMana = cloneManaPool(mana);
  const nextMaxMana = cloneManaPool(maxMana);

  nextMaxMana[lostType] -= 1;
  nextMana[lostType] = Math.min(nextMana[lostType], nextMaxMana[lostType]);

  return {
    lostType,
    mana: nextMana,
    maxMana: nextMaxMana,
  };
}

function hasManaForCard(mana: ManaPool, _card: CardDefinition) {
  return mana.arcane > 0;
}