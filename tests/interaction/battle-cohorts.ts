import {
  cardById,
  cloneBattleCard,
  companionLibrary,
  enemyBestiary,
  computeTalentEffects,
  type UnlockedTalents,
} from "@/lib/game-data";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  createEmptyEquippedTrinkets,
  computeGearManifest,
} from "@/lib/gear";
import { computeTrinketManifest } from "@/lib/trinkets";
import { makeGearInstance } from "../fixtures/gear";
import type { BattleSnapshot } from "@/lib/battle";
import { patchBattleState } from "../fixtures/battle";

const BATTLE_COHORTS = [
  "mitigated-hit",
  "phoenix-health-cost",
  "fatal-retaliation",
  "poison-overkill-leech",
  "stun-immunity",
  "companion-skipped-turn",
  "wish-draw-takeover",
  "consume-last-mana",
] as const;

export function battleCohort(seed: number) {
  const index = (seed + BATTLE_COHORTS.length - 1) % BATTLE_COHORTS.length;
  const id = BATTLE_COHORTS[index]!;
  const alternate = Math.floor((seed + BATTLE_COHORTS.length - 1) / BATTLE_COHORTS.length) % 2 === 0;
  const unlockedTalents: UnlockedTalents = index === 3 ? { poison: ["poison-gold-first"] } : {};
  const inventories = createEmptyGearInventories();
  const loadouts = createEmptyGearLoadouts();
  const equippedTrinkets = createEmptyEquippedTrinkets();
  const trinketIds = index === 3 ? ["bone-charm"] : [];
  if (index === 3) {
    const dagger = makeGearInstance("dagger-basic", "cohort-venomous-dagger", [{ id: "flat-poison", value: 2 }]);
    inventories.knight.push(dagger);
    loadouts.knight["main-hand"] = dagger.instanceId;
    equippedTrinkets.knight = "bone-charm";
  }
  const probeIds = [
    "slash",
    "blood-offering",
    "dark-pact",
    "venom-fangs",
    "bash",
    "slash",
    "wishing-potion",
    "health-potion",
  ];
  const cards = [
    probeIds[index]!,
    ...Array.from({ length: index === 7 ? 2 : 11 }, (_, i) => (i % 2 ? "block" : "slash")),
  ].map((id, i) => ({ ...cloneBattleCard(cardById[id]!), uid: i + 1 }));
  if (alternate && index === 0) cards[0] = { ...cloneBattleCard(cardById.frostbolt!), uid: 1 };
  if (alternate && index === 3) cards[0] = { ...cloneBattleCard(cardById.hemorrhage!), uid: 1 };
  const battle = patchBattleState({
    hand: cards.slice(0, 3),
    deck: cards.slice(3),
    mana: index === 7 ? 1 : 3,
    nextCardUid: cards.length + 1,
    currentEnemy: enemyBestiary.find((enemy) => enemy.id === "goblin")!,
    talentEffects: computeTalentEffects(unlockedTalents),
    gearEffects: computeGearManifest("knight", inventories.knight, loadouts),
    trinketEffects: computeTrinketManifest(trinketIds),
    playerHealth: 30,
    playerMaxHealth: 30,
    enemyHealth: 40,
    enemyMaxHealth: 40,
  });
  let expected: Record<string, unknown>;
  switch (id) {
    case "mitigated-hit":
      battle.enemyMitigation = { ...battle.enemyMitigation, block: 1, armor: 1 };
      expected = { enemyHealth: 38, enemyBlock: 0, enemyArmor: 0, mana: 2 };
      break;
    case "phoenix-health-cost":
      battle.playerHealth = 1;
      battle.deathsDoorUsed = true;
      battle.playerStatuses = { ...battle.playerStatuses, phoenixFeather: 1 };
      expected = { playerHealth: 9, phoenixFeather: 0, handSize: 4, mana: 3 };
      break;
    case "fatal-retaliation":
      battle.playerHealth = 1;
      battle.deathsDoorUsed = true;
      battle.currentEnemy = enemyBestiary.find((enemy) => enemy.id === "fire-elemental")!;
      expected = { playerHealth: 0, enemyHealth: 39, wish: false };
      break;
    case "poison-overkill-leech":
      battle.playerHealth = 10;
      battle.enemyHealth = 1;
      expected = { playerHealth: 14, enemyHealth: 0, gold: 3 };
      break;
    case "stun-immunity":
      battle.enemyHealth = 10;
      battle.enemyCC = { ...battle.enemyCC, cooldown: 1 };
      expected = { enemyHealth: 7, enemyStun: 0, stunSkipTurns: 0, gold: 0 };
      break;
    case "companion-skipped-turn":
      battle.activeCompanion = companionLibrary.wolf;
      battle.enemyCC = { ...battle.enemyCC, stunSkipTurns: 1 };
      expected = { playerHealth: 30, enemyHealth: 39, turn: 2 };
      break;
    case "wish-draw-takeover":
      expected = { wish: true, mana: 2, exhaustedSize: 1 };
      break;
    case "consume-last-mana":
      battle.playerHealth = 10;
      expected = { playerHealth: 18, mana: 0, exhaustedSize: 1, deckSize: 0 };
      break;
  }
  if (alternate && index === 0) {
    battle.currentEnemy = enemyBestiary.find((enemy) => enemy.id === "frostwarden")!;
    battle.enemyMitigation = { ...battle.enemyMitigation, block: 0, armor: 0 };
    expected = { enemyHealth: 38, enemyFreeze: 2, mana: 2 };
  }
  if (alternate && index === 3) {
    battle.enemyHealth = 40;
    battle.enemyStatuses = { ...battle.enemyStatuses, bleed: 3 };
    battle.pendingBleedLeechHealing = 3;
    // Three queued Bleed damage earns half as Leech, rounded: 2 Health.
    expected = { playerHealth: 12, enemyHealth: 33, enemyBleed: 0, gold: 0, mana: 2 };
  }
  return {
    id,
    variant: alternate ? "alternate-boundary" : "primary-boundary",
    worldFixtureSeed: index === 5 ? 6 : 1,
    cards,
    battle,
    expected,
    unlockedTalents,
    inventories,
    loadouts,
    equippedTrinkets,
    trinketIds,
    probe: id === "companion-skipped-turn" ? "end" : "play",
  };
}

export function combatOutcome(state: BattleSnapshot) {
  return {
    playerHealth: state.playerHealth,
    enemyHealth: state.enemyHealth,
    mana: state.mana,
    gold: state.gold,
    enemyFreeze: state.enemyStatuses.freeze,
    enemyBleed: state.enemyStatuses.bleed,
    enemyBlock: state.enemyMitigation.block,
    enemyArmor: state.enemyMitigation.armor,
    phoenixFeather: state.playerStatuses.phoenixFeather,
    enemyStun: state.enemyStatuses.stun,
    stunSkipTurns: state.enemyCC.stunSkipTurns,
    turn: state.turn,
    wish: Boolean(state.wishOptions),
    handSize: state.hand.length,
    deckSize: state.deck.length,
    exhaustedSize: state.exhausted.length,
  };
}
