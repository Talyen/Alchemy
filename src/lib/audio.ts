// Public audio facade for game SFX, music, volume, mute, and preloading.
// Depends on focused audio implementation modules.
// Used by controllers/App/screens so call sites do not need to know audio internals.
export { preloadAllSounds, preloadSounds } from "./audio-buffer-cache";
export { playMusic, playMusicImmediate, stopMusic } from "./audio-music";
export {
  playBattleEvent,
  playBuff,
  playCardSound,
  playDamage,
  playDefeat,
  playEnemyAttack,
  playGoldGain,
  playGoldSpend,
  playUISound,
  playVictory,
} from "./audio-sfx";
export {
  getMasterVolume,
  getMusicVolume,
  getMuted,
  getSfxVolume,
  setMasterVolume,
  setMusicVolume,
  setMuted,
  setSfxVolume,
} from "./audio-volume";
