import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { BATTLE_MUSIC_TRACKS } from '../src/audioManifest'
import { CARD_ART_BY_ID } from '../src/cardArt'

function publicPathToFs(assetPath: string) {
  const rel = assetPath.replace(/^\//, '').replaceAll('/', path.sep)
  return path.join(process.cwd(), 'public', rel)
}

test('all card art assets exist and are non-empty', async () => {
  const entries = Object.entries(CARD_ART_BY_ID)
  expect(entries.length).toBeGreaterThan(0)

  for (const [cardId, assetPath] of entries) {
    const fsPath = publicPathToFs(assetPath)
    expect.soft(existsSync(fsPath), `Missing card art for ${cardId}: ${assetPath}`).toBeTruthy()
    if (existsSync(fsPath)) {
      expect.soft(statSync(fsPath).size, `Card art file is empty for ${cardId}: ${assetPath}`).toBeGreaterThan(0)
    }
  }
})

test('all battle music tracks in manifest exist', async () => {
  expect(BATTLE_MUSIC_TRACKS.length).toBeGreaterThan(0)

  for (const track of BATTLE_MUSIC_TRACKS) {
    const fsPath = publicPathToFs(track)
    expect.soft(existsSync(fsPath), `Missing battle music track: ${track}`).toBeTruthy()
  }
})

test('required fallback SFX files exist for card/combat playback', async () => {
  const requiredSfx = [
    '/assets/audio/sfx/system/card-play.ogg',
    '/assets/audio/sfx/combat/player-hit.ogg',
    '/assets/audio/sfx/combat/enemy-hit.ogg',
    '/assets/audio/sfx/combat/block.ogg',
    '/assets/audio/sfx/cards/slash.ogg',
    '/assets/audio/sfx/cards/stab.ogg',
    '/assets/audio/sfx/cards/defend.ogg',
    '/assets/audio/sfx/cards/fireball.ogg',
  ]

  for (const assetPath of requiredSfx) {
    const fsPath = publicPathToFs(assetPath)
    expect.soft(existsSync(fsPath), `Missing required gameplay SFX file: ${assetPath}`).toBeTruthy()
  }
})
