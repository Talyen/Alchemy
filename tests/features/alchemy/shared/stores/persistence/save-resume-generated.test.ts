import "../../../../../helpers/mock-audio";
import { expect, it } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";
import { restoreSessionSave } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { canEnterLabyrinthNode, withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { cardById } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createRunRngState, createSeededRng, stepRunRng } from "@/lib/rng";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../../helpers/run-domain-store-test";

const replay = process.env.ALCHEMY_SAVE_PROPERTY_SEED;
if (replay !== undefined && (!/^\d+$/.test(replay) || Number(replay) > 0xffff_ffff)) {
  throw new Error("ALCHEMY_SAVE_PROPERTY_SEED must be a uint32");
}
const daily = createSeededRng(Number(new Date().toISOString().slice(0, 10).replaceAll("-", "")));
const nightlySeeds = new Set(Array.from({ length: 64 }, (_, index) => index + 17));
while (nightlySeeds.size < 128) nightlySeeds.add(Math.floor(daily() * 0x1_0000_0000));
const seeds =
  replay !== undefined
    ? [Number(replay)]
    : process.env.ALCHEMY_INTERACTION_TIER === "nightly"
      ? [...nightlySeeds]
      : Array.from({ length: 16 }, (_, index) => index + 1);

it.each(seeds)("preserves generated Labyrinth progress and pending rewards after save and resume (seed %i)", (seed) => {
  const random = createSeededRng(seed);
  const integer = (max: number) => Math.floor(random() * max);
  let map = generateLabyrinthMap(random);
  const steps = 1 + integer(4);
  let cleared = 0;
  for (let index = 0; index < steps; index++) {
    const reachable = Object.values(map.nodes).filter((node) => canEnterLabyrinthNode(map, node.id));
    const node = reachable[integer(reachable.length)];
    if (!node) break;
    map = withClearedNode(map, node.id);
    cleared++;
  }
  const rng = createRunRngState(Math.floor(random() * 0x1_0000_0000));
  const worldDraws = 1 + integer(8);
  const rewardDraws = 1 + integer(8);
  for (let index = 0; index < worldDraws; index++) stepRunRng(rng, "world");
  for (let index = 0; index < rewardDraws; index++) stepRunRng(rng, "rewards");
  const health = 1 + integer(30);
  const gold = integer(200);
  const materials = { ...emptyInventory(), wood: integer(10), iron: integer(10) };
  const choices = [cardById.slash!, cardById.block!];
  const chosen = integer(2) ? choices : [...choices].reverse();

  resetRunDomainStore();
  setRunProgress({
    characterId: "knight",
    contentSystemType: "labyrinth",
    runPlayerHealth: health,
    runMaxHealth: 30,
    rng,
  });
  setRunSession({
    hasActiveRun: true,
    activity: { kind: "rewards" },
    labyrinthMap: map,
    rewardState: { ...createEmptyRewardState(), rewardType: "card", choices: chosen, gold, materials },
  });
  const save = buildAlchemySaveDataFromStores(defaultGameSession);
  const loaded = evaluateSaveCandidates([JSON.stringify({ ...save, lastSavedAt: 1 })]);
  expect(loaded.status).toEqual({ kind: "ok" });
  resetRunDomainStore();
  restoreSessionSave(loaded.data, defaultGameSession);

  const run = readActiveRun(defaultGameSession);
  const session = readRunSession(defaultGameSession);
  expect(cleared).toBeGreaterThan(0);
  expect(run.runPlayerHealth).toBe(health);
  expect(run.rng).toEqual(rng);
  expect(session.labyrinthMap).toEqual(map);
  expect(session.activity.kind).toBe("rewards");
  const reward = session.rewardFlow.state;
  expect(reward).toMatchObject({ rewardType: "card", gold, materials });
  if (reward.rewardType !== "card") throw new Error("Expected a card reward after resume");
  expect(reward.choices.map((card) => card.id)).toEqual(chosen.map((card) => card.id));
});
