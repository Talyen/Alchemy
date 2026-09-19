export function parseCleanArgs(argv: string[]): {
  help: boolean;
  builds: boolean;
  processes: boolean;
  includeDevPort: boolean;
  dryRun: boolean;
};
