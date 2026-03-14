import { expect, test } from '@playwright/test'
import { startKnightRun, waitForCombatReady } from './helpers'

async function openEndRunModal(page: Page) {
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'End Run' }).first().click()
}

async function advanceToNextCombat(page: Page) {
  await page.getByRole('button', { name: 'Open QA menu' }).click()
  await page.getByRole('button', { name: 'Skip Combat' }).click()
  await expect(page.getByText('Victory')).toBeVisible()
  await page.getByRole('button', { name: /Continue/i }).click()
  await expect(page.getByText('Choose a Reward')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText('Choose Destination')).toBeVisible()
  await page.getByRole('button', { name: /Combat|Elite/i }).first().click()
  await waitForCombatReady(page)
}

test('talent screen uses opaque surfaces and shows multiple icons for multi-keyword nodes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Talents' }).click()

  const canvas = page.getByTestId('talent-canvas')
  const holyFlame = page.getByTestId('talent-node-burn_t2_1')

  await expect(canvas).toBeVisible()
  await expect(holyFlame).toBeVisible()

  const canvasMetrics = await canvas.evaluate((node) => {
    const style = getComputedStyle(node as HTMLElement)
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
    }
  })

  const nodeMetrics = await holyFlame.evaluate((node) => {
    const element = node as HTMLElement
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      keywordCount: Number(element.dataset.keywordCount ?? '0'),
      iconCount: element.querySelectorAll('svg').length,
    }
  })

  expect(canvasMetrics.backgroundImage).toBe('none')
  expect(canvasMetrics.backgroundColor.toLowerCase()).not.toBe('transparent')
  expect(nodeMetrics.backgroundColor.toLowerCase()).not.toBe('transparent')
  expect(nodeMetrics.keywordCount).toBe(2)
  expect(nodeMetrics.iconCount).toBe(2)
})

test('ending the first run grants a talent point and uses the updated end-run copy', async ({ page }) => {
  await startKnightRun(page)

  await openEndRunModal(page)
  await expect(page.getByRole('heading', { name: 'End Run' })).toBeVisible()
  await expect(page.getByText('End current run and receive any progression rewards accumulated.')).toBeVisible()
  await page.getByRole('button', { name: 'End Run' }).last().click()

  await expect(page.getByTestId('main-menu-logo')).toBeVisible()
  await expect(page.getByTestId('talents-notification-dot')).toBeVisible()

  await page.getByRole('button', { name: 'Talents' }).click()
  await page.getByRole('button', { name: 'Physical' }).evaluate((node: HTMLButtonElement) => node.click())
  await expect(page.getByText('Available Points: 1')).toBeVisible()

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('alchemy.progress.v1') ?? '{}'))
  expect(stored.meta.keywordTalentPointsEarned.Physical).toBe(1)
})

test('rogue unlock reward screen reuses character-select presentation without helper copy', async ({ page }) => {
  await startKnightRun(page)

  for (let floor = 0; floor < 5; floor += 1) {
    await advanceToNextCombat(page)
  }

  await openEndRunModal(page)
  await page.getByRole('button', { name: 'End Run' }).last().click()

  await expect(page.getByTestId('run-character-reward-showcase')).toBeVisible()
  await expect(page.getByText('Hover to preview the starting deck')).toHaveCount(0)
  await expect(page.getByText('New Adventurer')).toHaveCount(0)

  const hasAmberFrame = await page.getByTestId('run-character-reward-card').evaluate((node) => {
    return Array.from(node.querySelectorAll('*')).some((child) => {
      const className = typeof (child as HTMLElement).className === 'string' ? (child as HTMLElement).className : ''
      return className.includes('amber')
    })
  })

  expect(hasAmberFrame).toBeFalsy()
})

test('battle music rotates on a timer with the audio debug probe', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeAudio extends EventTarget {
      _src = ''
      currentTime = 0
      volume = 1
      muted = false
      loop = false
      preload = ''
      onloadedmetadata: null | (() => void) = null
      onerror: null | (() => void) = null

      set src(value: string) {
        this._src = value
        window.setTimeout(() => {
          this.onloadedmetadata?.()
          this.dispatchEvent(new Event('loadedmetadata'))
        }, 0)
      }

      get src() {
        return this._src
      }

      setAttribute(name: string, value: string) {
        if (name === 'src') this.src = value
      }

      removeAttribute(name: string) {
        if (name === 'src') this._src = ''
      }

      load() {}

      play() {
        return Promise.resolve()
      }

      pause() {
        this.dispatchEvent(new Event('pause'))
      }
    }

    ;(window as any).Audio = FakeAudio
    ;(window as any).__alchemyAudioTestConfig = { bgmRotateMs: 150 }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  const state = await page.evaluate(() => (window as any).__alchemyAudioDebug?.getState?.())
  expect(state).toBeTruthy()
  expect(state.rotateMs).toBe(150)
  expect(state.startCount).toBeGreaterThanOrEqual(2)
  expect(state.rotationCount).toBeGreaterThanOrEqual(1)
})