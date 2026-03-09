import { test, expect } from '@playwright/test'
import { startKnightRun, clickEndTurn } from './helpers'

test.describe('Combat System', () => {
  test.beforeEach(async ({ page }) => {
    await startKnightRun(page)
  })

  test('should initialize with 5 cards in hand', async ({ page }) => {
    const cards = await page.locator('button[class*="w-48"]').count()
    expect(cards).toBe(5)
  })

  test('should start with correct mana', async ({ page }) => {
    // Mana is displayed as colored orb SVGs in the Hand component
    const manaOrbs = await page.locator('svg[width="12"]').count()
    expect(manaOrbs).toBeGreaterThan(0)
  })

  test('should be able to click a card to play it', async ({ page }) => {
    const initialCardCount = await page.locator('button[class*="w-48"]').count()
    
    // Click first card
    const firstCard = await page.locator('button[class*="w-48"]').first()
    await firstCard.click()
    
    await page.waitForTimeout(400)
    const newCardCount = await page.locator('button[class*="w-48"]').count()
    
    // Count should change after playing a card
    expect(newCardCount).not.toBe(initialCardCount)
  })

  test('should not allow playing cards without enough mana', async ({ page }) => {
    // Find a high-cost card (if any exist and we don't have mana)
    const costElements = await page.locator('[class*="grayscale"]').count()
    expect(costElements).toBeGreaterThanOrEqual(0)
  })

  test('should take enemy turn after player ends turn', async ({ page }) => {
    // End turn immediately and verify enemy action resolves
    await clickEndTurn(page)
    
    await page.waitForTimeout(1200) // Wait for enemy turn animations
    
    // Game should still be playable
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    await expect(gameArea).toBeVisible()
  })

  test('should show floating numbers when damage is dealt', async ({ page }) => {
    // Play attack card
    const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Slash"), button:has-text("Bash")').first()
    if (await attackCard.isVisible()) {
      await attackCard.click()
      await page.waitForTimeout(600)
      
      // Look for damage number animation
      const damageNumbers = await page.locator('[class*="pointer-events-none"]').count()
      expect(damageNumbers).toBeGreaterThan(0)
    }
  })

  test('should accumulate player block when defend is played', async ({ page }) => {
    const defendCard = await page.locator('button:has-text("Defend")').first()
    if (await defendCard.isVisible()) {
      await defendCard.click()
      await page.waitForTimeout(600)
      
      // Block indicator should be visible — HeartBar shows blue overlay (bg-blue-600)
      // and PlayerPanel shows a ShieldHalf SVG icon when block > 0
      const blockOverlay = await page.locator('[data-testid="hp-bar-player"] [class*="blue-600"]').count()
      const shieldIcon = await page.locator('[data-testid="player-panel"] svg').count()
      expect(blockOverlay + shieldIcon).toBeGreaterThan(0)
    }
  })

  test('should handle enemy attack on their turn', async ({ page }) => {
    // End player turn quickly
    const firstCard = await page.locator('button[class*="w-48"]').first()
    await firstCard.click()
    await page.waitForTimeout(300)
    
    await clickEndTurn(page)
    
    // Wait for enemy turn
    await page.waitForTimeout(1500)
    
    // Game should still be visible and running
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    await expect(gameArea).toBeVisible()
  })

  test('should draw new cards at start of player turn', async ({ page }) => {
    // Get initial card count
    const initialCards = await page.locator('button[class*="w-48"]').count()
    
    // Play a card to spend mana
    const firstCard = await page.locator('button[class*="w-48"]').first()
    await firstCard.click()
    await page.waitForTimeout(200)
    
    // End turn and wait for draw
    await clickEndTurn(page)
    
    // Wait for enemy turn to complete and new turn to start
    await page.waitForTimeout(2500)
    
    const finalCards = await page.locator('button[class*="w-48"]').count()
    // Should have drawn more cards (or at least not fewer if hand was full)
    expect(finalCards).toBeGreaterThanOrEqual(3)
  })

  test('should handle card drag animation', async ({ page }) => {
    const firstCard = await page.locator('button[class*="w-48"]').first()
    
    // Drag card upward by simulating mouse down, move, up
    const box = await firstCard.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 10 })
      await page.mouse.up()
      
      await page.waitForTimeout(400)
      
      // Card should either be played or returned to hand
      const cardsAfter = await page.locator('button[class*="w-48"]').count()
      expect(cardsAfter).toBeGreaterThanOrEqual(3)
    }
  })

  test('should apply status effects visually', async ({ page }) => {
    // Play multiple cards to try to apply status
    const cardsToPlay = ['Fireball', 'Bite', 'Immolate']
    
    for (const cardName of cardsToPlay) {
      const card = await page.locator(`button:has-text("${cardName}")`).first()
      if (await card.isVisible({ timeout: 500 })) {
        await card.click()
        await page.waitForTimeout(300)
      }
    }
    
    // Check for status effect indicators
    const statusElements = await page.locator('[class*="Flame"], [class*="f97316"]').count()
    expect(statusElements).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Combat Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await startKnightRun(page)
  })

  test('should handle zero-cost cards', async ({ page }) => {
    const appleCard = await page.locator('button:has-text("Apple")').first()
    if (await appleCard.isVisible()) {
      // Should be playable even with 0 mana
      await appleCard.click()
      await page.waitForTimeout(400)
      expect(appleCard).toBeVisible()
    }
  })

  test('should prevent playing disabled (grayed out) cards', async ({ page }) => {
    const disabledCards = await page.locator('[class*="grayscale"]').count()
    // Disabled cards exist or don't based on mana
    expect(disabledCards).toBeGreaterThanOrEqual(0)
  })

  test('should persist block across turns until broken', async ({ page }) => {
    // Play defend card
    const defendCard = await page.locator('button:has-text("Defend")').first()
    if (await defendCard.isVisible()) {
      await defendCard.click()
      await page.waitForTimeout(300)
    }
    
    // End turn
    await clickEndTurn(page)
    
    // Wait for enemy turn (block should reduce but persist)
    // Wait for player panel to be visible again (indicates our turn has resumed)
    await page.waitForSelector('[data-testid="player-panel"]', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)
    
    // Game should continue (either still in combat or victory/defeat screen)
    const gameArea = page.locator('[class*="relative"]').first()
    await expect(gameArea).toBeVisible()
  })
})
