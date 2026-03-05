import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.locator('button', { hasText: 'Play' }).click()
  await page.waitForTimeout(600) // let game mount + initial Framer Motion settle
})

test('enemy shakes when player deals damage', async ({ page }) => {
  // The enemy panel is the second character column
  const enemyPanel = page.locator('.flex.flex-col.items-center.gap-2\\.5.w-44').nth(1)

  // Record the enemy's x position before the attack
  const boxBefore = await enemyPanel.boundingBox()

  // Click a Strike card (attack card — red border, "Deal 6 damage" text)
  const strikeCard = page.locator('button', { hasText: 'Deal 6 damage' }).first()
  await strikeCard.click()

  // During the shake the x position should shift away from its resting place
  // Poll briefly to catch the animation in flight
  let shook = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(20)
    const box = await enemyPanel.boundingBox()
    if (box && boxBefore && Math.abs(box.x - boxBefore.x) > 2) {
      shook = true
      break
    }
  }

  expect(shook).toBe(true)
})

test('player shakes when enemy attacks (end turn)', async ({ page }) => {
  const playerPanel = page.locator('.flex.flex-col.items-center.gap-2\\.5.w-44').nth(0)
  const boxBefore = await playerPanel.boundingBox()

  // Click End Turn to let the enemy attack
  await page.locator('button', { hasText: 'End Turn' }).click()

  let shook = false
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(20)
    const box = await playerPanel.boundingBox()
    if (box && boxBefore && Math.abs(box.x - boxBefore.x) > 2) {
      shook = true
      break
    }
  }

  expect(shook).toBe(true)
})
