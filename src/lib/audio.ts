// Public audio facade for game SFX, music, volume, mute, and preloading.
// Depends on focused audio implementation modules.
// Used by controllers/App/screens so call sites do not need to know audio internals.
export { preloadAllSounds, preloadSounds, resumeAudioContext } from "./audio-buffer-cache";
export { playMusic, playMusicImmediate } from "./audio-music";
export {
  playBattleEvent,
  playCardSound,
  playDefeat,
  playEnemyAttack,
  playGoldGain,
  playGoldSpend,
  playUISound,
  playVictory,
  stopAllSfx,
} from "./audio-sfx";
export { setMasterVolume, setMusicVolume, setMuted, setSfxVolume } from "./audio-volume";
