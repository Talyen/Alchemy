import type { GameEdition } from "../../../game-edition.mjs";
export function releaseEdition(env?: NodeJS.ProcessEnv): {
  edition: GameEdition; productName: string; appId: string;
  rendererDirectory: string; packageDirectory: string; cloudFiles: string[];
  characters: string[] | null; modes: string[] | null; difficulties: string[] | null;
  campaignActs: number; steamAppId: string | undefined; steamDepotId: string | undefined;
  fullGameSteamAppId: string | undefined;
};
export function assertPackageEdition(metadata: { gameEdition?: unknown; steamAppId?: unknown; steamDepotId?: unknown; fullGameSteamAppId?: unknown }, renderer: { edition?: unknown }, env?: NodeJS.ProcessEnv): void;
