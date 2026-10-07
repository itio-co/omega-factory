import { expect, test } from '@playwright/test';

test('offers only compatible purchases and edits external partners without leaving World', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  const palette = page.getByRole('region', { name: 'Build palette' });
  await expect(palette.getByRole('button', { name: 'Build Ore supplier' })).toBeVisible();
  await expect(palette.getByRole('button', { name: 'Build Storage', exact: true })).toHaveCount(0);
  await palette.getByRole('button', { name: 'Build Customer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'World map', exact: true })).toBeVisible();
  await expect(page.locator('.world-partner')).toHaveCount(3);
  await page.getByLabel('Node resource').selectOption('ore');
  await expect(page.getByRole('region', { name: 'World map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.world-partner')).toHaveCount(2);
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await expect(palette.getByRole('button', { name: 'Build Storage', exact: true })).toBeVisible();
  await expect(palette.getByRole('button', { name: 'Build Customer', exact: true })).toHaveCount(0);
  await expect(palette.getByRole('button', { name: 'Build Ore supplier' })).toHaveCount(0);
});

test('moves World partners with shared undo and applies boundary connections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Fit world map' }).click();
  const supplier = page.locator('[data-world-node-id="supplier-1"]');
  const before = (await supplier.boundingBox())!;
  await supplier.click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.mouse.move(before.x + 35, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 35, before.y + 80, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await supplier.boundingBox())!.y).toBeGreaterThan(before.y + 20);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await supplier.boundingBox())!.y).toBeCloseTo(before.y, 0);
  await page.getByRole('button', { name: 'Build Customer', exact: true }).click();
  await page.getByLabel('Connect external partner to boundary').selectOption('export-1');
  await expect(page.getByRole('region', { name: 'World map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply factory update' }).click();
  await expect(page.getByTestId('factory-service')).toContainText('Out of service');
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await expect(page.locator('.world-partner')).toHaveCount(3);
  await expect(page.locator('[data-world-node-id="customer-2"]')).toContainText(
    '1 boundary routes',
  );
});
