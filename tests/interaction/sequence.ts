import fs from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { createSeededRng } from "@/lib/rng";
import { ensureRunId } from "../../scripts/lib/verification/current-run.mjs";

const FAMILIES = ["battle", "navigation", "visits", "armory", "overlays", "persistence", "startup"] as const;
export type Family = (typeof FAMILIES)[number];
export interface Scenario {
  fixture: unknown;
  actions(): string[];
  run(action: string): Promise<void> | void;
  check(): Promise<void> | void;
  settle(): Promise<void> | void;
  observe(): unknown;
  dispose(): Promise<void> | void;
}
export class InteractionFailure extends Error {
  constructor(
    readonly invariant: string,
    readonly state: unknown,
  ) {
    super(`${invariant}: ${JSON.stringify(state)}`);
  }
}
export function requireProgress(condition: unknown, invariant: string, state: unknown): asserts condition {
  if (!condition) throw new InteractionFailure(invariant, state);
}
export function sequenceSeeds(tier: string, day: string): number[] {
  if (tier !== "nightly") return Array.from({ length: 16 }, (_, i) => i + 1);
  const daily = createSeededRng(Number(day.replaceAll("-", "")));
  const seeds = new Set(Array.from({ length: 64 }, (_, i) => i + 17));
  while (seeds.size < 128) {
    const seed = Math.floor(daily() * 0x100000000) >>> 0;
    if (seed > 80) seeds.add(seed);
  }
  return [...seeds];
}
export async function reduceActions(
  actions: string[],
  reproduces: (actions: string[]) => Promise<boolean>,
  budget = 64,
): Promise<string[]> {
  let reduced = [...actions];
  let attempts = 0;
  for (let size = Math.max(1, Math.floor(reduced.length / 2)); size >= 1; size = Math.floor(size / 2)) {
    for (let index = 0; index < reduced.length && attempts < budget; ) {
      const candidate = [...reduced.slice(0, index), ...reduced.slice(index + size)];
      attempts++;
      if (candidate.length && (await reproduces(candidate))) reduced = candidate;
      else index += size;
    }
  }
  return reduced;
}

export async function exercise(
  create: (seed: number) => Promise<Scenario> | Scenario,
  seed: number,
  steps: number,
  replay?: string[],
) {
  const scenario = await create(seed);
  const rng = createSeededRng(seed);
  const history: Array<{ action: string; state: unknown }> = [];
  const actions: string[] = [];
  try {
    for (let index = 0; index < (replay?.length ?? steps); index++) {
      const available = scenario.actions();
      if (!available.length && !replay) break;
      const action = replay?.[index] ?? available[Math.floor(rng() * available.length)]!;
      requireProgress(available.includes(action), "replay-action-unavailable", { action, available });
      actions.push(action);
      await scenario.run(action);
      await scenario.check();
      history.push({ action, state: scenario.observe() });
    }
    await scenario.settle();
    await scenario.check();
    history.push({ action: "<settle>", state: scenario.observe() });
    return { actions, history, fixture: scenario.fixture };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      sequence: { actions, history, fixture: scenario.fixture, state: scenario.observe() },
    });
  } finally {
    await scenario.dispose();
  }
}

export function defineSequenceFamily(family: Family, create: (seed: number) => Promise<Scenario> | Scenario) {
  const selected = process.env.ALCHEMY_INTERACTION_FAMILY;
  if (selected && selected !== family) return;
  const tier = process.env.ALCHEMY_INTERACTION_TIER ?? "push";
  const day = process.env.ALCHEMY_INTERACTION_DAY ?? new Date().toISOString().slice(0, 10);
  const seeds = process.env.ALCHEMY_INTERACTION_SEED
    ? [Number(process.env.ALCHEMY_INTERACTION_SEED)]
    : sequenceSeeds(tier, day);
  const steps = tier === "nightly" ? 120 : 40;
  const replay = process.env.ALCHEMY_INTERACTION_ACTIONS
    ? (JSON.parse(process.env.ALCHEMY_INTERACTION_ACTIONS) as string[])
    : undefined;
  const runId = ensureRunId("interaction");
  const directory = path.join("reports", "runs", runId, "interaction");
  fs.mkdirSync(directory, { recursive: true });
  const manifest = { family, tier, day, seeds, steps, executedSeeds: [] as number[] };
  const manifestPath = path.join(directory, `${family}-seeds.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  it.each(seeds)(
    `${family} interaction seed %i`,
    async (seed) => {
      manifest.executedSeeds.push(seed);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      try {
        await exercise(create, seed, steps, replay);
      } catch (error) {
        const failure = error as Error & {
          invariant?: string;
          sequence: { actions: string[]; history: unknown; fixture: unknown; state: unknown };
        };
        const sequence = failure.sequence ?? { actions: [], history: [], fixture: null, state: null };
        const artifact = {
          family,
          seed,
          tier,
          day,
          ...sequence,
          invariant: failure.invariant ?? failure.name,
          message: failure.message,
        };
        const output = path.join(directory, `${family}-${seed}.json`);
        fs.writeFileSync(output, JSON.stringify(artifact, null, 2));
        if (process.env.ALCHEMY_INTERACTION_SHRINK === "1" && failure instanceof InteractionFailure) {
          const reduced = await reduceActions(
            artifact.actions,
            async (candidate) => {
              try {
                await exercise(create, seed, steps, candidate);
                return false;
              } catch (next) {
                return next instanceof InteractionFailure && next.invariant === failure.invariant;
              }
            },
            63,
          );
          try {
            await exercise(create, seed, steps, reduced);
          } catch (minimized) {
            const observed = minimized as typeof failure;
            if (
              minimized instanceof InteractionFailure &&
              minimized.invariant === failure.invariant &&
              observed.sequence
            ) {
              fs.writeFileSync(
                output,
                JSON.stringify(
                  {
                    ...artifact,
                    ...observed.sequence,
                    originalActions: artifact.actions,
                    originalHistory: artifact.history,
                  },
                  null,
                  2,
                ),
              );
            }
          }
        }
        throw new Error(`${failure.message}\nReplay: npm run test:interactions -- --replay ${output}`, {
          cause: error,
        });
      }
    },
    15_000,
  );
}
