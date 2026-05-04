import { DEFAULT_MUSIC_VOLUME, MASTER_GAIN, MUSIC_BASE_PATH } from "./game-constants";

// Programmatic audio synthesis — no audio files needed. Every sound is generated
// at runtime using the Web Audio API oscillators and noise buffers. This keeps
// the build small and lets us tweak sounds without asset pipeline changes.
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let isInitialized = false;

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

// Physical damage sounds use sawtooth/square oscillators with rapid frequency
// drops — they mimic a "thud" or "slash" without samples. Variant 0 is the
// default slash sound, played on card play. Variants 2 and 5 use filtered noise
// for a more percussive feel.
type SoundVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

function playPhysicalSound(variant: SoundVariant) {
  const sounds: Record<SoundVariant, () => void> = {
    0: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15); },
    1: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(150, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.18, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); },
    2: () => { const ctx = getAudioContext(); const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) { data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02)); } noise.buffer = buffer; const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(2000, ctx.currentTime); const gain = ctx.createGain(); gain.gain.setValueAtTime(0.25, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); noise.connect(filter); filter.connect(gain); gain.connect(masterGain!); noise.start(ctx.currentTime); },
    3: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08); gain.gain.setValueAtTime(0.22, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08); },
    4: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(250, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1); osc2.type = 'square'; osc2.frequency.setValueAtTime(100, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.1); },
    5: () => { const ctx = getAudioContext(); const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) { data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015)); } noise.buffer = buffer; const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.setValueAtTime(500, ctx.currentTime); const gain = ctx.createGain(); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); noise.connect(filter); filter.connect(gain); gain.connect(masterGain!); noise.start(ctx.currentTime); },
    6: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, ctx.currentTime); osc.frequency.setValueAtTime(120, ctx.currentTime + 0.05); osc.frequency.setValueAtTime(80, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.18, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12); },
    7: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(200, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.06); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06); },
    8: () => { const ctx = getAudioContext(); const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) { data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03)); } noise.buffer = buffer; const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(1500, ctx.currentTime); const gain = ctx.createGain(); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); noise.connect(filter); filter.connect(gain); gain.connect(masterGain!); noise.start(ctx.currentTime); },
    9: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(400, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); },
  };
  sounds[variant]();
}

// Heal sounds use ascending sine oscillators (a rising "ding") to feel restorative.
// Multiple variants provide variety across different heal sources.
function playHealSound(variant: SoundVariant) {
  const sounds: Record<SoundVariant, () => void> = {
    0: () => { const ctx = getAudioContext(); const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(400, ctx.currentTime); osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15); osc1.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.25); osc2.type = 'sine'; osc2.frequency.setValueAtTime(600, ctx.currentTime + 0.05); osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.25); osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.25); },
    1: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(500, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); },
    2: () => { const ctx = getAudioContext(); const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc1.type = 'triangle'; osc1.frequency.setValueAtTime(450, ctx.currentTime); osc1.frequency.setValueAtTime(600, ctx.currentTime + 0.08); osc1.frequency.setValueAtTime(750, ctx.currentTime + 0.16); osc2.type = 'sine'; osc2.frequency.setValueAtTime(900, ctx.currentTime + 0.08); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.2); osc2.start(ctx.currentTime + 0.08); osc2.stop(ctx.currentTime + 0.2); },
    3: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05); osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15); },
    4: () => { const ctx = getAudioContext(); const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(350, ctx.currentTime); osc2.type = 'triangle'; osc2.frequency.setValueAtTime(700, ctx.currentTime + 0.06); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.18); osc2.start(ctx.currentTime + 0.06); osc2.stop(ctx.currentTime + 0.18); },
    5: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(550, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08); },
    6: () => { const ctx = getAudioContext(); const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(480, ctx.currentTime); osc1.frequency.setValueAtTime(640, ctx.currentTime + 0.1); osc1.frequency.setValueAtTime(800, ctx.currentTime + 0.2); osc2.type = 'sine'; osc2.frequency.setValueAtTime(960, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.25); osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.25); },
    7: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(700, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.12); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12); },
    8: () => { const ctx = getAudioContext(); const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain(); osc1.type = 'triangle'; osc1.frequency.setValueAtTime(400, ctx.currentTime); osc2.type = 'sine'; osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.04); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain!); osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.15); osc2.start(ctx.currentTime + 0.04); osc2.stop(ctx.currentTime + 0.15); },
    9: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(520, ctx.currentTime); osc.frequency.setValueAtTime(780, ctx.currentTime + 0.06); osc.frequency.setValueAtTime(520, ctx.currentTime + 0.12); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18); },
  };
  sounds[variant]();
}

