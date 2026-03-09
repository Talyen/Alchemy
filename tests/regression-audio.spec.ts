import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
      __nextAudioId?: number
    }

    w.__audioProbe = []
    w.__nextAudioId = 1

    const originalPlay = HTMLMediaElement.prototype.play
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.play = function (...args: Parameters<typeof originalPlay>) {
      const src = this.currentSrc || this.getAttribute('src') || ''
      if (!(this as HTMLMediaElement & { __audioId?: number }).__audioId) {
        ;(this as HTMLMediaElement & { __audioId?: number }).__audioId = w.__nextAudioId
        w.__nextAudioId = (w.__nextAudioId ?? 1) + 1
      }
      const id = (this as HTMLMediaElement & { __audioId?: number }).__audioId ?? 0
      ;(this as HTMLMediaElement & { __isPlaying?: boolean }).__isPlaying = true
      w.__audioProbe?.push({ id, action: 'play', src })
      return Promise.resolve()
    }

    HTMLMediaElement.prototype.pause = function (...args: Parameters<typeof originalPause>) {
      ;(this as HTMLMediaElement & { __isPlaying?: boolean }).__isPlaying = false
      const src = this.currentSrc || this.getAttribute('src') || ''
      const id = (this as HTMLMediaElement & { __audioId?: number }).__audioId ?? 0
      w.__audioProbe?.push({ id, action: 'pause', src })
      return originalPause.apply(this, args)
    }
  })
})

async function startKnightRun(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: /Knight/i }).first().click()
  await page.waitForTimeout(1000)
}

test('initial main menu load attempts BGM playback', async ({ page }) => {
  await page.goto('/')
  // Allow extra time: async audio-path resolution probes HTTP files from the dev server.
  // This can take ~5-10 seconds on first load (cold cache + file probing).
  await page.waitForTimeout(12000)

  const bgmPlays = await page.evaluate(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
    }
    // src may be a relative path (no leading /) or absolute URL depending on when play() fires
    return (w.__audioProbe ?? []).filter(event => event.action === 'play' && event.src.includes('assets/audio/music/battle/')).length
  })

  expect(bgmPlays).toBeGreaterThan(0)
})

test('background music attempts playback after first interaction', async ({ page }) => {
  await startKnightRun(page)

  const bgmPlays = await page.evaluate(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
    }
    return (w.__audioProbe ?? []).filter(event => event.action === 'play' && event.src.includes('/assets/audio/music/battle/') && !event.src.includes('Fx ')).length
  })

  expect(bgmPlays).toBeGreaterThan(0)
})

test('playing a card attempts real SFX file playback', async ({ page }) => {
  await startKnightRun(page)

  const playableCard = page.locator('button').filter({ hasText: /Deal|Gain|Apply|Heal|Draw|Wish/i }).first()
  await playableCard.click()
  await page.waitForTimeout(1500) // allow async SFX path resolution to complete

  const sfxPlays = await page.evaluate(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
    }
    return (w.__audioProbe ?? []).filter(event => {
      if (event.action !== 'play') return false
      if (!event.src.includes('assets/audio/sfx/')) return false
      return event.src.endsWith('.ogg') || event.src.endsWith('.wav')
    }).length
  })

  expect(sfxPlays).toBeGreaterThan(0)
})

test('music toggle off/on still triggers playable BGM path', async ({ page }) => {
  await startKnightRun(page)

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: /Music On|Music Off/i }).click()
  await page.waitForTimeout(120)
  await page.getByRole('button', { name: /Music On|Music Off/i }).click()
  await page.waitForTimeout(350)

  const bgmPlays = await page.evaluate(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
    }
    return (w.__audioProbe ?? []).filter(event => event.action === 'play' && event.src.includes('/assets/audio/music/battle/') && !event.src.includes('Fx ')).length
  })

  expect(bgmPlays).toBeGreaterThan(0)
})

test('rapid music toggles never leave overlapping BGM tracks', async ({ page }) => {
  await startKnightRun(page)

  const openMenu = async () => {
    await page.getByRole('button', { name: 'Open main menu' }).click()
  }

  const toggleMusic = async () => {
    await page.getByRole('button', { name: /Music On|Music Off/i }).click()
  }

  await openMenu()
  for (let i = 0; i < 6; i++) {
    await toggleMusic()
    await page.waitForTimeout(60)
  }

  // Make sure final state is music ON for overlap detection.
  const menuLabel = await page.getByRole('button', { name: /Music On|Music Off/i }).textContent()
  if ((menuLabel ?? '').includes('Off')) {
    await toggleMusic()
  }

  // Allow fade transitions to complete.
  await page.waitForTimeout(1200)

  const activeBgmCount = await page.evaluate(() => {
    const w = window as typeof window & {
      __audioProbe?: Array<{ id: number; action: 'play' | 'pause'; src: string }>
    }
    const isBattleBgm = (src: string) => src.includes('/assets/audio/music/battle/') && !src.includes('/assets/audio/sfx/')
    const latestState = new Map<number, { playing: boolean; src: string }>()
    for (const event of w.__audioProbe ?? []) {
      if (!event.id) continue
      latestState.set(event.id, { playing: event.action === 'play', src: event.src })
    }
    let active = 0
    for (const state of latestState.values()) {
      if (state.playing && isBattleBgm(state.src)) active += 1
    }
    return active
  })

  expect(activeBgmCount).toBeLessThanOrEqual(1)
})
