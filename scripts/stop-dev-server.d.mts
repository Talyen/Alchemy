export function isProjectOwnedCommandLine(commandLine: string, projectRoot: string, platform?: NodeJS.Platform): boolean;

export function stopOwnedListeners(options: {
  port: number;
  projectRoot: string;
  platform: NodeJS.Platform;
  getListeningPids: (port: number) => Promise<number[]>;
  getCommandLine: (pid: number) => Promise<string>;
  stopPid: (pid: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void>;

export function stopDevServer(options?: { port?: number; projectRoot?: string }): Promise<void>;
