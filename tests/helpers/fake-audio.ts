/**
 * Stubs the global `Audio` element so tests can observe playback behavior
 * (src, play/pause calls, volume, mute handling).
 *
 * Use for audio playback tests (sfx/music/volume/host/preload). For logic
 * tests that only need audio calls silenced, import `./mock-audio` instead,
 * which blanket-mocks `@/lib/audio` with `vi.fn()`s.
 */
import { vi, type Mock } from "vitest";

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
  oncanplaythrough: (() => void) | null;
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

export function createFakeAudioElement(src = "", options: FakeAudioOptions = {}): FakeAudioElement {
  const element: FakeAudioElement = {
    src,
    volume: 1,
    muted: false,
    preload: "",
    currentTime: 0,
    loop: false,
    paused: true,
    onended: null,
    onerror: null,
    oncanplaythrough: null,
    play: vi.fn(() => {
      if (options.rejectPlay) return Promise.reject(new Error("play rejected"));
      element.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      element.paused = true;
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    canPlayType: vi.fn(() => options.canPlayTypeResult ?? "maybe"),
  };
  options.onCreate?.(element);
  return element;
}

export function installFakeAudio(options: FakeAudioOptions = {}): void {
  createdFakeAudio.length = 0;
  vi.stubGlobal(
    "Audio",
    class {
      constructor(src?: string) {
        const element = createFakeAudioElement(src, options);
        createdFakeAudio.push(element);
        return element;
      }
    },
  );
}
