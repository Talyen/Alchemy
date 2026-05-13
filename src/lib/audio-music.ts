// Streaming MP3 music playback and transitions.
// Depends on shared audio state and music path constants.
// Used by App/controllers through the public lib/audio facade.
import { MUSIC_BASE_PATH } from "./game-constants";
import { audioState } from "./audio-state";
import { pickRandom } from "./utils";

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;
const FADE_OUT_DURATION = 300;
const FADE_IN_DELAY = 600;
const FADE_IN_DURATION = 1400;
const MUSIC_MASTER_GAIN = 0.5;

const musicTracks: Record<string, string[]> = {
  menu: ["Menu 1.mp3"],
  battle: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3"],
};

// Applies all active volume layers to a streaming music element.
export function applyMusicVolume(el: HTMLAudioElement) {
  el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN;
}

// Stops and clears the current HTML audio element before starting a different track.
function replaceCurrentTrack(track: string, volume: number) {
  if (audioState.currentMusic) {
    audioState.currentMusic.pause();
    audioState.currentMusic.currentTime = 0;
    audioState.currentMusic = null;
  }
  const el = new Audio(musicBase + track);
  el.loop = true;
  el.volume = volume;
  el.muted = audioState.muted;
  el.play().catch(() => {});
  audioState.currentMusic = el;
  return el;
}

// Starts a track with the standard delayed fade-in used for scene transitions.
function startTrack(track: string) {
  const el = replaceCurrentTrack(track, 0);
  const startTime = performance.now();

  function fadeIn() {
    const elapsed = performance.now() - startTime;
    if (elapsed < FADE_IN_DELAY) return void requestAnimationFrame(fadeIn);
    const t = Math.min(1, (elapsed - FADE_IN_DELAY) / FADE_IN_DURATION);
    if (audioState.currentMusic === el) {
      el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * t;
    }
    if (t < 1) requestAnimationFrame(fadeIn);
  }

  requestAnimationFrame(fadeIn);
}

// Starts a track at full configured volume for resume/startup cases without transition lag.
function startTrackImmediate(track: string) {
  replaceCurrentTrack(track, audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN);
}

// Starts a keyed music group immediately, choosing one registered track at random.
export function playMusicImmediate(key: string) {
  audioState.currentMusicKey = key;
  const track = pickRandom(musicTracks[key] ?? []);
  if (!track) return;
  startTrackImmediate(track);
}

// Crossfades to a keyed music group unless that group is already active.
export function playMusic(key: string) {
  if (key === audioState.currentMusicKey) {
    if (audioState.currentMusic?.paused) {
      audioState.currentMusic.play().catch(() => {});
    }
    return;
  }
  audioState.currentMusicKey = key;
  const track = pickRandom(musicTracks[key] ?? []);
  if (!track) return;
  const selectedTrack = track;

  if (audioState.currentMusic) {
    const old = audioState.currentMusic;
    const oldVol = old.volume;
    const startTime = performance.now();

    function fadeOut() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / FADE_OUT_DURATION);
      old.volume = Math.max(0, oldVol * (1 - t));
      if (t < 1) return void requestAnimationFrame(fadeOut);
      old.pause();
      audioState.currentMusic = null;
      startTrack(selectedTrack);
    }

    return void requestAnimationFrame(fadeOut);
  }

  startTrack(selectedTrack);
}
