import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const OUT_DIR = 'screenshots/qa'

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

      await optionButton.click()
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
    const alt = facing.enemyAlt.toLowerCase()
    const shouldFaceLeft = ['doc', 'big demon', 'flaming skull', 'shade', 'greater slime'].some(name => alt.includes(name))
    const facingOk = shouldFaceLeft ? enemyScale < 0 : enemyScale > 0
    recordCheck(
      'combat-facing-direction',
      facingOk && playerScale > 0,
      `enemy='${facing.enemyAlt}', shouldFaceLeft=${shouldFaceLeft}, playerScaleX=${playerScale.toFixed(3)}, enemyScaleX=${enemyScale.toFixed(3)}`,
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
  recordCheck('destination-open-shop', shopFound, shopFound ? 'Opened shop from destination preview.' : 'Could not roll destination list containing Shop.')

  const alchemyFound = await openDestinationOption('Alchemist')
  if (alchemyFound) await capture('06-alchemy')
  recordCheck('destination-open-alchemy', alchemyFound, alchemyFound ? 'Opened alchemy from destination preview.' : 'Could not roll destination list containing Alchemist\'s Hut.')

  const campfireFound = await openDestinationOption('Campfire|Rest')
  if (campfireFound) await capture('07-campfire')
  recordCheck('destination-open-campfire', campfireFound, campfireFound ? 'Opened campfire from destination preview.' : 'Could not roll destination list containing Campfire.')

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
