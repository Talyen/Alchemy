import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readBattle, readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/session/run-reads";
import { resetRunDomainStore, mutateGameplayForTest } from "../../../../../helpers/run-domain-store-test";
import { setBattleState } from "@/features/alchemy/shared/stores/commands/write/run-battle";
import { commitCardPlay } from "@/features/alchemy/shared/stores/commands/battle-commands";
import { makeActiveRunData } from "../session/active-run-data-fixture";
import { defaultBattleState } from "@/lib/battle";
import { cardById, enemyById, createEffectDescription, withCardDescription } from "@/lib/game-data";
import { parseActiveRun } from "@/lib/validation/parse-active-run";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";

beforeEach(resetRunDomainStore);

function savedBattle(legacy = true) {
  const source = cardById.heal!;
  const effects = [...source.effects, { kind: "dodge-next-attack" as const }];
  const card = legacy
    ? withCardDescription({ ...source, effects, transmuted: "dodge" }, createEffectDescription(effects))
    : getTransmutationVariants(source, "dodge", [source])[0]!.result;
  const battle = defaultBattleState();
  return makeActiveRunData({
    runDeck: [card, cardById.block!, cardById.bash!, cardById.heal!, cardById["plate-mail"]!],
    runPlayerHealth: 23,
    roomsEncountered: 6,
    currentAct: 2,
    destinationIndexInAct: 3,
    completedDestinations: ["Campfire"],
    encounteredRunEnemyIds: ["goblin"],
    runTalentXP: { dodge: 2 },
    runGoldEarned: 7,
    activity: {
      kind: "battle",
      data: {
        battleState: {
          ...battle,
          turn: 8,
          mana: 4,
          maxMana: 4,
          playerHealth: 10,
          enemyHealth: 2,
          gold: 43,
          currentEnemy: enemyById.goblin!,
          difficultyModifiers: [{ kind: "increase-enemy-damage", amount: 2 }],
          hand: [{ ...card, uid: 3 }],
          deck: [{ ...cardById.block!, uid: 4 }],
          discard: [{ ...cardById.bash!, uid: 5 }],
          exhausted: [{ ...cardById["plate-mail"]!, uid: 6 }],
          pendingHandCards: [{ ...card, uid: 7 }],
          flags: { ...battle.flags, dodgeNextAttack: true },
        },
      },
    },
  });
}

it("preserves the legacy battle and RNG while honoring its existing guarantee only once", () => {
  const saved = savedBattle();
  saved.rng.counters.world = 13;
  const raw = JSON.parse(JSON.stringify(saved));
  delete raw.activity.data.battleState.flags.dodgeNextAttackChance;
  const parsed = parseActiveRun(raw)!;
  if (parsed.activity.kind !== "battle") throw new Error("Expected battle fixture");
  const savedState = parsed.activity.data.battleState;
  mutateGameplayForTest((draft) => {
    draft.runProfile.gold = 43;
  });
  restoreRun(parsed, {}, {}, defaultGameSession);
  const battle = readBattle(defaultGameSession).battleState!;
  expect(battle).toMatchObject({ turn: 8, mana: 4, playerHealth: 10, enemyHealth: 2, gold: 43 });
  expect(battle.currentEnemy).toEqual(savedState.currentEnemy);
  expect(battle.difficultyModifiers).toEqual(savedState.difficultyModifiers);
  expect(battle.roomScalingMultiplier).toBe(savedState.roomScalingMultiplier);
  expect(battle.flags).toMatchObject({ dodgeNextAttack: true, dodgeNextAttackChance: 0 });
  for (const pile of ["hand", "deck", "discard", "exhausted", "pendingHandCards"] as const) {
    expect(battle[pile]).toEqual(savedState[pile].map(hydrateCard));
  }
  expect(battle.hand[0]!.effects.at(-1)).toEqual({ kind: "dodge-next-attack", probability: 0.5 });
  const run = readActiveRun(defaultGameSession);
  expect(run).toMatchObject({
    roomsEncountered: 6,
    currentAct: 2,
    destinationIndexInAct: 3,
    runPlayerHealth: 23,
    completedDestinations: ["Campfire"],
    encounteredRunEnemyIds: ["goblin"],
    runTalentXP: { dodge: 2 },
    runGoldEarned: 7,
  });
  expect(run.rng).toEqual(saved.rng);
  expect(readRunProfile(defaultGameSession).gold).toBe(43);
  expect(run.runDeck[0]!.effects.at(-1)).toEqual({ kind: "dodge-next-attack", probability: 0.5 });
  for (let reload = 0; reload < 2; reload++) {
    const next = snapshotRun(defaultGameSession);
    restoreRun(parseActiveRun(JSON.parse(JSON.stringify(next))), {}, {}, defaultGameSession);
    expect(readBattle(defaultGameSession).battleState).toEqual(battle);
    expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
  }

  const rng = vi.fn(() => {
    throw new Error("An armed guarantee must not roll RNG");
  });
  const dodged = resolveEnemyAttackHit({ ...battle, rng }, { kind: "damage", damageType: "physical", amount: 4 }, [], {
    canDodge: true,
  });
  expect(dodged.dodged).toBe(true);
  expect(dodged.state.playerHealth).toBe(10);
  expect(dodged.state.flags).toMatchObject({ dodgeNextAttack: false, dodgeNextAttackChance: 0 });
  expect(rng).not.toHaveBeenCalled();
  mutateGameplayForTest((draft) => setBattleState(draft, dodged.state));
  const ready = readBattle(defaultGameSession).battleState!;
  expect(commitCardPlay(ready, 0, ready.hand[0]!.id, defaultGameSession)).not.toBeNull();
  const played = readBattle(defaultGameSession).battleState!;
  expect(played.flags).toMatchObject({ dodgeNextAttack: false, dodgeNextAttackChance: 50 });
  expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
  const next = snapshotRun(defaultGameSession);
  restoreRun(parseActiveRun(JSON.parse(JSON.stringify(next))), {}, {}, defaultGameSession);
  expect(readBattle(defaultGameSession).battleState).toEqual(played);
  expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
});

it.each([false, true])("current chance/native guarantees resume without restart (Elusive=%s)", (elusive) => {
  const saved = savedBattle(false);
  if (saved.activity.kind !== "battle") throw new Error("Expected battle fixture");
  if (elusive) saved.activity.data.battleState.flags.dodgeNextAttackChance = 50;
  else {
    saved.activity.data.battleState.hand = [cardById.feint!];
    saved.runDeck = [cardById.feint!];
  }
  const parsed = parseActiveRun(JSON.parse(JSON.stringify(saved)))!;
  restoreRun(parsed, {}, {}, defaultGameSession);
  const battle = readBattle(defaultGameSession).battleState!;
  expect(battle.turn).toBe(8);
  expect(battle.enemyHealth).toBe(2);
  expect(battle.playerHealth).toBe(10);
  expect(battle.flags).toMatchObject({ dodgeNextAttack: true, dodgeNextAttackChance: elusive ? 50 : 0 });
  expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
});
