import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
  readActiveRunScreen,
} from "@/features/alchemy/shared/stores/run-reads";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  constructBuilding,
  plantFarm,
  completeResearch,
  bondCompanion,
  unlockTalent,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { commitCardPlay, commitBattleWish } from "@/features/alchemy/run-loop/battle/battle-action-commands";
import { commitEndTurn, resumePendingBattleTransition } from "@/features/alchemy/run-loop/battle/battle-session";
import { PLAYABLE_HAND_OPTIONS } from "@/features/alchemy/run-loop/battle/playable-hand";
import { cardSlotKeyOf, gearSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
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
import {
  characters,
  talentPool,
  canUnlockTalent,
  isProgressionFeatureUnlocked,
  isCharacterUnlocked,
  isGameModeUnlocked,
  type BattleCard,
} from "@/lib/game-data";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { canDescendFromLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { canUpgradeTierItem } from "@/lib/homestead/upgrades";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { mutateGearWithFlush, salvageGearWithFlush } from "@/features/alchemy/meta/screens/armory/armory-commands";
import { flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  gearDefinitions,
  equipGear,
  type GearInstance,
  flattenGearInventories,
  GEAR_SLOTS,
  isGearCompatibleWithLoadoutSlot,
  CRAFTING_CURRENCY_LIST,
  canApplyCraftingCurrency,
} from "@/lib/gear";
import { createSeededRng } from "@/lib/rng";
import type { CareerConfig, PlayerChoice } from "./types";
import { createPlaythroughController } from "./controller";
import { scoreArchetypeRemoval, scoreStrategyCard, scoreStrategyKeyword } from "./archetype-policy";

export function createCareerActor(
  config: CareerConfig,
  recordBattle: (state: BattleSnapshot, texts: CombatTextEvent[], card?: string) => void = () => {},
) {
  const controller = createPlaythroughController();
  const { flow, shop, labyrinth, nodes } = controller;
  const craftingRandom = createSeededRng(config.seed ^ 0x193ac);
  const crafted = new Set<string>();
  const commands = new Map<string, () => unknown>();
  let choices: PlayerChoice[] = [];
  const offer = (kind: string, id: string, score: number, execute: () => unknown, index?: number) => {
    const choice = { kind, id, score, ...(index === undefined ? {} : { index }) };
    choices.push(choice);
    commands.set(`${kind}:${id}:${index ?? ""}`, execute);
  };
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
  const affinity = (card: BattleCard) => scoreStrategyCard(config.policy, config.hero, card, readActiveRun().runDeck);
  const keywordAffinity = (keyword: Parameters<typeof scoreStrategyKeyword>[2]) =>
    scoreStrategyKeyword(config.policy, config.hero, keyword, readActiveRun().runDeck);
  function observe(): PlayerChoice[] {
    choices = [];
    commands.clear();
    const run = readActiveRun(),
      session = readRunSession(),
      profile = readRunProfile();
    const screen = readActiveRunScreen();
    if (screen === "game-over" || screen === "run-victory") {
      offer("continue-run-end", screen, 1, flow.continueFromRunEnd);
      return choices;
    }
    if (screen === "difficulty-select") {
      offer("difficulty", config.difficulty, 1, () => flow.handleDifficultySelect(config.difficulty));
      return choices;
    }
    if (!session.hasActiveRun) {
      const finished = readProfileStore().finishedRunCharacters;
      if (!isCharacterUnlocked(config.hero, finished) || !isGameModeUnlocked(config.mode, finished))
        throw new Error(
          "Unsupported configuration: hero or mode is locked; use an explicitly labeled fixture or earn the unlock",
        );
      if (isProgressionFeatureUnlocked("homestead", finished)) {
        for (const item of buildings)
          if (canUpgradeTierItem(item, profile.constructedBuildings[item.id], profile.materialInventory))
            offer("building", item.id, 4, () => createRunSessionCommand(constructBuilding)(item.id));
        for (const item of farmPlots)
          if (canUpgradeTierItem(item, profile.plantedFarms[item.id], profile.materialInventory))
            offer("farm", item.id, 3, () => createRunSessionCommand(plantFarm)(item.id));
        for (const item of researchUpgrades)
          if (canUpgradeTierItem(item, profile.completedResearch[item.id], profile.materialInventory))
            offer("research", item.id, 3, () => createRunSessionCommand(completeResearch)(item.id));
        for (const item of companionTierItems)
          if (canUpgradeTierItem(item, profile.bondedCompanions[item.id], profile.materialInventory))
            offer("bond", item.id, 3, () => createRunSessionCommand(bondCompanion)(item.id));
      }
      if (isProgressionFeatureUnlocked("talents", finished)) {
        for (const talent of talentPool)
          if (canUnlockTalent(talent.keywordId, talent.id, profile.talentXP, profile.unlockedTalents).ok)
            offer("talent", talent.id, 3 + keywordAffinity(talent.keywordId), () =>
              createRunSessionCommand(unlockTalent)(talent.keywordId, talent.id),
            );
      }
      const gear = readGearState();
      const inventory = flattenGearInventories(gear.inventories);
      const loadout = gear.loadouts[config.hero];
      const gearScore = (item: GearInstance) =>
        1 + item.affixes.reduce((sum, affix) => sum + Math.max(0, affix.value), 0);
      const loadoutScore = (value: typeof loadout) =>
        Object.values(value).reduce(
          (sum, id) =>
            sum +
            (inventory.find((item) => item.instanceId === id)
              ? gearScore(inventory.find((item) => item.instanceId === id)!)
              : 0),
          0,
        );
      for (const item of inventory) {
        const definition = gearDefinitions[item.definitionId];
        if (!definition) continue;
        for (const slot of GEAR_SLOTS) {
          if (
            !Object.values(loadout).includes(item.instanceId) &&
            isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory) &&
            loadoutScore(equipGear(gear.loadouts, config.hero, slot, item, inventory)[config.hero]) >
              loadoutScore(loadout)
          )
            offer("equip", `${slot}:${item.instanceId}`, 2, () =>
              mutateGearWithFlush(
                () => flushSaveAfterGearMutation(null),
                (state) => state.equip(config.hero, slot, item),
              ),
            );
        }
        for (const currency of CRAFTING_CURRENCY_LIST)
          if (
            !crafted.has(item.instanceId) &&
            gear.craftingCurrencies[currency.id] > 0 &&
            canApplyCraftingCurrency(currency.id, item)
          )
            offer("craft", `${currency.id}:${item.instanceId}`, 1, () => {
              crafted.add(item.instanceId);
              return mutateGearWithFlush(
                () => flushSaveAfterGearMutation(null),
                (state) => state.applyCurrency(currency.id, item.instanceId, { rng: craftingRandom }),
              );
            });
      }
      for (const item of gear.inventories[config.hero]) {
        if (
          !Object.values(gear.loadouts).some((slots) => Object.values(slots).includes(item.instanceId)) &&
          inventory.some((other) => other.definitionId === item.definitionId && gearScore(other) > gearScore(item))
        )
          offer("salvage", item.instanceId, 1, () =>
            salvageGearWithFlush(() => flushSaveAfterGearMutation(null), item.instanceId),
          );
      }
      if (!gear.equippedTrinkets[config.hero])
        for (const id of gear.ownedTrinketIds)
          offer("equip-trinket", id, 2, () =>
            mutateGearWithFlush(
              () => flushSaveAfterGearMutation(null),
              (state) => state.equipTrinket(config.hero, id),
            ),
          );
      offer("start", config.mode, 0, () => {
        crafted.clear();
        flow.goToScreen("game-mode-select");
        if (config.mode === "campaign") flow.beginCampaign();
        else if (config.mode === "labyrinth") flow.beginLabyrinth();
        else flow.beginWildwood();
        flow.handleCharacterSelect(config.hero);
      });
      return choices;
    }
    if (
      config.mode !== "campaign" &&
      run.roomsEncountered >= config.horizon &&
      session.activity.kind !== "battle" &&
      session.activity.kind !== "rewards"
    ) {
      offer("horizon", "end-run", 1, flow.handleAbandonRun);
      return choices;
    }
    const activity = session.activity;
    switch (activity.kind) {
      case "battle": {
        const state = readBattle().battleState;
        if (readBattle().pendingBattleTransition) {
          offer("resume-battle", "pending-transition", 1, () =>
            resumePendingBattleTransition(0, {
              isCurrentBattleSession: () => readBattle().hasActiveBattle,
              checkBattleEnd: (next) => {
                if (isPlayerDefeated(next)) {
                  flow.handleBattleDefeat();
                  return true;
                }
                if (next.enemyHealth <= 0) {
                  flow.handleBattleVictory();
                  return true;
                }
                return false;
              },
            }),
          );
        } else if (isPlayerDefeated(state)) offer("settle", "defeat", 1, flow.handleBattleDefeat);
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
                characters[config.hero].keywords.filter((keyword) => choice.label.toLowerCase().includes(keyword))
                  .length,
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
              config.policy === "archetype"
                ? scoreArchetypeRemoval(config.hero, card, run.runDeck)
                : 2 - affinity(card),
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
    return choices;
  }
  function execute(choice: PlayerChoice) {
    const action = commands.get(`${choice.kind}:${choice.id}:${choice.index ?? ""}`);
    if (!action) throw new Error(`Replay choice unavailable: ${JSON.stringify(choice)}`);
    return action();
  }
  return { observe, execute };
}
