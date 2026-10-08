export interface CatalogAsset {
  [key: string]: string;
}
export interface ReviewCandidate {
  assetId: string;
  path: string;
  start: number;
  duration: number;
  note: string;
}
export interface ReviewAction {
  id: string;
  title: string;
  group: string;
  family: string;
  screens: string[];
  trigger: string;
  current: string | null;
  currentState: "playing" | "registered-unused" | "silent";
  note: string;
  priority: string;
  evidence: string[];
}
export interface ReviewManifest {
  sharedChoices?: Record<string, string>;
  battleFocus?: string[];
  schemaVersion: number;
  direction: string;
  libraryRootDefault: string;
  reviewPolicy: string;
  families: Array<{
    id: string;
    title: string;
    rationale: string;
    candidates: ReviewCandidate[];
    silenceReason?: string;
  }>;
  actions: ReviewAction[];
  assignments: Record<"cards" | "enemies" | "companions", Record<string, string>>;
  destinationCoverage: string[];
  keywordCoverage: Record<string, string[]>;
  sequences: Array<{ id: string; title: string; note: string; steps: Array<{ mapping: string; at: number }> }>;
}
export interface ReviewInventory {
  cards: Array<{ id: string; title: string; keywords: string[] }>;
  enemies: Array<{ id: string; title: string; enemyType: string; abilityIds: string[] }>;
  companions: Array<{ id: string; title: string }>;
  screens: string[];
  destinations: string[];
  keywords: string[];
  registry: Record<string, Record<string, string | string[] | null>>;
}
export interface ReviewMapping extends Omit<ReviewAction, "current"> {
  choiceFrom?: string;
  current?: string | null;
  currentFiles: string[];
  status: string;
  rationale: string;
  familyTitle: string;
  candidates: Array<
    ReviewCandidate & {
      identicalTo: string[];
      originalName: string;
      source: string;
      licenseReference: string;
      confidence: string;
    }
  >;
  silenceReason: string | null;
}
export function parseCatalog(csv: string): CatalogAsset[];
export function readLibraryCatalog(
  libraryRoot: string,
  candidates: ReviewCandidate[],
): Promise<{ catalog: CatalogAsset[]; metadataSource: string }>;
export function containedPath(root: string, relative: string): string;
export function hashFile(file: string): Promise<string>;
export function loadGameInventory(): Promise<ReviewInventory>;
export function validateMappings(manifest: ReviewManifest, inventory: ReviewInventory, catalog: CatalogAsset[]): void;
export function collectAudioEvidence(root: string): Promise<Array<{ file: string; line: number; text: string }>>;
export function buildMappings(
  manifest: ReviewManifest,
  inventory: ReviewInventory,
  catalog: CatalogAsset[],
  identity: Record<
    string,
    { hashes: string[]; approvedExcerpt?: { assetId: string; start: number; duration: number } }
  >,
): ReviewMapping[];
export function inspectLibrary(catalog: CatalogAsset[], libraryRoot: string): Promise<string[]>;
