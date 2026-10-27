import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import { beforeEach, expect, it } from "vitest";
import { resetRunDomainStore } from "../../../../../helpers/run-domain-store-test";
import { makeActiveRunData } from "../session/active-run-data-fixture";
import { savedActivityFixture } from "../../../../../fixtures/run-activity";
import { cardById, createEffectDescription, withCardDescription } from "@/lib/game-data";
import { cloneBattleCard } from "@/lib/game-data/cards/hydrate-card";
import { defaultBattleState } from "@/lib/battle";
import { parseActiveRun } from "@/lib/validation/parse-active-run";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readActiveRun, readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => resetRunDomainStore());

it("normalizes the run deck and every restored battle pile without replaying state", () => {
  const previous = cloneBattleCard(cardById["shield-bash"]!);
  delete previous.definitionVersion;
  const damage = previous.effects[1]!;
  if (damage.kind !== "damage") throw new Error("Missing Bash damage");
  delete damage.spendBlock;
  const old = withCardDescription(previous, createEffectDescription(previous.effects));
  const modified = withCardDescription(
    {
      ...old,
      uid: 77,
      cost: 0,
      corrupted: true,
      transmuted: "holy",
      baseTitle: "Shield Bash",
      effects: [
        { kind: "player-status", status: "block", amount: 7 },
        { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true, equalToBlockPercent: 50 },
        { kind: "heal", amount: 2 },
      ],
    },
    [],
  );
  const completeModified = withCardDescription(modified, createEffectDescription(modified.effects));
  const other = cardById["blessed-aegis"]!;
  const battle = {
    ...defaultBattleState(),
    mana: 2,
    playerHealth: 17,
    enemyHealth: 23,
    deck: [old],
    hand: [completeModified],
    pendingHandCards: [old],
    discard: [old],
    exhausted: [old],
    wishOptions: [old],
    wishQueue: [[old]],
    pendingTurnStartEffects: [{ sourceCard: { id: "shield-bash" }, remainingTurns: 1, effects: old.effects }],
  };
  const raw = makeActiveRunData({
    runDeck: [old, completeModified, other],
    activity: savedActivityFixture("battle", { battleState: battle }),
  });
  const json = JSON.stringify(raw);
  const parsed = parseActiveRun(JSON.parse(json))!;
  expect(parsed.runDeck[0]).toMatchObject({
    definitionVersion: 1,
    effects: [{ kind: "player-status", amount: 2 }, { spendBlock: true }],
  });
  expect(parsed.runDeck[1]).toMatchObject({
    cost: 0,
    corrupted: true,
    transmuted: "holy",
    definitionVersion: 1,
    effects: [{ amount: 7 }, { damageType: "holy", spendBlock: true }, { kind: "heal", amount: 2 }],
  });
  expect(parsed.runDeck[2]).toEqual(other);
  restoreRun(parsed, {}, {}, defaultGameSession);
  const resumed = readBattle(defaultGameSession).battleState!;
  for (const cards of [
    resumed.deck,
    resumed.hand,
    resumed.pendingHandCards,
    resumed.discard,
    resumed.exhausted,
    resumed.wishOptions!,
    ...resumed.wishQueue,
  ]) {
    expect(cards[0]).toMatchObject({
      definitionVersion: 1,
      effects: expect.arrayContaining([expect.objectContaining({ spendBlock: true })]),
    });
    expect(cards[0]!.descriptionLines.some((line) => line.startsWith("Spend half your Block to deal "))).toBe(true);
  }
  expect(resumed.hand[0]).toMatchObject({
    uid: 77,
    cost: 0,
    corrupted: true,
    transmuted: "holy",
    effects: [{ amount: 7 }, { damageType: "holy", spendBlock: true }, { kind: "heal", amount: 2 }],
  });
  expect(resumed).toMatchObject({ mana: 2, playerHealth: 17, enemyHealth: 23 });
  expect(resumed.pendingTurnStartEffects[0]!.effects).toEqual(old.effects);
  expect(readActiveRun(defaultGameSession).runDeck[0]!.definitionVersion).toBe(1);
  const saved = snapshotRun(defaultGameSession);
  const roundTrip = parseActiveRun(JSON.parse(JSON.stringify(saved)))!;
  restoreRun(roundTrip, {}, {}, defaultGameSession);
  expect(snapshotRun(defaultGameSession)).toEqual(saved);
  expect(saved.rng).toEqual(raw.rng);
  expect(JSON.stringify(raw)).toBe(json);
});
