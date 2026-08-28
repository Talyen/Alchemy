import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from "./game-constants";

interface AudioRuntimeState {
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  masterVolume: number;
  currentMusic: HTMLAudioElement | null;
  currentMusicKey: string | null;
  lastPlayedAt: Map<string, number>;
}

export const audioState: AudioRuntimeState = {
  muted: false,
  sfxVolume: DEFAULT_SFX_VOLUME,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  masterVolume: 1,
  currentMusic: null,
  currentMusicKey: null,
  lastPlayedAt: new Map(),
};
