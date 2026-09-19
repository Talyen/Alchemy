export interface ContextMeasurement {
  changedPaths: string[];
  routes: string[];
  instructions: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  ownerDocs: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  docs: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  instructionBytes: number;
  ownerDocBytes: number;
  selectedBytes: number;
  changedFileBytes: number;
  totalContextBytes: number;
  verificationCommands: number;
  deduplicatedTestPaths: number;
  artifacts: Array<{ path: string; bytes: number }>;
  artifactBytes: number;
  outputs: Array<{ path: string; bytes: number }>;
  namedOutputBytes: number;
}

export const ROUTE_CONTEXT_BUDGETS: Readonly<Record<string, { preread: number; total: number }>>;

export function measureContext(options?: {
  paths?: string[];
  docs?: string[];
  artifacts?: string[];
  outputFiles?: string[];
}): ContextMeasurement;

export function measureAllRoutes(): ContextMeasurement[];

export interface DiscoveryMeasurement {
  task: string;
  paths: string[];
  selectedBytes: number;
  emittedSectionBytes: number;
  emittedBytes: number;
  deferred: Array<{ path: string; heading: string | null }>;
}

export function measureDiscoveryContexts(): DiscoveryMeasurement[];
