export interface ReviewAudio {
  volume: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
}
export function createReviewPlayer(options: {
  createAudio(url: string): ReviewAudio;
  schedule(callback: () => void, ms: number): unknown;
  cancel(timer: unknown): void;
  onStatus(message: string): void;
  readVolume(): number;
}): {
  play(url: string, title: string): void;
  sequence(
    steps: Array<{ at: number; duration: number; url: string; title: string }>,
    repetitions?: number,
  ): Promise<void>;
  stop(): void;
  syncVolume(): void;
};
