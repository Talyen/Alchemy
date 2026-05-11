// Shared mutable audio runtime state for SFX and streamed music modules.
// Depends on audio tuning constants.
// Used only by the audio implementation modules so public callers keep importing from lib/audio.
import { DEFAULT_MUSIC_VOLUME } from "./game-constants";

export const audioState = {
  context: null as AudioContext | null,
  masterGain: null as GainNode | null,
  muted: false,
  sfxVolume: 0.35,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  masterVolume: 1,
  currentMusic: null as HTMLAudioElement | null,
  currentMusicKey: null as string | null,
};
