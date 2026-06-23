// Shared mutable audio runtime state for SFX and streamed music modules.
// Depends on audio tuning constants.
// Used only by the audio implementation modules so public callers keep importing from lib/audio.
import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from "./game-constants";

interface AudioRuntimeState {
  context: AudioContext | null;
  masterGain: GainNode | null;
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  masterVolume: number;
  audioUnlocked: boolean;
  currentMusic: HTMLAudioElement | null;
  currentMusicKey: string | null;
  lastPlayedAt: Map<string, number>;
}

export const audioState: AudioRuntimeState = {
  context: null,
  masterGain: null,
  muted: false,
  sfxVolume: DEFAULT_SFX_VOLUME,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  masterVolume: 1,
  audioUnlocked: false,
  currentMusic: null,
  currentMusicKey: null,
  lastPlayedAt: new Map(),
};
