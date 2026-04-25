import { expect, test, type Locator, type Page } from '@playwright/test';

const cardCosts: Record<string, number> = {
  anvil: 1,
  apple: 1,
  bash: 1,
  block: 1,
  bread: 1,
  'plate-mail': 1,
  slash: 1,
};

const cardPriority: Record<string, number> = {
  bash: 0,
  slash: 1,
  anvil: 2,
  block: 3,
  'plate-mail': 4,
  apple: 5,
  bread: 6,
};

async function readMana(page: Page) {
  const manaCounter = page.getByTestId('mana-counter').first();

  if (!(await manaCounter.count())) {
    return null;
  }

  const currentMana = await manaCounter.getAttribute('data-current-mana');

  return currentMana ? Number(currentMana) : null;
}

async function readHealth(page: Page, name: string) {
  const statusCard = page.getByTestId(`combatant-${name.toLowerCase()}`);
  const text = await statusCard.getByText(/\d+ \/ \d+ HP/).textContent();

  return Number(text?.match(/(\d+) \/ (\d+) HP/)?.[1] ?? 0);
}

async function readRect(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();

    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });
}

function visibleBattleCard(page: Page, cardId: string) {
  return page.getByTestId('screen-battle').locator(`[data-card-id="${cardId}"]`).first();
}

async function clickBattleCard(page: Page, cardId: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const card = visibleBattleCard(page, cardId);

    if (!(await card.count())) {
      return false;
    }

    try {
      await expect(card).toBeVisible({ timeout: 1500 });
      await card.evaluate((node) => {
        (node as HTMLElement).click();
      });

      return true;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }

  return false;
}

async function playAffordableCardsUntilTurnResolves(page: Page) {
  for (let step = 0; step < 10; step += 1) {
    if (!(await page.getByTestId('screen-battle').count())) {
      return;
    }

    const mana = await readMana(page);

    if (mana === null) {
      return;
    }

    const orderedIds = Object.entries(cardCosts)
      .filter(([, cost]) => cost <= mana)
      .sort((left, right) => {
        const priorityDelta = (cardPriority[left[0]] ?? 99) - (cardPriority[right[0]] ?? 99);

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return right[1] - left[1];
      })
      .map(([cardId]) => cardId);

    let playedCard = false;

    for (const cardId of orderedIds) {
      if (await clickBattleCard(page, cardId)) {
        playedCard = true;

        if (!(await page.getByTestId('screen-battle').count())) {
          return;
        }

        break;
      }
    }

    if (!playedCard) {
      break;
    }
  }
}

