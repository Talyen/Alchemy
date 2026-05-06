import { battleEventSounds, cardSounds, enemyAttackSounds, stingerSounds, uiSounds } from "./sound-registry";
import { DEFAULT_MUSIC_VOLUME, MASTER_GAIN, MUSIC_BASE_PATH } from "./game-constants";

// Real-asset audio engine — loads OGG files from public/sounds/ as decoded Web Audio
// buffers. Sounds are lazy-loaded on first play and cached for instant reuse. Music
// continues to stream via HTMLAudioElement (MP3) because looping background tracks
// are large and don't benefit from buffer caching.
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let isInitialized = false;
let sfxVolume = 0.35;
let musicVolume = DEFAULT_MUSIC_VOLUME;

const soundCache = new Map<string, AudioBuffer>();
const loadingPromises = new Map<string, Promise<AudioBuffer | null>>();

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = MASTER_GAIN;
  }
  return audioContext;
}

function resumeContext() {
  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }
}

function getSoundUrl(name: string): string {
  return import.meta.env.BASE_URL + "sounds/" + name;
}

// Loads a single sound file into a decoded AudioBuffer. Cached forever after first
// decode so repeated plays (e.g. sword swings) are instant.
async function loadSoundBuffer(name: string): Promise<AudioBuffer | null> {
  if (soundCache.has(name)) {
    return soundCache.get(name)!;
  }

  if (loadingPromises.has(name)) {
    return loadingPromises.get(name)!;
  }

  const promise = (async () => {
    try {
      const response = await fetch(getSoundUrl(name));
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
      soundCache.set(name, buffer);
      return buffer;
    } catch {
      return null;
    }
  })();

  loadingPromises.set(name, promise);
  return promise;
}

// Pre-loads a list of sounds into the buffer cache so first playback is instant.
// Fire-and-forget: promises are tracked internally so playBuffer shares them.
export function preloadSounds(names: string[]) {
  names.forEach((name) => loadSoundBuffer(name));
}

// Eagerly loads every registered sound asset. Call once on app start so the
// cache is hot before the player interacts.
export function preloadAllSounds() {
  const names = new Set<string>([
    ...Object.values(cardSounds).flat(),
    ...Object.values(enemyAttackSounds).flat(),
    ...Object.values(battleEventSounds),
    ...Object.values(uiSounds),
    ...Object.values(stingerSounds),
  ]);
  preloadSounds([...names]);
}

// Core playback helper. Creates a one-shot buffer source with a per-play gain node
// so volume can be tweaked per sound without mutating cached buffers.
function playBuffer(name: string, volume = 1) {
  if (isMuted) return;
  resumeContext();

  loadSoundBuffer(name).then((buffer) => {
    if (!buffer) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume * sfxVolume;
    source.connect(gain);
    gain.connect(masterGain!);
    source.start();
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============= Public SFX API =============

export function playCardSound(cardId: string) {
  const sounds = cardSounds[cardId];
  if (!sounds) return;
  playBuffer(pickRandom(sounds));
}

export function playEnemyAttack(enemyId: string) {
  const sounds = enemyAttackSounds[enemyId];
  if (!sounds) return;
  playBuffer(pickRandom(sounds));
}

export function playBattleEvent(event: keyof typeof battleEventSounds) {
  const name = battleEventSounds[event];
  playBuffer(name);
}

export function playUISound(event: keyof typeof uiSounds) {
  const name = uiSounds[event];
  // UI sounds sit quieter than combat so they don't compete.
  playBuffer(name, 0.6);
}

export function playVictory() {
  playBuffer(stingerSounds.victory, 0.8);
}

export function playDefeat() {
  playBuffer(stingerSounds.defeat, 0.7);
}

// Legacy convenience wrappers — these map old call sites onto the new typed events
// so we don't have to rewrite every import site in one sweep.
export function playDamage() { playBattleEvent("enemyHit"); }
export function playBuff() { playBattleEvent("playerHeal"); }

// ============= Volume / Mute =============

export function setMuted(value: boolean) {
  isMuted = value;
  if (currentMusic) {
    currentMusic.muted = isMuted;
  }
}

export function getMuted(): boolean {
  return isMuted;
}

export function setSfxVolume(value: number) {
  sfxVolume = Math.max(0, Math.min(1, value));
}

export function getSfxVolume(): number {
  return sfxVolume;
}

// ============= Music (streaming MP3) =============

const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

const musicTracks: Record<string, string[]> = {
  menu: ["Menu 1.mp3", "Menu 2.mp3"],
  knight: ["Knight 1.mp3", "Knight 2.mp3"],
  rogue: ["Rogue 1.mp3", "Rogue 2.mp3"],
  wizard: ["Wizard 1.mp3", "Wizard 2.mp3"],
};

let currentMusic: HTMLAudioElement | null = null;

export function playMusic(key: string) {
  stopMusic();
  const tracks = musicTracks[key];
  if (!tracks) return;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  currentMusic = new Audio(musicBase + track);
  currentMusic.loop = true;
  currentMusic.volume = musicVolume;
  currentMusic.muted = isMuted;
  currentMusic.play().catch(() => {});
}

export function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

export function setMusicVolume(value: number) {
  musicVolume = Math.max(0, Math.min(1, value));
  if (currentMusic) {
    currentMusic.volume = musicVolume;
  }
}

export function getMusicVolume(): number {
  return musicVolume;
}
