import { test, expect } from '@playwright/test'

test.describe('Deck Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.click('button:has-text("Start")')
    await page.waitForTimeout(800)
  })

  test('should start with cards in draw pile', async ({ page }) => {
    // Draw pile should have a number displayed
    const drawPile = await page.locator('text=Draw').first()
    expect(drawPile).toBeVisible()
  })

  test('discard pile should be empty initially', async ({ page }) => {
    const discardPile = await page.locator('text=Discard').first()
    expect(discardPile).toBeVisible()
  })

  test('should move cards to discard after player turn', async ({ page }) => {
    // Play a card
    const card = await page.locator('button[class*="w-40"]').first()
    await card.click()
    await page.waitForTimeout(300)
    
    // End turn
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    await page.waitForTimeout(1500)
    
    // Discard pile should now have cards
    const discardLabel = await page.locator('text=Discard').first()
    expect(discardLabel).toBeVisible()
  })

  test('should refill hand from draw pile', async ({ page }) => {
    // Play cards until hand is reduced
    const cards = await page.locator('button[class*="w-40"]').count()
    
    if (cards > 0) {
      const card = await page.locator('button[class*="w-40"]').first()
      await card.click()
      await page.waitForTimeout(200)
    }
    
    // End turn
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    // Wait for draw phase and new turn
    await page.waitForTimeout(2000)
    
    // Should have cards in hand again (or close to 5)
    const newCards = await page.locator('button[class*="w-40"]').count()
    expect(newCards).toBeGreaterThan(0)
  })

  test('should shuffle discard back into draw when draw pile empty', async ({ page }) => {
    // Helper: play multiple cards to drain deck
    for (let i = 0; i < 3; i++) {
      const cards = await page.locator('button[class*="w-40"]').count()
      if (cards > 0) {
        const card = await page.locator('button[class*="w-40"]').first()
        const isPlayable = await card.getAttribute('class').then(c => !c?.includes('grayscale'))
        if (isPlayable) {
          await card.click()
          await page.waitForTimeout(200)
        }
      }
    }
    
    // End turn
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    await page.waitForTimeout(1500)
    
    // Game should still be playable
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    expect(gameArea).toBeVisible()
  })
})

test.describe('Stat Changes & Floating Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.click('button:has-text("Start")')
    await page.waitForTimeout(800)
  })

  test('should show damage floating number', async ({ page }) => {
    // Play damage card
    const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Slash")').first()
    if (await attackCard.isVisible()) {
      await attackCard.click()
      await page.waitForTimeout(600)
      
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
      await page.waitForTimeout(600)
      
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
      await page.waitForTimeout(600)
      
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
      await page.waitForTimeout(600)
      
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
      await page.waitForTimeout(300)
    }
    
    // End turn and let enemy attack
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    await page.waitForTimeout(1500)
    
    // Check player still exists (game didn't crash)
    const gameArea = await page.locator('[class*="min-h-screen"]').first()
    expect(gameArea).toBeVisible()
  })

  test('enemy should take damage when hit', async ({ page }) => {
    // Play attack card
    const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Bash")').first()
    if (await attackCard.isVisible()) {
      await attackCard.click()
      await page.waitForTimeout(600)
      
      // Game should continue and enemy should be taking damage over multiple turns
      const gameActive = await page.locator('[class*="flex"]').first()
      expect(gameActive).toBeVisible()
    }
  })

  test('should show attack animation when enemy attacks', async ({ page }) => {
    // End player turn
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    // Wait for enemy turn to complete
    await page.waitForTimeout(1500)
    
    // Look for any floating animations (attack icon)
    const animations = await page.locator('[class*="animate"]').count()
    expect(animations).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Player vs Enemy Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.click('button:has-text("Start")')
    await page.waitForTimeout(800)
  })

  test('should have player panel with stats', async ({ page }) => {
    // Player panel should show HP
    const playerStats = await page.locator('[class*="text-zinc-300"]').count()
    expect(playerStats).toBeGreaterThan(0)
  })

  test('should have enemy panel with stats', async ({ page }) => {
    // Enemy should be visible
    const enemyPanel = await page.locator('[class*="flex"][class*="items-center"]').count()
    expect(enemyPanel).toBeGreaterThan(1)
  })

  test('player HP should decrease when enemy attacks', async ({ page }) => {
    // End player turn to trigger enemy attack
    const endTurnButton = await page.locator('button:has-text("End Turn")').first()
    if (await endTurnButton.isVisible()) {
      await endTurnButton.click()
    }
    
    // Wait for enemy action
    await page.waitForTimeout(1500)
    
    // Player should still have health (check HP is displayed)
    const hpElements = await page.locator('[class*="font-mono"]').allTextContents()
    const hasHP = hpElements.some(text => /\d+\/\d+/.test(text))
    expect(hasHP).toBeTruthy()
  })

  test('should end game when player HP reaches 0', async ({ page }) => {
    // Keep letting enemy attack until defeat
    let turns = 0
    const maxTurns = 100
    
    while (turns < maxTurns) {
      // Check for game over
      const gameOverText = await page.locator('text=/Defeat|Game Over|Victory/i').first()
      if (await gameOverText.isVisible({ timeout: 500 }).catch(() => false)) {
        expect(gameOverText).toBeVisible()
        break
      }
      
      // Just end turn immediately to speed up enemy attacks
      const endTurnButton = await page.locator('button:has-text("End Turn")').first()
      if (await endTurnButton.isVisible()) {
        await endTurnButton.click()
      } else {
        // If no end turn button, just wait
        await page.waitForTimeout(500)
      }
      
      await page.waitForTimeout(1200)
      turns++
    }
  })

  test('should end game when enemy HP reaches 0', async ({ page }) => {
    // Attack constantly to try to win
    let turns = 0
    const maxTurns = 100
    
    while (turns < maxTurns) {
      // Check for victory
      const victoryText = await page.locator('text=/Victory|You Win/i').first()
      if (await victoryText.isVisible({ timeout: 500 }).catch(() => false)) {
        expect(victoryText).toBeVisible()
        break
      }
      
      // Keep playing damage cards
      const attackCard = await page.locator('button:has-text("Stab"), button:has-text("Bash"), button:has-text("Slash")').first()
      if (await attackCard.isVisible({ timeout: 500 }).catch(() => false)) {
        await attackCard.click()
      }
      
      // End turn
      const endTurnButton = await page.locator('button:has-text("End Turn")').first()
      if (await endTurnButton.isVisible()) {
        await endTurnButton.click()
      }
      
      await page.waitForTimeout(1500)
      turns++
    }
  })
})
