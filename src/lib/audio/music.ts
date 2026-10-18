import { isNonPlayerAudioHost } from "./host";
import { audioUrl } from "./url";
import { MUSIC_BASE_PATH } from "../game-constants";
import { audioState } from "./state";
import { createMusicPlayer } from "./music-player";

export { allRegisteredMusicFiles, getBossMusicKey } from "./music-catalog";

const musicBase = audioUrl(MUSIC_BASE_PATH);
const player = createMusicPlayer({
  createElement: (file) => new Audio(musicBase + file),
  selectFile: (files) => files[Math.floor(Math.random() * files.length)],
  readSettings: () => audioState,
  canPlay: () => !isNonPlayerAudioHost(),
  now: () => performance.now(),
  schedule: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  cancel: (timer) => clearInterval(timer),
  reportFailure: (message) => console.warn(message),
});

export const {
  readMusicPlayback,
  syncMusicSettings,
  isMusicPaused,
  playMusicImmediate,
  playMusic,
  pauseAllMusic,
  invalidateCacheForKey,
  previewBossMusic,
  endBossPreview,
  reset: resetMusicRuntimeForTests,
} = player;
