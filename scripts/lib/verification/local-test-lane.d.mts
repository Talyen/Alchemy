export function acquireLocalTestLane(port?: number): Promise<{ port: number; release: () => Promise<void> }>;
export function usesLocalTestLane(command: string, args: string[]): boolean;
export function isInteractiveTestCommand(args: string[]): boolean;
