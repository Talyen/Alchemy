export const TEST_SUITES: {
  save: readonly string[];
  tooling: readonly string[];
  shipUnit: readonly string[];
};

export function validateTestSuitePaths(rootDir: string, suites?: readonly string[]): string[];

export const DOCS_CHECK_KEY: string;
