import { expect, test } from '@playwright/test'
import { startKnightRun } from './helpers'

test('main menu renders transparent logo asset', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const logo = page.getByTestId('main-menu-logo')
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', /Alchemy(\s|%20)Logo\/(Alchemy(\s|%20)Logo)-transparent\.png/)

  const dimensions = await logo.evaluate((node) => {
    const image = node as HTMLImageElement
    return { width: image.naturalWidth, height: image.naturalHeight }
  })
  expect(dimensions.width).toBeGreaterThan(0)
  expect(dimensions.height).toBeGreaterThan(0)
})

test('draw and discard piles use the new pile artwork', async ({ page }) => {
  await startKnightRun(page)

  const drawPile = page.getByTestId('pile-draw')
  const discardPile = page.getByTestId('pile-discard')
  await expect(drawPile).toBeVisible()
  await expect(discardPile).toBeVisible()

  const drawImage = drawPile.locator('img')
  const discardImage = discardPile.locator('img')

  await expect(drawImage).toHaveAttribute('src', /assets\/ui\/pile-card-transparent\.png/)
  await expect(discardImage).toHaveAttribute('src', /assets\/ui\/pile-card-transparent\.png/)
  await expect(discardImage).toHaveAttribute('style', /grayscale\(1\)/)
})

test('pile viewers toggle independently from draw and discard buttons', async ({ page }) => {
  await startKnightRun(page)

  const drawPile = page.getByTestId('pile-draw')
  const discardPile = page.getByTestId('pile-discard')

  await drawPile.click()
  await expect(page.getByText('Draw Pile')).toBeVisible()

  await discardPile.click()
  await expect(page.getByText('Discard Pile')).toBeVisible()
  await expect(page.getByText('Draw Pile')).not.toBeVisible()
})
