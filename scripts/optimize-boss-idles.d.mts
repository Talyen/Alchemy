export function optimizeBossIdles(options?: {
  check?: boolean;
  boss?: string;
}): Promise<{ ok: boolean; error?: string }>;
