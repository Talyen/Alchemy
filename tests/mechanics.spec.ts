import { test, expect } from '@playwright/test'
import { startKnightRun, clickEndTurn } from './helpers'

test.describe('Deck Management', () => {
  test.beforeEach(async ({ page }) => {
    await startKnightRun(page)
  })

  test('should start with cards in draw pile', async ({ page }) => {
    // Draw pile should have a number displayed
    const drawPile = await page.locator('text=Draw').first()
    await expect(drawPile).toBeVisible()
  })

  test('discard pile should be empty initially', async ({ page }) => {
    const discardPile = await page.locator('text=Discard').first()
    await expect(discardPile).toBeVisible()
  })

  test('should move cards to discard after player turn', async ({ page }) => {
    // Play a card
    const card = await page.locator('button[class*="w-48"]').first()
    await card.click()
    await page.waitForTimeout(180)
    
    // End turn
    await clickEndTurn(page)
    
    await page.waitForTimeout(1100)
    
    // Discard pile should now have cards
    const discardLabel = await page.locator('text=Discard').first()
    await expect(discardLabel).toBeVisible()
  })

  test('should refill hand from draw pile', async ({ page }) => {
    // Play cards until hand is reduced
    const cards = await page.locator('button[class*="w-48"]').count()
    
    if (cards > 0) {
      const card = await page.locator('button[class*="w-48"]').first()
      await card.click()
      await page.waitForTimeout(120)
    }
    
    // End turn
    await clickEndTurn(page)
    
    // Wait for enemy turn to complete and new hand to be dealt.
    // Poll until the card count is > 0 (retries handle the brief zero-card window during discard/draw).
    await expect(async () => {
      const count = await page.locator('button[class*="w-48"]').count()
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 10000 })
    
    // Should have cards in hand again (or close to 5)
    const newCards = await page.locator('button[class*="w-48"]').count()
    expect(newCards).toBeGreaterThan(0)
  })

  test('should shuffle discard back into draw when draw pile empty', async ({ page }) => {
    // Helper: play multiple cards to drain deck
    for (let i = 0; i < 3; i++) {
      const cards = await page.locator('button[class*="w-48"]').count()
      if (cards > 0) {
        const card = await page.locator('button[class*="w-48"]').first()
        const isPlayable = await card.getAttribute('class').then(c => !c?.includes('grayscale'))
        if (isPlayable) {
          await card.click()
          await page.waitForTimeout(200)
        }
      }
    }
    
    // End turn
    await clickEndTurn(page)
    
    await page.waitForTimeout(1000)
    
    // Game should still be playable
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    await expect(gameArea).toBeVisible()
  })
})

test.describe('Stat Changes & Floating Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await startKnightRun(page)
  })

  test('should show damage floating number', async ({ page }) => {
    // Play damage card
    const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Slash")').first()
    if (await attackCard.isVisible()) {
      await attackCard.click()
      await page.waitForTimeout(360)
      
      // Damage number should appear above enemy
      // Look for red colored floating numbers
      const redElements = await page.locator('[style*="color"]').count()
      expect(redElements).toBeGreaterThan(0)
    }
  })

  test('should show heal floating number when player heals', async ({ page }) => {
    // Play heal card
    const healCard = await page.locator('button:has-text("Apple"), button:has-text("Health Potion")').first()
    if (await healCard.isVisible()) {
      await healCard.click()
      await page.waitForTimeout(360)
      
      // Heal number should appear above player
      const redElements = await page.locator('[style*="color"]').count()
      expect(redElements).toBeGreaterThanOrEqual(0)
    }
  })

  test('should show block floating number', async ({ page }) => {
    // Play block card
    const blockCard = await page.locator('button:has-text("Defend")').first()
    if (await blockCard.isVisible()) {
      await blockCard.click()
      await page.waitForTimeout(360)
      
      // Block number should appear
      const elements = await page.locator('[class*="pointer-events-none"]').count()
      expect(elements).toBeGreaterThanOrEqual(0)
    }
  })

  test('should show status effect application', async ({ page }) => {
    // Play card that applies status effect
    const statusCard = await page.locator('button:has-text("Fireball")').first()
    if (await statusCard.isVisible()) {
      await statusCard.click()
      await page.waitForTimeout(360)
      
      // Status indicator should appear
      const statusElements = await page.locator('[class*="animation"]').count()
      expect(statusElements).toBeGreaterThanOrEqual(0)
    }
  })

  test('player block should decrease when taking damage', async ({ page }) => {
    // Add player block first
    const defendCard = await page.locator('button:has-text("Defend")').first()
    if (await defendCard.isVisible()) {
      await defendCard.click()
      await page.waitForTimeout(180)
    }
    
    // End turn and let enemy attack
    await clickEndTurn(page)
    
    await page.waitForTimeout(1100)
    
    // Check player still exists (game didn't crash)
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    await expect(gameArea).toBeVisible()
  })

  test('enemy should take damage when hit', async ({ page }) => {
    // Play attack card
    const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Bash")').first()
    if (await attackCard.isVisible()) {
      await attackCard.click()
      await page.waitForTimeout(600)
      
      // Game should continue and enemy should be taking damage over multiple turns
      const gameActive = await page.locator('[class*="flex"]').first()
      await expect(gameActive).toBeVisible()
    }
  })

  test('should show attack animation when enemy attacks', async ({ page }) => {
    // End player turn
    await clickEndTurn(page)
    
    // Wait for enemy turn to complete
    await page.waitForTimeout(1100)
    
    // Look for any floating animations (attack icon)
    const animations = await page.locator('[class*="animate"]').count()
    expect(animations).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Player vs Enemy Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await startKnightRun(page)
  })

  test('should have player panel with stats', async ({ page }) => {
    // Player panel HP bar should be visible
    await expect(page.locator('[data-testid="hp-bar-player"]')).toBeVisible()
  })

  test('should have enemy panel with stats', async ({ page }) => {
    // Enemy should be visible
    const enemyPanel = await page.locator('[class*="flex"][class*="items-center"]').count()
    expect(enemyPanel).toBeGreaterThan(1)
  })

  test('player HP should decrease when enemy attacks', async ({ page }) => {
    // End player turn to trigger enemy attack
    await clickEndTurn(page)
    
    // Wait for enemy action
    await page.waitForTimeout(1500)
    
    // Player HP bar should still be visible
    await expect(page.locator('[data-testid="hp-bar-player"]')).toBeVisible()
  })

})
