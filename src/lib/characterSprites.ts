const CHARACTER_IDLE_FPS = 8

const KNIGHT_IDLE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/knight-idle-f${i}.png`)
const ROGUE_IDLE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/rogue-idle-f${i}.png`)
const WIZARD_IDLE_FRAMES = Array.from({ length: 4 }, (_, i) => `assets/wizard-idle-f${i}.png`)

const CHARACTER_IDLE_FRAMES_BY_ID: Record<string, string[]> = {
  knight: KNIGHT_IDLE_FRAMES,
  rogue: ROGUE_IDLE_FRAMES,
  wizard: WIZARD_IDLE_FRAMES,
}

export { CHARACTER_IDLE_FPS }

export function getCharacterIdleFrames(characterId: string): string[] {
  return CHARACTER_IDLE_FRAMES_BY_ID[characterId] ?? KNIGHT_IDLE_FRAMES
}
