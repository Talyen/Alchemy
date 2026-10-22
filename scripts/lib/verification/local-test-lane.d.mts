export function acquireLocalTestLane(
  port?: number,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
  },
): Promise<{ port: number; release: () => Promise<void> }>;
export function usesLocalTestLane(command: string, args: string[]): boolean;
export function isInteractiveTestCommand(args: string[]): boolean;
