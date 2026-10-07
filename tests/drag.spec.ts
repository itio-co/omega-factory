import { expect, test } from '@playwright/test';

for (const surface of ['.node-heading', '.node-art', '.node-recipe', '.node-status']) {
  test(`moves a card by dragging ${surface} and preserves its routes`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enter the factory' }).click();
    await page.getByRole('button', { name: 'Open factory interior' }).click();
    await page.getByRole('button', { name: 'Fit factory' }).click();
    const card = page.locator('[data-node-id="storage-1"]');
    const before = (await card.boundingBox())!;
    const handle = (await card.locator(surface).boundingBox())!;
    const otherCard = page.locator('[data-node-id="import-1"]');
    const otherBefore = (await otherCard.boundingBox())!;
    const route = page.getByRole('button', {
      name: 'Select route storage-1:smelter-1',
      exact: true,
    });
    const routeBefore = await route.getAttribute('d');
    const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 70, start.y + 60, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before.x - 70, 0);
    expect((await card.boundingBox())!.y).toBeCloseTo(before.y + 60, 0);
    expect((await otherCard.boundingBox())!.x).toBeCloseTo(otherBefore.x, 0);
    await expect(route).not.toHaveAttribute('d', routeBefore!);
    await expect(page.locator('.route-hit')).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before.x, 0);
    expect((await card.boundingBox())!.y).toBeCloseTo(before.y, 0);
  });
}

test('moves a card with a tablet touch gesture', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).tap();
  await page.getByRole('button', { name: 'Open factory interior' }).tap();
  await page.getByRole('button', { name: 'Fit factory' }).tap();
  const card = page.locator('[data-node-id="storage-1"]');
  const before = (await card.boundingBox())!;
  const art = (await card.locator('.node-art').boundingBox())!;
  const start = { x: art.x + art.width / 2, y: art.y + art.height / 2 };
  const input = await context.newCDPSession(page);
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let i = 1; i <= 5; i++) {
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x - i * 12, y: start.y + i * 8 }],
    });
  }
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before.x - 60, 0);
  expect((await card.boundingBox())!.y).toBeCloseTo(before.y + 40, 0);
  await context.close();
});
