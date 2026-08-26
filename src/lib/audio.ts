// Public audio facade for game SFX, music, volume, mute, and preloading.
// Used by controllers/App/screens so call sites do not need to know audio internals.
export { preloadAllSounds, preloadBattleSounds } from "./audio-preload";
export { isNonPlayerAudioHost } from "./audio-host";
export { getBossMusicKey, invalidateCacheForKey, isMusicPaused, playMusic, playMusicImmediate } from "./audio-music";
export {
  playBattleEvent,
  playCardSound,
  playDefeat,
  playEnemyAttack,
  playGoldGain,
  playGoldSpend,
  playSliceDeath,
  playUISound,
  playVictory,
  stopAllSfx,
} from "./audio-sfx";
export { setMasterVolume, setMusicVolume, setMuted, setSfxVolume } from "./audio-volume";
