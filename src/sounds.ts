// simple custom audio helper using Web Audio API
// avoids third‑party libraries, gives low overhead and predictable
// results – no constant static noise or heavy computations.
// plays samples by default with procedural fallbacks.

import { BATTLE_MUSIC_TRACKS } from './audioManifest'

let audioCtx: AudioContext | null = null
export const ensureCtx = () => {
  if (!audioCtx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
    if (Ctor) {
      audioCtx = new Ctor()
    } else {
      return null
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

type SoundSource = string | string[]

const sounds: Record<string, SoundSource> = {
  cardPlay: 'assets/audio/sfx/system/card-play',
  playerHit: 'assets/audio/sfx/combat/player-hit',
  playerHeal: 'assets/audio/sfx/combat/player-heal',
  block: 'assets/audio/sfx/combat/block',
  enemyHit: 'assets/audio/sfx/combat/enemy-hit',
  enemyAttack: 'assets/audio/sfx/combat/enemy-attack',
  burn: 'assets/audio/sfx/status/burn',
  'card-attack': 'assets/audio/sfx/cards/slash',
  'card-skill': 'assets/audio/sfx/cards/defend',
  'card-spell': 'assets/audio/sfx/cards/fireball',
  'card-upgrade': 'assets/audio/sfx/cards/defend',
  'card-heal': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-stab': 'assets/audio/sfx/cards/stab',
  'card-slash': 'assets/audio/sfx/cards/slash',
  'card-defend': 'assets/audio/sfx/cards/defend',
  'card-bash': 'assets/audio/sfx/cards/bash-heavy-wrench',
  'card-plate_mail': 'assets/audio/sfx/cards/plate-mail-cloth',
  'card-anvil': 'assets/audio/sfx/cards/forge-metal-tap',
  'card-health_potion': 'assets/audio/sfx/cards/health-potion-bubble',
  'card-apple': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-bite': 'assets/audio/sfx/cards/gore-splat-stab-poke-03',
  'card-fireball': 'assets/audio/sfx/cards/fireball',
  'card-immolate': 'assets/audio/sfx/cards/immolate',
  'card-gold': 'assets/audio/sfx/cards/gold-coins-medium',
  'card-mana_crystal': 'assets/audio/sfx/cards/mana-crystal-gem',
  'card-mana_berries': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-meat': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-bread': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-wish': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-haste': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-cleanse': 'assets/audio/sfx/cards/fantasy-ui-6',
  'card-poisoned_dagger': 'assets/audio/sfx/cards/gore-splat-stab-poke-03',
  'card-lacerate': 'assets/audio/sfx/cards/gore-splat-stab-poke-03',
  'card-poison_fangs': 'assets/audio/sfx/cards/gore-splat-stab-poke-03',
  'card-bear_trap': 'assets/audio/sfx/cards/gore-splat-stab-poke-03',
  'card-fiery_blade': 'assets/audio/sfx/cards/fireball',
  'card-holy_blade': 'assets/audio/sfx/cards/fireball',
  victory: 'assets/audio/sfx/ui/victory-piano-positive',
  defeat: 'assets/audio/sfx/ui/defeat-piano',
}

const battleBgmPool: SoundSource[] = [...BATTLE_MUSIC_TRACKS]

let bgmElement: HTMLAudioElement | null = null
let bgmFadeInterval: ReturnType<typeof setInterval> | null = null
let bgmTrackToken = 0
let currentBgmKey: string | null = null
let bgmNeedsUserUnmute = false
let lastBattleTrackIndex = -1
const BGM_TARGET_VOLUME = 0.14

type AudioExt = 'ogg' | 'mp3' | 'wav'
const AUDIO_EXT_ORDER: AudioExt[] = ['ogg', 'mp3', 'wav']
const resolvedPathCache = new Map<string, string>()
const resolveInFlight = new Map<string, Promise<string | undefined>>()

function canDecodeExt(ext: AudioExt) {
  const probe = document.createElement('audio')
  if (ext === 'ogg') return probe.canPlayType('audio/ogg; codecs="vorbis"') !== ''
  if (ext === 'mp3') return probe.canPlayType('audio/mpeg') !== ''
  return probe.canPlayType('audio/wav; codecs="1"') !== '' || probe.canPlayType('audio/wav') !== ''
}

function toCandidatePaths(path: string): string[] {
  const match = path.match(/\.(ogg|mp3|wav)$/i)
  if (!match) {
    return AUDIO_EXT_ORDER.filter(canDecodeExt).map(ext => `${path}.${ext}`)
  }
  const ext = match[1].toLowerCase() as AudioExt
  const base = path.slice(0, -ext.length - 1)
  const ordered = AUDIO_EXT_ORDER.filter(canDecodeExt)
  const candidates = ordered.map(nextExt => `${base}.${nextExt}`)
  if (!candidates.includes(path)) {
    candidates.push(path)
  }
  return candidates
}

function sourceKey(source: SoundSource) {
  return Array.isArray(source) ? source.join('|') : source
}

function probeAudioPath(path: string): Promise<boolean> {
  return new Promise(resolve => {
    const audio = new Audio()
    audio.preload = 'metadata'

    const done = (ok: boolean) => {
      audio.removeAttribute('src')
      audio.load()
      resolve(ok)
    }

    audio.onloadedmetadata = () => done(true)
    audio.onerror = () => done(false)
    audio.src = path
  })
}

async function resolvePlayablePath(source: SoundSource | undefined): Promise<string | undefined> {
  if (!source) return undefined
  const key = sourceKey(source)
  if (resolvedPathCache.has(key)) return resolvedPathCache.get(key)
  if (resolveInFlight.has(key)) return resolveInFlight.get(key)

  const task = (async () => {
    const roots = Array.isArray(source) ? source : [source]
    for (const root of roots) {
      const candidates = toCandidatePaths(root)
      for (const candidate of candidates) {
        const ok = await probeAudioPath(candidate)
        if (ok) {
          resolvedPathCache.set(key, candidate)
          return candidate
        }
      }
    }
    return undefined
  })()

  resolveInFlight.set(key, task)
  const resolved = await task
  resolveInFlight.delete(key)
  return resolved
}

function pickRandomBattleTrack(): SoundSource {
  if (battleBgmPool.length <= 1) return battleBgmPool[0]
  let nextIndex = Math.floor(Math.random() * battleBgmPool.length)
  while (nextIndex === lastBattleTrackIndex) {
    nextIndex = Math.floor(Math.random() * battleBgmPool.length)
  }
  lastBattleTrackIndex = nextIndex
  return battleBgmPool[nextIndex]
}

function clearCurrentBGM() {
  if (bgmFadeInterval) {
    clearInterval(bgmFadeInterval)
    bgmFadeInterval = null
  }
  if (!bgmElement) return
  bgmElement.pause()
  bgmElement.currentTime = 0
  bgmElement = null
  currentBgmKey = null
  bgmNeedsUserUnmute = false
}

export const startBGM = (source?: SoundSource) => {
  const selectedSource = source ?? battleBgmPool[0]
  const selectedKey = sourceKey(selectedSource)
  const token = ++bgmTrackToken

  if (bgmElement && currentBgmKey === selectedKey) {
    if (bgmFadeInterval) {
      clearInterval(bgmFadeInterval)
      bgmFadeInterval = null
    }
    bgmElement.play().then(() => {
      if (bgmElement) {
        bgmElement.muted = false
        bgmNeedsUserUnmute = false
      }
    }).catch(() => {})
    return
  }

  clearCurrentBGM()

  resolvePlayablePath(selectedSource).then(resolvedPath => {
    if (!resolvedPath) return
    if (token !== bgmTrackToken) return

    const element = new Audio(resolvedPath)
    bgmElement = element
    currentBgmKey = selectedKey
    element.loop = true
    element.volume = 0

    // Try immediate audible playback first. If autoplay is blocked,
    // fall back to muted playback and unmute on first user interaction.
    element.muted = false
    element.play().then(() => {
      if (token !== bgmTrackToken || bgmElement !== element) return
      bgmNeedsUserUnmute = false
    }).catch(() => {
      if (token !== bgmTrackToken || bgmElement !== element) return
      element.muted = true
      element.play().then(() => {
        if (token !== bgmTrackToken || bgmElement !== element) return
        bgmNeedsUserUnmute = true
      }).catch(() => {})
    })

    let volume = 0
    if (bgmFadeInterval) {
      clearInterval(bgmFadeInterval)
      bgmFadeInterval = null
    }
    bgmFadeInterval = setInterval(() => {
      if (token !== bgmTrackToken || bgmElement !== element) {
        if (bgmFadeInterval) {
          clearInterval(bgmFadeInterval)
          bgmFadeInterval = null
        }
        return
      }
      volume = Math.min(volume + 0.02, BGM_TARGET_VOLUME)
      element.volume = volume
      if (volume >= BGM_TARGET_VOLUME && bgmFadeInterval) {
        clearInterval(bgmFadeInterval)
        bgmFadeInterval = null
      }
    }, 50)
  }).catch(() => {})
}

export const playRandomBattleBGM = () => {
  startBGM(pickRandomBattleTrack())
}

export const ensureRandomBGM = () => {
  if (bgmElement) {
    if (bgmFadeInterval) {
      clearInterval(bgmFadeInterval)
      bgmFadeInterval = null
    }
    if (bgmNeedsUserUnmute || bgmElement.muted) {
      bgmElement.muted = false
      bgmNeedsUserUnmute = false
    }
    bgmElement.play().catch(() => {})
    return
  }
  playRandomBattleBGM()
}

// Stop background music with fade out
export const stopBGM = () => {
  bgmTrackToken += 1
  const element = bgmElement
  if (!element) return

  if (bgmFadeInterval) {
    clearInterval(bgmFadeInterval)
    bgmFadeInterval = null
  }

  let volume = element.volume
  bgmFadeInterval = setInterval(() => {
    volume = Math.max(volume - 0.02, 0)
    element.volume = volume
    if (volume <= 0) {
      if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval)
        bgmFadeInterval = null
      }
      element.pause()
      if (bgmElement === element) {
        bgmElement = null
        currentBgmKey = null
      }
    }
  }, 50)
}

// cache of preloaded audio elements for instant playback
const audioCache = new Map<string, HTMLAudioElement>()
const missingAudioWarnings = new Set<string>()
const missingCardMappingWarnings = new Set<string>()
let activeGameplaySfxCount = 0
let pendingOutcomeSfx: { source: SoundSource | undefined; volume: number; label: string } | null = null

function warnMissingAudio(label: string, detail: string) {
  const key = `${label}:${detail}`
  if (missingAudioWarnings.has(key)) return
  missingAudioWarnings.add(key)
  console.warn(`[audio] ${label} ${detail}`)
}

function tryPlayPendingOutcome() {
  if (activeGameplaySfxCount !== 0) return
  if (!pendingOutcomeSfx) return
  const next = pendingOutcomeSfx
  pendingOutcomeSfx = null
  playSampleIfAvailable(next.source, next.volume, next.label, false)
}

function trackGameplaySfx(audio: HTMLAudioElement) {
  let active = true
  activeGameplaySfxCount += 1

  const finish = () => {
    if (!active) return
    active = false
    audio.removeEventListener('ended', finish)
    audio.removeEventListener('pause', finish)
    audio.removeEventListener('error', finish)
    activeGameplaySfxCount = Math.max(0, activeGameplaySfxCount - 1)
    tryPlayPendingOutcome()
  }

  audio.addEventListener('ended', finish, { once: true })
  audio.addEventListener('pause', finish, { once: true })
  audio.addEventListener('error', finish, { once: true })
}

// preload audio file on card hover for instant playback (called from Hand.tsx on hover)
export const preloadSound = (cardId?: string, cardType?: string) => {
  const source = cardId && cardType ? getCardSoundSource(cardId, cardType) : sounds.cardPlay
  if (!source) return
  const key = sourceKey(source)
  if (audioCache.has(key)) return

  resolvePlayablePath(source).then(resolvedPath => {
    if (!resolvedPath || audioCache.has(key)) return
    const audio = new Audio(resolvedPath)
    audio.preload = 'auto'
    audioCache.set(key, audio)
  }).catch(() => {})
}

// helper to play sample files with instant playback from cache
const playSampleIfAvailable = (source: SoundSource | undefined, volume = 0.15, label = 'sound', countAsGameplay = true) => {
  if (!source) {
    warnMissingAudio(label, '(no source mapped)')
    return
  }
  const key = sourceKey(source)

  const cached = audioCache.get(key)
  if (cached) {
    cached.pause()
    cached.volume = volume
    cached.currentTime = 0
    cached.play().then(() => {
      if (countAsGameplay) trackGameplaySfx(cached)
    }).catch(() => {})
    return
  }

  resolvePlayablePath(source).then(resolvedPath => {
    if (!resolvedPath) {
      warnMissingAudio(label, `(missing file for source: ${key})`)
      return
    }
    const audio = new Audio(resolvedPath)
    audio.volume = volume
    audio.play().then(() => {
      if (countAsGameplay) trackGameplaySfx(audio)
    }).catch(() => {})
  }).catch(() => {})
}

function queueOutcomeSfx(source: SoundSource | undefined, volume: number, label: string) {
  if (activeGameplaySfxCount > 0) {
    pendingOutcomeSfx = { source, volume, label }
    return
  }
  playSampleIfAvailable(source, volume, label, false)
}

// resolve sound path by card-id, then card-type, then default
function getCardSoundSource(cardId: string, cardType: string): SoundSource | undefined {
  return (
    (sounds as any)[`card-${cardId}`] ||
    (sounds as any)[`card-${cardType}`] ||
    (sounds as any).cardPlay
  )
}

// ────────────────────────────────────────────────────────────────────────────
// effect wrappers – these are called by game components

export const playCardPlay = (cardId?: string, cardType?: string) => {
  if (cardId && !(sounds as any)[`card-${cardId}`] && !missingCardMappingWarnings.has(cardId)) {
    missingCardMappingWarnings.add(cardId)
    console.warn(`[audio] card '${cardId}' has no dedicated SFX mapping; using type/default`)
  }
  const source = cardId && cardType ? getCardSoundSource(cardId, cardType) : sounds.cardPlay
  playSampleIfAvailable(source, 0.15, `card:${cardId ?? cardType ?? 'unknown'}`)
}

export const playPlayerHit = () => {
  playSampleIfAvailable(sounds.playerHit, 0.15, 'player-hit')
}

export const playPlayerHeal = () => {
  playSampleIfAvailable(sounds.playerHeal, 0.15, 'player-heal')
}

export const playBlock = () => {
  playSampleIfAvailable(sounds.block, 0.1, 'block')
}

export const playEnemyHit = () => {
  playSampleIfAvailable(sounds.enemyHit, 0.15, 'enemy-hit')
}

export const playEnemyAttack = () => {
  playSampleIfAvailable(sounds.enemyAttack, 0.15, 'enemy-attack')
}

export const playBurn = () => {
  playSampleIfAvailable(sounds.burn, 0.15, 'burn')
}

export const playGoldGain = () => {
  playSampleIfAvailable(sounds['card-gold'], 0.18, 'gold-gain')
}

export const playVulnerable = () => {
  // no asset mapped, stays silent
}

export const playVictory = () => {
  queueOutcomeSfx(sounds.victory, 0.22, 'victory')
}

export const playDefeat = () => {
  queueOutcomeSfx(sounds.defeat, 0.22, 'defeat')
}

export const playTurnStart = () => {
  // no asset mapped, stays silent
}

export const playManaSpend = () => {
  // no asset mapped, stays silent
}

// ────────────────────────────────────────────────────────────────────────────
// sample/demo utilities (for testing or generating custom audio)

/**
 * Return a data‑URL containing a WAV file of a sine tone. Useful for
 * examining a premade asset or playing from an <audio> element.
 */
export function generateToneDataUrl(freq: number, duration = 0.2) {
  const ctx = ensureCtx()!
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
  }

  // encode to WAV (mono, 16‑bit)
  const wav = encodeWAV(buffer)
  const blob = new Blob([wav], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

/**
 * play a premade URL or a data URL
 */
export function playSample(url: string) {
  const audio = new Audio(url)
  audio.play().catch(() => {})
}

// helper: naive WAV encoder, single channel 16‑bit
function encodeWAV(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const samples = buffer.getChannelData(0)
  const bufferLength = 44 + samples.length * 2
  const view = new DataView(new ArrayBuffer(bufferLength))

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  let pos = 0
  writeString(pos, 'RIFF'); pos += 4
  view.setUint32(pos, 36 + samples.length * 2, true); pos += 4
  writeString(pos, 'WAVE'); pos += 4
  writeString(pos, 'fmt '); pos += 4
  view.setUint32(pos, 16, true); pos += 4
  view.setUint16(pos, 1, true); pos += 2
  view.setUint16(pos, numChannels, true); pos += 2
  view.setUint32(pos, sampleRate, true); pos += 4
  view.setUint32(pos, sampleRate * numChannels * 2, true); pos += 4
  view.setUint16(pos, numChannels * 2, true); pos += 2
  view.setUint16(pos, 16, true); pos += 2
  writeString(pos, 'data'); pos += 4
  view.setUint32(pos, samples.length * 2, true); pos += 4

  // write PCM samples
  for (let i = 0; i < samples.length; i++, pos += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return view
}
