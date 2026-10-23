export function acquireExclusivePort(
  port: number,
  options: {
    label: string;
    timeoutMs?: number | null;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
    canAcquire?: () => boolean;
  },
): Promise<{ port: number; release: () => Promise<void> }>;
