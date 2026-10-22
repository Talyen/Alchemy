export function acquireExclusivePort(
  port: number,
  options: {
    label: string;
    timeoutMs?: number | null;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
  },
): Promise<{ port: number; release: () => Promise<void> }>;
