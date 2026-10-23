export function acquireLocalTestLane(
  port?: number,
  options?: {
    timeoutMs?: number | null;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
  },
): Promise<{ port: number; release: () => Promise<void> }>;
export function usesLocalTestLane(command: string, args: string[]): boolean;
export function isInteractiveTestCommand(args: string[]): boolean;

export function testResourceClass(command: string, args: string[]): "focused" | "broad";
export function acquireTestResources(
  command: string,
  args: string[],
  cwd: string,
  options?: {
    directory?: string;
    broadPort?: number;
    focusedPort?: number;
    timeoutMs?: number | null;
    signal?: AbortSignal;
    onWait?: (message: string) => void;
  },
): Promise<{ kind: "focused" | "broad"; release: () => Promise<void> }>;
export function testResourceStatus(directory?: string): Array<{
  ticket?: string;
  pid: number;
  cwd: string;
  kind: "focused" | "broad";
  port: number;
  command: string[];
  since: string;
  state: "active" | "waiting";
}>;