// UI sounds are short clicks and pops (sine/square bursts under 100ms) that
// provide tactile feedback for menu interactions without being intrusive.
function playUISound(variant: SoundVariant) {
  const sounds: Record<SoundVariant, () => void> = {
    0: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05); },
    1: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.03); osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08); gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08); },
    2: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(1000, ctx.currentTime); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.03); },
    3: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(1200, ctx.currentTime); gain.gain.setValueAtTime(0.06, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.02); },
    4: () => { const ctx = getAudioContext(); const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) { data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005)); } noise.buffer = buffer; const gain = ctx.createGain(); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02); noise.connect(gain); gain.connect(masterGain!); noise.start(ctx.currentTime); },
    5: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(900, ctx.currentTime); osc.frequency.setValueAtTime(700, ctx.currentTime + 0.04); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06); },
    6: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(500, ctx.currentTime); osc.frequency.setValueAtTime(750, ctx.currentTime + 0.02); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04); },
    7: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.setValueAtTime(600, ctx.currentTime + 0.03); gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04); },
    8: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(1100, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04); },
    9: () => { const ctx = getAudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(700, ctx.currentTime); gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03); osc.connect(gain); gain.connect(masterGain!); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.03); },
  };
  sounds[variant]();
}

// ============= Public API =============

export function playSound(category: SoundCategory) {
  if (isMuted) return;
  resumeContext();

  switch (category) {
    case 'damage': playPhysicalSound(0); break;
    case 'beneficial': playHealSound(0); break;
    case 'ui': playUISound(0); break;
  }
}

// Public convenience wrappers — each maps to a sound category + variant.
type SoundCategory = 'damage' | 'beneficial' | 'ui';

export function playUIClick() { playSound('ui'); }
export function playDamage() { playSound('damage'); }
export function playBuff() { playSound('beneficial'); }

// Victory plays an ascending C-E-G-C arpeggio (major chord). The 120ms note
// spacing creates a classic "level up" feel.
export function playVictory() {
  if (isMuted) return;
  resumeContext();
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.4);
  });
}

// Defeat plays a descending G-F-E-D sequence (downward scale step) to signal
// loss. Each note is shorter and quieter than victory to feel somber.
export function playDefeat() {
  if (isMuted) return;
  resumeContext();
  const ctx = getAudioContext();
  const notes = [392, 349.23, 329.63, 293.66];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(ctx.currentTime + i * 0.2);
    osc.stop(ctx.currentTime + i * 0.2 + 0.35);
  });
}

// Music is streamed from MP3 files. Multiple tracks per theme provide variety.
// Tracks are randomly selected each time music starts.
const musicBase = import.meta.env.BASE_URL + MUSIC_BASE_PATH;

const musicTracks: Record<string, string[]> = {
  menu: ["Menu 1.mp3", "Menu 2.mp3"],
  knight: ["Knight 1.mp3", "Knight 2.mp3"],
  rogue: ["Rogue 1.mp3", "Rogue 2.mp3"],
  wizard: ["Wizard 1.mp3", "Wizard 2.mp3"],
};

let currentMusic: HTMLAudioElement | null = null;
let musicVolume = DEFAULT_MUSIC_VOLUME;

export function playMusic(key: string) {
  stopMusic();
  const tracks = musicTracks[key];
  if (!tracks) return;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  currentMusic = new Audio(musicBase + track);
  currentMusic.loop = true;
  currentMusic.volume = musicVolume;
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
