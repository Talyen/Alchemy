export function acquireExclusivePort(
  port: number,
  options: {
    label: string;
    timeoutMs?: number | null;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
    canAcquire?: () => boolean | Promise<boolean>;
    onConnection?: (socket: import("node:net").Socket) => void;
    wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  },
): Promise<{ port: number; release: () => Promise<void> }>;
