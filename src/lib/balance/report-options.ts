import type { BalanceLoadoutMode } from "./loadout-preset";
import type { BalancePlayPolicy } from "./simulator-types";

const PLAY_POLICIES: readonly BalancePlayPolicy[] = [
  "random-playable",
  "greedy-damage",
  "defensive-random",
  "greedy-effective-damage",
];

const LOADOUT_MODES: readonly BalanceLoadoutMode[] = ["bare", "typical"];

export interface ReportRunOptions {
  iterations: number;
  trinketIterations: number;
  cardIterations: number;
  policy: BalancePlayPolicy;
  loadoutMode: BalanceLoadoutMode;
  deckSeeds: number;
  appliesFightPacing?: boolean;
  findingsCap?: number;
}

function parsePositiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer; received ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} exceeds the maximum safe integer`);
  return value;
}

function parseChoice<T extends string>(name: string, raw: string | undefined, fallback: T, choices: readonly T[]): T {
  if (raw === undefined) return fallback;
  if (choices.includes(raw as T)) return raw as T;
  throw new Error(`${name} must be one of ${choices.join(", ")}; received ${JSON.stringify(raw)}`);
}

export function appliesFightPacingFromEnv(raw = process.env.ALCHEMY_BALANCE_PACING): boolean {
  if (raw === undefined) return true;
  switch (raw.trim().toLowerCase()) {
    case "on":
    case "1":
    case "true":
      return true;
    case "off":
    case "0":
    case "false":
      return false;
    default:
      throw new Error(
        `ALCHEMY_BALANCE_PACING must be one of on, 1, true, off, 0, false; received ${JSON.stringify(raw)}`,
      );
  }
}

export function parseBalanceReportOptions(env: NodeJS.ProcessEnv = process.env): ReportRunOptions {
  const iterations = parsePositiveInteger("ALCHEMY_BALANCE_ITERATIONS", env.ALCHEMY_BALANCE_ITERATIONS, 100);
  return {
    iterations,
    trinketIterations: Math.max(20, Math.floor(iterations / 2)),
    cardIterations: Math.max(30, Math.floor(iterations / 3)),
    deckSeeds: parsePositiveInteger("ALCHEMY_BALANCE_DECK_SEEDS", env.ALCHEMY_BALANCE_DECK_SEEDS, 3),
    policy: parseChoice("ALCHEMY_BALANCE_POLICY", env.ALCHEMY_BALANCE_POLICY, "random-playable", PLAY_POLICIES),
    loadoutMode: parseChoice("ALCHEMY_BALANCE_LOADOUT", env.ALCHEMY_BALANCE_LOADOUT, "typical", LOADOUT_MODES),
    appliesFightPacing: appliesFightPacingFromEnv(env.ALCHEMY_BALANCE_PACING),
    findingsCap: parsePositiveInteger("ALCHEMY_BALANCE_FINDINGS_CAP", env.ALCHEMY_BALANCE_FINDINGS_CAP, 100),
  };
}
