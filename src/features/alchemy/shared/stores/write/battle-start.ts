import { enemyById, getBossById, getBossEnemy, getCurrentEnemy, isEnemyId } from "../../config";
import { resolveBattleStart } from "@/lib/battle";
import { appendEncounterTraits } from "@/lib/content-systems/encounter-traits";
import { withWildwoodModifier } from "@/lib/content-systems/wildwood/gauntlet";
import { getDifficultyModifiers, type BestiaryEntry } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import { appendUnique } from "@/lib/utils";
import type { BattleStarted, BattleStartRequest } from "../battle-start-types";
import type { GameplayDraft } from "../gameplay-command";
import { deriveCombatMeta } from "./live-meta";
import { commitResolvedBattle, enterBattle } from "./run-battle";
import { createDraftRunRandomSource, setEncounteredRunEnemyIds, setRoomsEncountered } from "./run-progress";
import { setEncounteredEnemyIds } from "./run-meta";
import { recordRunRoom } from "./run-recap";

function resolveEnemy(draft: GameplayDraft, request: BattleStartRequest): BestiaryEntry | null {
  if (request.kind === "boss-by-id") {
    const boss = getBossById(request.options.bossId);
    if (!boss) return null;
    return request.options.wildwoodModifierId ? withWildwoodModifier(boss, request.options.wildwoodModifierId) : boss;
  }
  const options = request.options;
  if (options.enemyId && isEnemyId(options.enemyId)) {
    const enemy = enemyById[options.enemyId];
    if (request.kind === "battle" || enemy.enemyType === "boss") return enemy;
  }
  const rng = createDraftRunRandomSource(draft, "world");
  return request.kind === "boss"
    ? getBossEnemy(draft.run.activeRun.encounteredRunEnemyIds, rng)
    : getCurrentEnemy(request.options.enemyType ?? "normal", draft.run.activeRun.encounteredRunEnemyIds, rng);
}

export function initializeBattle(draft: GameplayDraft, request: BattleStartRequest): BattleStarted | null {
  if (draft.session.activity.kind === "inactive" || draft.session.activity.kind === "battle") return null;
  const enemy = resolveEnemy(draft, request);
  if (!enemy) return null;
  const startingHealth = draft.run.activeRun.runPlayerHealth;
  const run = draft.run.activeRun;
  const nextRoomsEncountered = run.roomsEncountered + 1;
  setRoomsEncountered(draft, nextRoomsEncountered);
  const encounterTraitIds = run.contentSystemType === "labyrinth" ? draft.session.activeLabyrinthModifiers : [];
  const battleEnemy = encounterTraitIds.length > 0 ? appendEncounterTraits(enemy, encounterTraitIds) : enemy;
  const combatMeta = deriveCombatMeta(draft);
  const startingGold = draft.runProfile.gold;
  const opening = resolveBattleStart(
    {
      runDeck: run.runDeck,
      gold: startingGold,
      totalRooms: nextRoomsEncountered,
      currentEnemy: battleEnemy,
      playerHealth: startingHealth,
      talentEffects: combatMeta.talentEffects,
      discoveredCardIds: draft.profile.discoveredCardIds,
      maxHealth: run.runMaxHealth,
      trinketIds: combatMeta.activeTrinketIds,
      gearEffects: combatMeta.gearEffects,
      difficultyModifiers:
        request.options.modifiers ??
        (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []),
      contentSystemType: run.contentSystemType,
      encounterBenefits: draft.session.activeLabyrinthRewardModifiers,
    },
    { rng: createDraftRunRandomSource(draft, "world") },
  );
  enterBattle(draft, opening.state);
  commitResolvedBattle(draft, { ...opening.state, gold: startingGold }, opening.state);
  if (run.contentSystemType !== "labyrinth" && draft.session.rewardFlow.claim.kind !== "destination") {
    const destination =
      enemy.enemyType === "boss"
        ? DESTINATIONS.BOSS_COMBAT
        : enemy.enemyType === "elite"
          ? DESTINATIONS.ELITE_COMBAT
          : DESTINATIONS.NORMAL_COMBAT;
    recordRunRoom(draft, destination, `${run.contentSystemType}:battle:${nextRoomsEncountered}`);
  }
  setEncounteredRunEnemyIds(draft, (current) => appendUnique(current, enemy.id));
  setEncounteredEnemyIds(draft, (current) => appendUnique(current, enemy.id));

  const startingTexts = [...(opening.companion?.texts ?? [])];
  if (opening.state.enemyMitigation.armor > 0) {
    startingTexts.push({
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: opening.state.enemyMitigation.armor,
    });
  }
  if (opening.state.enemyMitigation.block > 0) {
    startingTexts.push({
      target: "enemy",
      kind: "status",
      stat: "block",
      amount: opening.state.enemyMitigation.block,
    });
  }
  return {
    startingTexts,
    companionId: opening.companion?.id ?? null,
    outcome: opening.outcome,
    openingCardIds: opening.state.hand.map((card) => card.id),
  };
}
