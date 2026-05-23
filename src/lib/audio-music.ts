// Streaming MP3 music playback and transitions.
// Depends on shared audio state and music path constants.
// Used by App/controllers through the public lib/audio facade.
import {
  FADE_IN_DELAY,
  FADE_IN_DURATION,
  FADE_OUT_DURATION,
  MUSIC_BASE_PATH,
  MUSIC_MASTER_GAIN,
  MUSIC_KEYS,
} from "./game-constants";
import { audioState } from "./audio-state";
import { pickRandom } from "./utils";

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

// Music player configuration grouping local variables and bounds.
const MUSIC_CONFIG = {
  TRACKS: {
    [MUSIC_KEYS.MENU]: ["Menu 1.mp3", "Menu 2.mp3", "Menu 3.mp3", "Menu 4.mp3"],
    [MUSIC_KEYS.BATTLE]: ["Battle 1.mp3", "Battle 2.mp3", "Battle 3.mp3", "Battle 4.mp3", "Battle 5.mp3"],
  },
  VOLUME_MIN: 0,
} as const;

// Global counter tracking active scene music transitions to prevent concurrent crossfades
// from racing or playing overlapping tracks.
let musicTransitionToken = 0;

// Play wrapper handling browser autoplay blocking policies.
function playElement(el: HTMLAudioElement) {
  el.play().catch(() => {
    console.debug("Music playback blocked until user interaction");
  });
}

// Applies all active volume layers to a streaming music element.
// Volume cascaded: state-music-volume * state-master-volume * constant-music-master-gain.
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
  playElement(el);
  audioState.currentMusic = el;
  return el;
}

// Starts a track with the standard delayed fade-in used for scene transitions.
// Leverages requestAnimationFrame for smooth volume interpolation.
function startTrack(track: string) {
  const el = replaceCurrentTrack(track, MUSIC_CONFIG.VOLUME_MIN);
  const startTime = performance.now();

  function fadeIn() {
    const elapsed = performance.now() - startTime;
    if (elapsed < FADE_IN_DELAY) {
      requestAnimationFrame(fadeIn);
      return;
    }
    const t = Math.min(1, (elapsed - FADE_IN_DELAY) / FADE_IN_DURATION);
    if (audioState.currentMusic === el) {
      el.volume = audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN * t;
    }
    if (t < 1) {
      requestAnimationFrame(fadeIn);
    }
  }

  requestAnimationFrame(fadeIn);
}

// Starts a keyed music group immediately, choosing one registered track at random.
export function playMusicImmediate(key: string) {
  musicTransitionToken += 1;
  audioState.currentMusicKey = key;
  const track = pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? []);
  if (!track) return;

  // Inlined startTrackImmediate logic to reduce indirection.
  replaceCurrentTrack(track, audioState.musicVolume * audioState.masterVolume * MUSIC_MASTER_GAIN);
}

// Handles smooth fade-out interpolation of a track before starting the next one.
// Checks the musicTransitionToken to abort if a new transition has been scheduled.
function fadeOutAndStartTrack(oldTrack: HTMLAudioElement, newTrack: string, transitionToken: number) {
  const oldVol = oldTrack.volume;
  const startTime = performance.now();

  function fadeOut() {
    // If a newer music transition has taken precedence, abort the current animation loop.
    if (transitionToken !== musicTransitionToken) return;

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / FADE_OUT_DURATION);
    oldTrack.volume = Math.max(MUSIC_CONFIG.VOLUME_MIN, oldVol * (1 - t));

    if (t < 1) {
      requestAnimationFrame(fadeOut);
      return;
    }

    oldTrack.pause();
    if (audioState.currentMusic === oldTrack) {
      audioState.currentMusic = null;
    }
    startTrack(newTrack);
  }

  requestAnimationFrame(fadeOut);
}

// Crossfades to a keyed music group unless that group is already active.
export function playMusic(key: string) {
  if (key === audioState.currentMusicKey) {
    if (audioState.currentMusic?.paused) {
      playElement(audioState.currentMusic);
    }
    return;
  }

  const transitionToken = musicTransitionToken + 1;
  musicTransitionToken = transitionToken;
  audioState.currentMusicKey = key;

  const track = pickRandom(MUSIC_CONFIG.TRACKS[key as keyof typeof MUSIC_CONFIG.TRACKS] ?? []);
  if (!track) return;

  if (audioState.currentMusic) {
    fadeOutAndStartTrack(audioState.currentMusic, track, transitionToken);
  } else {
    startTrack(track);
  }
}
