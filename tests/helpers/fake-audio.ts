import { vi, type Mock } from "vitest";
import { audioState } from "@/lib/audio-state";
import { resetHtmlSfxRuntime } from "@/lib/audio-sfx";

export interface FakeAudioElement {
  src: string;
  volume: number;
  muted: boolean;
  preload: string;
  currentTime: number;
  loop: boolean;
  paused: boolean;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: Mock<() => Promise<void>>;
  pause: Mock<() => void>;
  removeAttribute: Mock<(name: string) => void>;
  load: Mock<() => void>;
  canPlayType: Mock<(type: string) => string>;
}

export interface FakeAudioOptions {
  canPlayTypeResult?: string;
  rejectPlay?: boolean;
  onCreate?: (element: FakeAudioElement) => void;
}

export const createdFakeAudio: FakeAudioElement[] = [];

export function lastFakeAudio(): FakeAudioElement | undefined {
  return createdFakeAudio.at(-1);
}

export function soundedFakeAudio(): FakeAudioElement[] {
  return createdFakeAudio.filter((element) => element.src !== "");
}

export function installFakeAudio(options: FakeAudioOptions = {}): void {
  const { canPlayTypeResult = "", rejectPlay = false, onCreate } = options;
  createdFakeAudio.length = 0;
  vi.stubGlobal(
    "Audio",
    class implements FakeAudioElement {
      src = "";
      volume = 1;
      muted = false;
      preload = "";
      currentTime = 0;
      loop = false;
      paused = true;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => {
        if (rejectPlay) return Promise.reject(new Error("play rejected"));
        this.paused = false;
        return Promise.resolve();
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
      removeAttribute = vi.fn();
      load = vi.fn();
      canPlayType = vi.fn(() => canPlayTypeResult);
      constructor(src?: string) {
        this.src = src ?? "";
        createdFakeAudio.push(this);
        onCreate?.(this);
      }
    },
  );
}

export function resetSfxRuntime(): void {
  audioState.muted = false;
  audioState.hostForcesMute = false;
  audioState.lastPlayedAt = new Map();
  resetHtmlSfxRuntime();
}

export function resetMusicState(): void {
  audioState.currentMusic = null;
  audioState.currentMusicKey = null;
}
