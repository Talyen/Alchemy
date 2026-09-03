import { DEFAULT_MASTER_VOLUME_PCT, DEFAULT_MUSIC_VOLUME_PCT, DEFAULT_SFX_VOLUME_PCT } from "./game-constants";

interface AudioRuntimeState {
  muted: boolean;
  hostForcesMute: boolean;
  sfxVolume: number;
  musicVolume: number;
  masterVolume: number;
  currentMusic: HTMLAudioElement | null;
  currentMusicKey: string | null;
  lastPlayedAt: Map<string, number>;
}

export const audioState: AudioRuntimeState = {
  muted: false,
  hostForcesMute: false,
  sfxVolume: DEFAULT_SFX_VOLUME_PCT / 100,
  musicVolume: DEFAULT_MUSIC_VOLUME_PCT / 100,
  masterVolume: DEFAULT_MASTER_VOLUME_PCT / 100,
  currentMusic: null,
  currentMusicKey: null,
  lastPlayedAt: new Map(),
};
