import type { BalanceLoadoutMode } from "./loadout-preset";
import type { BalancePlayPolicy } from "./simulator-types";

const PLAY_POLICIES: readonly BalancePlayPolicy[] = [
  "random-playable",
  "greedy-damage",
  "defensive-random",
  "greedy-effective-damage",
];

const LOADOUT_MODES: readonly BalanceLoadoutMode[] = ["bare", "typical"];
const REPORT_MODES = ["quick", "full"] as const;
type BalanceReportMode = (typeof REPORT_MODES)[number];

const MODE_SAMPLING = {
  quick: { iterations: 12, pairedMin: 5, pairedDivisor: 3, deckMin: 15, deckDivisor: 4, deckSeeds: 1 },
  full: { iterations: 100, pairedMin: 20, pairedDivisor: 2, deckMin: 30, deckDivisor: 3, deckSeeds: 3 },
} satisfies Record<BalanceReportMode, Record<string, number>>;

export const DEFAULT_FINDINGS_CAP = 100;

export interface ReportRunOptions {
  mode?: BalanceReportMode;
  iterations: number;
  pairedIterations: number;
  cardDeckSamples: number;
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

export function appliesFightPacingFromEnv(raw: string | undefined): boolean {
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
  const mode = parseChoice("ALCHEMY_BALANCE_MODE", env.ALCHEMY_BALANCE_MODE, "quick", REPORT_MODES);
  const sampling = MODE_SAMPLING[mode];
  const iterations = parsePositiveInteger(
    "ALCHEMY_BALANCE_ITERATIONS",
    env.ALCHEMY_BALANCE_ITERATIONS,
    sampling.iterations,
  );
  return {
    mode,
    iterations,
    pairedIterations: Math.max(sampling.pairedMin, Math.floor(iterations / sampling.pairedDivisor)),
    cardDeckSamples: Math.max(sampling.deckMin, Math.floor(iterations / sampling.deckDivisor)),
    deckSeeds: parsePositiveInteger("ALCHEMY_BALANCE_DECK_SEEDS", env.ALCHEMY_BALANCE_DECK_SEEDS, sampling.deckSeeds),
    policy: parseChoice("ALCHEMY_BALANCE_POLICY", env.ALCHEMY_BALANCE_POLICY, "random-playable", PLAY_POLICIES),
    loadoutMode: parseChoice("ALCHEMY_BALANCE_LOADOUT", env.ALCHEMY_BALANCE_LOADOUT, "typical", LOADOUT_MODES),
    appliesFightPacing: appliesFightPacingFromEnv(env.ALCHEMY_BALANCE_PACING),
    findingsCap: parsePositiveInteger(
      "ALCHEMY_BALANCE_FINDINGS_CAP",
      env.ALCHEMY_BALANCE_FINDINGS_CAP,
      DEFAULT_FINDINGS_CAP,
    ),
  };
}
