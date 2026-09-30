export type GameEdition = "demo" | "full";
export function resolveEdition(value?: string): GameEdition;
export function editionPolicy(edition: GameEdition): {
  edition: GameEdition;
  productName: string;
  appId: string;
  rendererDirectory: string;
  packageDirectory: string;
  cloudFiles: string[];
  characters: string[] | null;
  modes: string[] | null;
  difficulties: string[] | null;
  campaignActs: number;
};
