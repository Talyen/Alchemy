import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const OUT_DIR = 'screenshots/qa'

function parseScaleX(transform: string): number {
  if (!transform || transform === 'none') return 1
  const matrix2d = transform.match(/^matrix\(([^)]+)\)$/)
  if (matrix2d) {
    const first = Number(matrix2d[1].split(',')[0])
    return Number.isFinite(first) ? first : 1
  }
  const matrix3d = transform.match(/^matrix3d\(([^)]+)\)$/)
  if (matrix3d) {
    const first = Number(matrix3d[1].split(',')[0])
    return Number.isFinite(first) ? first : 1
  }
  return 1
}

const TARGETS = [
  'shade',
  'mirror_shade',
  'prismatic_shade',
  'flaming_skull',
  'prismatic_skull',
] as const

test('problematic shade and skull variants face the player in combat', async ({ page }) => {
  await mkdir(OUT_DIR, { recursive: true })

  for (const enemyId of TARGETS) {
    await page.goto(`/?preview=enemy&enemy=${enemyId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="enemy-panel"]', { timeout: 12000 })
    await page.waitForTimeout(500)

    const facing = await page.evaluate(() => {
      const enemyPanel = document.querySelector('[data-testid="enemy-panel"]')
      if (!enemyPanel) return null

      const enemyNode = enemyPanel.querySelector('.h-40 > div')
      const enemyImage = enemyPanel.querySelector('.h-40 img')
      if (!enemyNode || !enemyImage) return null

      return {
        transform: getComputedStyle(enemyNode).transform,
        alt: enemyImage.getAttribute('alt') ?? '',
      }
    })

    expect(facing, `Missing enemy panel transform nodes for ${enemyId}`).not.toBeNull()
    const scaleX = parseScaleX(facing!.transform)
    expect(scaleX, `${enemyId} should face left toward the player`).toBeLessThan(0)

    await page.screenshot({ path: `${OUT_DIR}/enemy-facing-${enemyId}.png`, fullPage: true })
  }
})