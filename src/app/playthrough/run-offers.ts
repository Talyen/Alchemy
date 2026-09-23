import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
  readActiveRunScreen,
} from "@/features/alchemy/shared/stores/run-reads";
import { commitCardPlay, commitBattleWish } from "@/features/alchemy/shared/stores/battle-commands";
import { commitEndTurn } from "@/features/alchemy/run-loop/battle/battle-session";
import { PLAYABLE_HAND_OPTIONS } from "@/features/alchemy/run-loop/battle/playable-hand";
import { cardSlotKeyOf, gearSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import {
  canPlayCard,
  isPlayerDefeated,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  type BattleSnapshot,
  type CombatTextEvent,
} from "@/lib/battle";
import { getRewardChoiceId } from "@/lib/active-run-session";
import { characters, type BattleCard } from "@/lib/game-data";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { canDescendFromLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import type { CareerConfig, PlayerChoice } from "./types";
import type { createPlaythroughController } from "./controller";
import { scoreArchetypeRemoval, scoreStrategyCard } from "./archetype-policy";
import type { OfferChoice } from "./choice-catalog";

interface RunOfferContext {
  config: CareerConfig;
  controller: ReturnType<typeof createPlaythroughController>;
  offer: OfferChoice;
  choices: PlayerChoice[];
  recordBattle: (state: BattleSnapshot, texts: CombatTextEvent[], card?: string) => void;
}

export function offerRunChoices({ config, controller, offer, choices, recordBattle }: RunOfferContext): void {
  const { flow, shop, labyrinth, nodes } = controller;
  const run = readActiveRun();
  const session = readRunSession();
  const profile = readRunProfile();
  const screen = readActiveRunScreen();
  const affinity = (card: BattleCard) => scoreStrategyCard(config.policy, config.hero, card, run.runDeck);
  const combatScore = (card: BattleCard, state: BattleSnapshot) => {
    switch (config.combatPolicy) {
      case "random-playable":
        return 1;
      case "greedy-damage":
        return getImmediateDamage(card);
      case "defensive-random":
        return state.playerHealth < state.playerMaxHealth / 2 && getImmediateDefense(card) > 0 ? 2 : 1;
      case "greedy-effective-damage":
        return getEffectiveDamageScore(card, state);
    }
  };
  if (
    config.mode !== "campaign" &&
    run.roomsEncountered >= config.horizon &&
    session.activity.kind !== "battle" &&
    session.activity.kind !== "rewards"
  ) {
    offer("horizon", "end-run", 1, flow.handleAbandonRun);
    return;
  }
  const activity = session.activity;
  switch (activity.kind) {
    case "battle": {
      const state = readBattle().battleState;
      if (isPlayerDefeated(state)) offer("settle", "defeat", 1, flow.handleBattleDefeat);
      else if (state.enemyHealth <= 0) offer("settle", "victory", 1, flow.handleBattleVictory);
      else if (state.wishOptions?.length)
        state.wishOptions.forEach((card, index) =>
          offer(
            "wish",
            card.id,
            affinity(card) + getEffectiveDamageScore(card, state),
            () => commitBattleWish(card.id),
            index,
          ),
        );
      else {
        state.hand.forEach((card, index) => {
          if (canPlayCard(state, card, index, PLAYABLE_HAND_OPTIONS))
            offer(
              "play",
              card.id,
              combatScore(card, state),
              () => {
                const result = commitCardPlay(index, card.id);
                if (result) recordBattle(result.state, result.combatTexts, card.id);
                return result;
              },
              index,
            );
        });
        if (!choices.length)
          offer("end-turn", "turn", 0, () => {
            const result = commitEndTurn();
            for (const frame of result.frames) {
              recordBattle(frame.turn.state, frame.turn.combatTexts);
              if (frame.companion) recordBattle(frame.companion.state, frame.companion.texts);
            }
            return result;
          });
      }
      break;
    }
    case "rewards": {
      const reward = session.rewardFlow.state;
      reward.choices.forEach((choice, index) =>
        offer(
          "reward",
          getRewardChoiceId(choice),
          reward.rewardType === "card" ? affinity(choice as BattleCard) + 1 : 1,
          () => flow.claimRewardChoice(getRewardChoiceId(choice)),
          index,
        ),
      );
      if (!reward.choices.length || reward.rewardType === "card")
        offer(
          "skip-reward",
          "skip",
          config.policy === "minimalist" && run.runDeck.length >= 10 ? 100 : -1,
          flow.skipRewards,
        );
      break;
    }
    case "destination":
      session.rewardFlow.state.destinations.forEach((destination) =>
        offer(
          "destination",
          destination,
          destination === "Campfire" && run.runPlayerHealth < run.runMaxHealth * 0.6 ? 10 : 1,
          () => flow.handleDestinationChoice(destination),
        ),
      );
      break;
    case "campfire":
      offer("campfire", "rest", 1, flow.handleCampfireContinue);
      break;
    case "mystery": {
      const visit = activity.data;
      if (visit.mysteryCardChoices?.length)
        visit.mysteryCardChoices.forEach((card, index) =>
          offer("mystery-card", card.id, affinity(card), () => flow.handleMysteryChooseCard(card.id), index),
        );
      else if (visit.mysteryChosenChoice) offer("mystery-continue", "continue", 1, flow.handleMysteryContinue);
      else
        visit.mysteryEvent?.choices.forEach((choice, index) =>
          offer(
            "mystery",
            choice.label,
            1 +
              characters[config.hero].keywords.filter((keyword) => choice.label.toLowerCase().includes(keyword)).length,
            () => flow.handleMysteryChoice(choice),
            index,
          ),
        );
      break;
    }
    case "corruption":
      if (!activity.data)
        run.runDeck.forEach((card, index) => {
          if (!card.corrupted) offer("corrupt", card.id, 1, () => flow.handleCorruptCard(index), index);
        });
      offer("corruption-exit", "exit", 0, flow.handleCorruptionExit);
      break;
    case "shop": {
      const actions = shop().merchant;
      activity.data.cards.forEach((card, index) => {
        const key = cardSlotKeyOf(card, index);
        if (!activity.data.purchasedSlotKeys.includes(key) && actions.getCardBuyPrice(card) <= profile.gold)
          offer("buy-card", card.id, affinity(card) + 1, () => actions.buyCard(card, key), index);
      });
      if (!activity.data.removeUsed && run.runDeck.length > 10 && actions.getRemoveCardPrice() <= profile.gold)
        run.runDeck.forEach((card, index) =>
          offer(
            "remove-card",
            card.id,
            config.policy === "archetype" ? scoreArchetypeRemoval(config.hero, card, run.runDeck) : 2 - affinity(card),
            () => actions.removeCard(index),
            index,
          ),
        );
      offer("shop-continue", "continue", 0, flow.advanceToNextDestination);
      break;
    }
    case "alchemist": {
      const actions = shop().alchemist;
      activity.data.potions.forEach((card, index) => {
        const key = cardSlotKeyOf(card, index);
        if (!activity.data.purchasedSlotKeys.includes(key) && actions.getPotionBuyPrice(card) <= profile.gold)
          offer("buy-potion", card.id, 1, () => actions.buyPotion(card, key), index);
      });
      offer("shop-continue", "continue", 0, flow.advanceToNextDestination);
      break;
    }
    case "trinket-shop": {
      const actions = shop().trinket;
      activity.data.trinkets.forEach((trinket, index) => {
        const key = shopItemSlotKey(trinket.id, index);
        if (!activity.data.purchasedSlotKeys.includes(key) && actions.getBuyPrice(trinket) <= profile.gold)
          offer("buy-trinket", trinket.id, 1, () => actions.buy(trinket, key), index);
      });
      offer("shop-continue", "continue", 0, flow.advanceToNextDestination);
      break;
    }
    case "equipment-shop": {
      const actions = shop().equipment;
      activity.data.gear.forEach((gear, index) => {
        const key = gearSlotKeyOf(gear);
        if (!activity.data.purchasedSlotKeys.includes(key) && actions.getBuyPrice(gear) <= profile.gold)
          offer("buy-gear", key, 1, () => actions.buy(gear, key), index);
      });
      offer("shop-continue", "continue", 0, flow.advanceToNextDestination);
      break;
    }
    case "draft-deck": {
      const wildwood = config.mode === "wildwood";
      const cards = wildwood ? session.wildwoodDraft?.draftChoices : session.starterDraftChoices;
      if (cards?.length)
        cards.forEach((card, index) =>
          offer(
            "draft",
            card.id,
            affinity(card),
            () => (wildwood ? flow.handleWildwoodDraftPick(card.id) : flow.handleStarterDraftPick(card.id)),
            index,
          ),
        );
      else
        offer(
          "draft-complete",
          "complete",
          1,
          wildwood ? flow.handleWildwoodDraftComplete : flow.handleStandardDraftComplete,
        );
      break;
    }
    case "difficulty-select":
      offer("difficulty", config.difficulty, 1, () => flow.handleDifficultySelect(config.difficulty));
      break;
    case "wildwood-removal":
      offer("wildwood-removal", "skip", 1, flow.handleWildwoodSkipRemoval);
      break;
    case "labyrinth-map": {
      const map = session.labyrinthMap;
      if (map)
        Object.values(map.nodes).forEach((node) => {
          if (canEnterLabyrinthNode(map, node.id))
            offer("labyrinth-enter", node.id, 1, () => {
              labyrinth.selectNode(node.id);
              return nodes.handleLabyrinthNodeEnter();
            });
          if (canDescendFromLabyrinthNode(map, node.id))
            offer("labyrinth-descend", node.id, 2, () => {
              labyrinth.selectNode(node.id);
              labyrinth.descend();
            });
        });
      break;
    }
    case "idle":
    case "inactive":
      throw new Error(`Unsupported mandatory choice: ${activity.kind} (${screen})`);
  }
  if (!choices.length) throw new Error(`No supported legal choices: ${activity.kind}`);
}
