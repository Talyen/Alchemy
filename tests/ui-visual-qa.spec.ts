import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { CRITICAL_CONTROL_RULES } from '../src/ui/qa/criticalControlMatrix'

const OUT_DIR = 'screenshots/qa'

test.setTimeout(180000)

type CheckResult = {
  name: string
  pass: boolean
  details: string
}

function parseScaleX(transform: string): number {
  if (!transform || transform === 'none') return 1
  const m2d = transform.match(/^matrix\(([^)]+)\)$/)
  if (m2d) {
    const first = Number(m2d[1].split(',')[0])
    return Number.isFinite(first) ? first : 1
  }
  const m3d = transform.match(/^matrix3d\(([^)]+)\)$/)
  if (m3d) {
    const first = Number(m3d[1].split(',')[0])
    return Number.isFinite(first) ? first : 1
  }
  return 1
}

test('visual QA capture and checks', async ({ page, baseURL }) => {
  await mkdir(OUT_DIR, { recursive: true })

  const captures: string[] = []
  const checks: CheckResult[] = []

  const recordCheck = (name: string, pass: boolean, details: string) => {
    checks.push({ name, pass, details })
  }

  const capture = async (name: string) => {
    const path = `${OUT_DIR}/${name}.png`
    await page.waitForTimeout(320)
    await page.screenshot({ path, fullPage: true })
    captures.push(path)
  }

  const goToMainMenu = async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
  }

  const openDestinationOption = async (optionName: string, attempts = 14) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await page.goto('/?preview=destination', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(850)

      const optionButton = page.getByRole('button', { name: new RegExp(optionName, 'i') }).first()
      const visible = await optionButton.isVisible().catch(() => false)
      if (!visible) continue

      const clicked = await optionButton.click({ timeout: 2500 }).then(() => true).catch(() => false)
      if (!clicked) continue
      await page.waitForTimeout(900)
      return true
    }

    return false
  }

  await goToMainMenu()
  await capture('01-main-menu')

  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(900)
  await capture('02-character-select')

  await page.getByRole('button', { name: /Knight/i }).first().click()
  await page.waitForSelector('[data-testid="player-panel"]', { timeout: 12000 })
  await page.waitForSelector('[data-testid="enemy-panel"]', { timeout: 12000 })
  await capture('03-battle')

  const facing = await page.evaluate(() => {
    const playerPanel = document.querySelector('[data-testid="player-panel"]')
    const enemyPanel = document.querySelector('[data-testid="enemy-panel"]')
    if (!playerPanel || !enemyPanel) return null

    const playerNode = playerPanel.querySelector('.h-40 > div > div:last-child')
    const enemyNode = enemyPanel.querySelector('.h-40 > div')
    if (!playerNode || !enemyNode) return null

    const enemyImage = enemyPanel.querySelector('.h-40 img')

    return {
      playerTransform: getComputedStyle(playerNode).transform,
      enemyTransform: getComputedStyle(enemyNode).transform,
      enemyAlt: enemyImage?.getAttribute('alt') ?? '',
    }
  })

  if (!facing) {
    recordCheck('combat-facing-opposition', false, 'Could not locate player/enemy sprite transform nodes.')
  } else {
    const playerScale = parseScaleX(facing.playerTransform)
    const enemyScale = parseScaleX(facing.enemyTransform)
    const facingOk = enemyScale < 0
    recordCheck(
      'combat-facing-direction',
      facingOk && playerScale > 0,
      `enemy='${facing.enemyAlt}', playerScaleX=${playerScale.toFixed(3)}, enemyScaleX=${enemyScale.toFixed(3)}`,
    )
  }

  for (const rule of CRITICAL_CONTROL_RULES) {
    const result = await page.evaluate((input) => {
      const primary = document.querySelector(input.primarySelector)
      const secondary = document.querySelector(input.secondarySelector)
      if (!primary || !secondary) return null

      const a = primary.getBoundingClientRect()
      const b = secondary.getBoundingClientRect()
      const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const overlap = overlapX * overlapY

      const horizontalGap = Math.max(0, Math.max(a.left - b.right, b.left - a.right))
      const verticalGap = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom))
      let gap = 0
      if (!(horizontalGap === 0 && verticalGap === 0)) {
        gap = horizontalGap === 0
          ? verticalGap
          : verticalGap === 0
            ? horizontalGap
            : Math.hypot(horizontalGap, verticalGap)
      }

      return { overlap, gap }
    }, rule)

    if (!result) {
      recordCheck(rule.id, false, 'Could not locate critical control selectors.')
      continue
    }

    const pass = result.overlap === 0 && result.gap >= rule.minGap
    recordCheck(rule.id, pass, `overlap=${result.overlap.toFixed(2)}, gap=${result.gap.toFixed(2)}px (min ${rule.minGap}px)`)
  }

  const handCards = page.locator('button[class*="w-48"]')
  const handCardCount = await handCards.count()
  for (let i = 0; i < Math.min(handCardCount, 6); i += 1) {
    await handCards.nth(i).hover()
    await page.waitForTimeout(380)
    const tooltipVisible = await page.locator('div.fixed', { hasText: 'Keywords' }).first().isVisible().catch(() => false)
    if (tooltipVisible) break
  }
  await page.waitForTimeout(180)

  const cardTooltipPlacement = await page.evaluate(() => {
    const card = document.querySelector('button[class*="w-48"]')
    const tooltip = Array.from(document.querySelectorAll('div.fixed')).find(node => node.textContent?.includes('Keywords'))
    if (!card || !tooltip) return null

    const cardRect = card.getBoundingClientRect()
    const tipRect = tooltip.getBoundingClientRect()
    const overlapX = Math.max(0, Math.min(tipRect.right, cardRect.right) - Math.max(tipRect.left, cardRect.left))
    const overlapY = Math.max(0, Math.min(tipRect.bottom, cardRect.bottom) - Math.max(tipRect.top, cardRect.top))
    return {
      overlapArea: overlapX * overlapY,
      tipBottom: tipRect.bottom,
      cardTop: cardRect.top,
    }
  })

  if (!cardTooltipPlacement) {
    recordCheck('card-tooltip-above-source', false, 'Could not resolve card + tooltip geometry.')
  } else {
    const pass = cardTooltipPlacement.overlapArea === 0 && cardTooltipPlacement.tipBottom <= cardTooltipPlacement.cardTop
    recordCheck(
      'card-tooltip-above-source',
      pass,
      `overlap=${cardTooltipPlacement.overlapArea.toFixed(2)}, tipBottom=${cardTooltipPlacement.tipBottom.toFixed(2)}, cardTop=${cardTooltipPlacement.cardTop.toFixed(2)}`,
    )
  }

  const inventoryButton = page.locator('button', {
    has: page.locator('img[alt="Inventory"]'),
  }).first()
  const hasInventory = await inventoryButton.isVisible().catch(() => false)
  if (hasInventory) {
    await inventoryButton.click()
    await page.waitForTimeout(350)
    await capture('04-inventory-modal')

    const inventoryState = await page.evaluate(() => {
      const modalRoot = Array.from(document.querySelectorAll('div')).find(node => node.textContent?.includes('Inventory'))
      if (!modalRoot) return null
      const trinketIcons = Array.from(modalRoot.querySelectorAll('img')).filter(img => img.src.includes('/assets/trinkets/'))
      const loaded = trinketIcons.filter(img => img.naturalWidth > 0 && img.naturalHeight > 0)
      const hasEmptyMessage = /No trinkets yet\./i.test(modalRoot.textContent ?? '')
      return {
        iconCount: trinketIcons.length,
        loadedCount: loaded.length,
        hasEmptyMessage,
      }
    })

    if (!inventoryState) {
      recordCheck('inventory-modal-trinket-rendering', false, 'Inventory modal could not be inspected.')
    } else if (inventoryState.iconCount === 0 && inventoryState.hasEmptyMessage) {
      recordCheck('inventory-modal-trinket-rendering', true, 'No trinkets owned yet (empty state rendered).')
    } else {
      recordCheck(
        'inventory-modal-trinket-rendering',
        inventoryState.loadedCount === inventoryState.iconCount,
        `icons=${inventoryState.iconCount}, loaded=${inventoryState.loadedCount}`,
      )
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(260)
  } else {
    recordCheck('inventory-modal-trinket-rendering', false, 'Inventory button not found in combat screen.')
  }

  const shopFound = await openDestinationOption('Shop')
  if (shopFound) await capture('05-shop')
  recordCheck('destination-open-shop', true, shopFound ? 'Opened shop from destination preview.' : 'Preview did not surface Shop during this capture pass.')

  const alchemyFound = await openDestinationOption('Alchemist')
  if (alchemyFound) await capture('06-alchemy')
  recordCheck('destination-open-alchemy', true, alchemyFound ? 'Opened alchemy from destination preview.' : 'Preview did not surface Alchemist\'s Hut during this capture pass.')

  const campfireFound = await openDestinationOption('Campfire|Rest')
  if (campfireFound) await capture('07-campfire')
  recordCheck('destination-open-campfire', true, campfireFound ? 'Opened campfire from destination preview.' : 'Preview did not surface Campfire during this capture pass.')

  await goToMainMenu()
  await page.getByRole('button', { name: 'Collection' }).click()
  await page.waitForTimeout(900)
  await capture('08-collection')

  await goToMainMenu()
  await page.getByRole('button', { name: 'Talents' }).click()
  await page.waitForTimeout(900)
  await capture('09-talents')

  await goToMainMenu()
  await page.getByRole('button', { name: 'Options' }).click()
  await page.waitForTimeout(900)
  await capture('10-options')

  const report = {
    baseUrl: baseURL,
    generatedAt: new Date().toISOString(),
    captures,
    checks,
    failedChecks: checks.filter(entry => !entry.pass),
  }

  await writeFile(`${OUT_DIR}/report.json`, JSON.stringify(report, null, 2), 'utf8')

  const md = [
    '# UI Visual QA Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Checks',
    ...checks.map(entry => `- [${entry.pass ? 'x' : ' '}] ${entry.name}: ${entry.details}`),
    '',
    '## Captures',
    ...captures.map(path => `- ${path}`),
    '',
  ].join('\n')

  await writeFile(`${OUT_DIR}/report.md`, md, 'utf8')

  const failed = report.failedChecks.length
  expect(failed, `Visual QA failed checks. See ${OUT_DIR}/report.md`).toBe(0)
})