async function startKnightRun(page: Page, orderedDeckCardIds?: string[]) {
  await page.addInitScript((cardIds) => {
    window.localStorage.setItem('alchemy-test-deck', 'ordered');

    if (Array.isArray(cardIds) && cardIds.length > 0) {
      window.localStorage.setItem('alchemy-test-deck-card-ids', JSON.stringify(cardIds));
      return;
    }

    window.localStorage.removeItem('alchemy-test-deck-card-ids');
  }, orderedDeckCardIds ?? null);
  await page.goto('/');

  await expect(page.getByTestId('screen-main-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('screen-character-select')).toBeVisible();
  await page.getByTestId('begin-run-knight').click();
  await expect(page.getByTestId('screen-battle')).toBeVisible();
}

async function chooseNextDestination(page: Page) {
  const destinationPreferences = [/Combat/i, /Elite Combat/i, /Alchemist/i, /Mystery/i, /Campfire/i, /Merchant/i];

  for (const pattern of destinationPreferences) {
    const option = page.getByRole('button', { name: pattern }).first();

    if (!(await option.count())) {
      continue;
    }

    const label = (await option.textContent()) ?? '';
    await option.click();

    if (/Campfire/i.test(label)) {
      await expect(page.getByTestId('screen-campfire')).toBeVisible();
      await page.getByTestId('campfire-restore-button').click();
      await expect(page.getByTestId('screen-destination')).toBeVisible();
      return;
    }

    if (/Merchant/i.test(label)) {
      await expect(page.getByTestId('screen-merchant-shop')).toBeVisible();
      await page.getByRole('button', { name: 'Leave' }).click();
      await expect(page.getByTestId('screen-destination')).toBeVisible();
      return;
    }

    if (/Mystery/i.test(label)) {
      await expect(page.getByTestId('screen-mystery-event')).toBeVisible();
      await page.getByRole('button', { name: 'Open' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByTestId('screen-destination')).toBeVisible();
      return;
    }

    await expect(page.getByTestId('screen-battle')).toBeVisible();
    return;
  }

  throw new Error('No destination option was available to continue the run.');
}

test('battle layout keeps status panels below art and fixed width during combat', async ({ page }) => {
  await page.setViewportSize({ height: 960, width: 1440 });
  await startKnightRun(page, ['bash', 'bash', 'bash', 'bash', 'bash']);

  const readBattleLayout = async () => ({
    enemyArt: await readRect(page.getByTestId('combatant-skeleton-art')),
    enemyHealthTrack: await readRect(page.getByTestId('combatant-skeleton-health-track')),
    enemyStatus: await readRect(page.getByTestId('combatant-skeleton')),
    playerArt: await readRect(page.getByTestId('combatant-knight-art')),
    playerHealthTrack: await readRect(page.getByTestId('combatant-knight-health-track')),
    playerStatus: await readRect(page.getByTestId('combatant-knight')),
  });

  const before = await readBattleLayout();

  expect(Math.abs(before.playerStatus.width - before.playerArt.width)).toBeLessThan(2);
  expect(Math.abs(before.enemyStatus.width - before.enemyArt.width)).toBeLessThan(2);
  expect(before.playerArt.bottom).toBeLessThanOrEqual(before.playerStatus.top);
  expect(before.enemyArt.bottom).toBeLessThanOrEqual(before.enemyStatus.top);
  expect(before.enemyArt.left - before.playerArt.right).toBeGreaterThan(150);

  await clickBattleCard(page, 'bash');
  await clickBattleCard(page, 'bash');
  await expect(page.getByTestId('combatant-skeleton')).toContainText('6');

  const after = await readBattleLayout();

  expect(Math.abs(after.playerStatus.width - before.playerStatus.width)).toBeLessThan(2);
  expect(Math.abs(after.enemyStatus.width - before.enemyStatus.width)).toBeLessThan(2);
  expect(Math.abs(after.playerHealthTrack.width - before.playerHealthTrack.width)).toBeLessThan(2);
  expect(Math.abs(after.enemyHealthTrack.width - before.enemyHealthTrack.width)).toBeLessThan(2);
  expect(after.playerArt.bottom).toBeLessThanOrEqual(after.playerStatus.top);
  expect(after.enemyArt.bottom).toBeLessThanOrEqual(after.enemyStatus.top);
});

test('main menu, collection pagination, and options navigation work', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('screen-main-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Collection' }).click();
  await expect(page.getByTestId('screen-collection')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Screen menu' })).toBeVisible();
  await expect(page.getByTestId('collection-pagination')).toBeVisible();
  await page.getByRole('button', { name: '2' }).click();
  await expect(page.locator('[data-card-id="bread"]')).toBeVisible();

  await page.getByRole('button', { name: 'Screen menu' }).click();
  await page.getByRole('menuitem', { name: 'Main Menu' }).click();
  await expect(page.getByTestId('screen-main-menu')).toBeVisible();

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.getByTestId('screen-options')).toBeVisible();
  await expect(page.getByText('Persistence status')).toHaveCount(0);
});

test('battle flow supports card play, auto-end turn, and destination progression', async ({ page }) => {
  await startKnightRun(page);

  const startingEnemyHealth = await readHealth(page, 'Skeleton');
  const startingPlayerHealth = await readHealth(page, 'Knight');

  await clickBattleCard(page, 'bash');
  await clickBattleCard(page, 'slash');
  await clickBattleCard(page, 'block');

  await expect.poll(() => readMana(page)).toBe(3);
  await expect.poll(() => readHealth(page, 'Skeleton')).toBeLessThan(startingEnemyHealth);
  await expect.poll(() => readHealth(page, 'Knight')).toBeLessThan(startingPlayerHealth);

  for (let turn = 0; turn < 20; turn += 1) {
    if ((await page.getByTestId('screen-battle-reward').count()) || (await page.getByRole('button', { name: 'Finish Run' }).count())) {
      break;
    }

    const enemyHealth = await readHealth(page, 'Skeleton');

    if (enemyHealth <= 0) {
      break;
    }

    await playAffordableCardsUntilTurnResolves(page);

    if ((await page.getByTestId('screen-battle-reward').count()) || (await page.getByRole('button', { name: 'Finish Run' }).count())) {
      break;
    }

    const mana = await readMana(page);

    if (mana !== null && mana !== 3) {
      await page.getByRole('button', { name: 'End Turn' }).click();
    }
  }

  await expect
    .poll(async () => (await page.getByTestId('screen-battle-reward').count()) + (await page.getByRole('button', { name: 'Finish Run' }).count()), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);

  if (await page.getByTestId('screen-battle-reward').count()) {
    await expect(page.getByRole('heading', { name: 'Victory!' })).toBeVisible();
    const rewardChoice = page.locator('[data-testid^="reward-choice-"]').first();
    await rewardChoice.hover();
    await rewardChoice.click();
    await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByTestId('screen-destination')).toBeVisible();
    await chooseNextDestination(page);
  }
});