export function runAllOptimizePipelines(options?: {
  check?: boolean;
}): Promise<Array<{ ok: boolean; error?: string } | undefined>>;

export function optimizationFailures(results: Array<Record<string, unknown>>): Error[];
