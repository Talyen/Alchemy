export function serveSourceFrames(
  root: string,
  clips: Record<string, { file: string; frameCount: number; settings: { width: number; height: number; fps: number } }>,
): Promise<{ url: string; close(): Promise<void> }>;
