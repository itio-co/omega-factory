import { expect, test } from '@playwright/test';
import { claimContract, connect, createGame, tick } from '../src/lib/game/engine';

test('inspecting a node preserves redo and does not create a factory update', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Select Smelter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply factory update' })).toBeDisabled();
  await page.getByRole('button', { name: 'Build Storage', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Select Smelter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Apply factory update' })).toBeDisabled();
});

test('tracks and claims a side quest only after its building is installed, then persists completion', async ({
  page,
}) => {
  let game = connect(createGame(), 'smelter-1', 'export-1');
  for (let i = 0; i < 140; i++) game = tick(game);
  game = claimContract(game);
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'founded.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(game)),
  });
  await page.getByRole('button', { name: 'Open quest board', exact: true }).click();
  await page.getByRole('button', { name: 'View quest Room to grow' }).click();
  await page.getByRole('button', { name: 'Track this quest' }).click();
  await page.getByRole('button', { name: 'Close quest board' }).click();
  await expect(page.getByRole('heading', { name: 'Room to grow', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await expect(page.getByRole('button', { name: 'Build Plate press', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Build Frame fabricator', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Build Warehouse', exact: true }).click();
  await page.getByRole('button', { name: 'Open quest board', exact: true }).click();
  await page.getByRole('button', { name: 'View quest Room to grow' }).click();
  await expect(page.getByRole('button', { name: 'Claim quest reward' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close quest board' }).click();
  await page.getByRole('button', { name: 'Apply factory update' }).click();
  await page.getByRole('button', { name: 'Open quest board', exact: true }).click();
  await page.getByRole('button', { name: 'View quest Room to grow' }).click();
  await page.getByRole('button', { name: 'Claim quest reward' }).click();
  await expect(page.getByText('Reward claimed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim quest reward' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View quest Room to grow' })).toBeVisible();
  await page.getByRole('button', { name: 'Close quest board' }).click();
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open quest board', exact: true }).click();
  await page.getByRole('button', { name: 'View quest Room to grow' }).click();
  await expect(page.getByText('Reward claimed', { exact: true })).toBeVisible();
});

test('gates slide between wall slots and cannot float away from the factory', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Fit factory' }).click();
  const slot = page.locator('[data-node-id="import-1"]');
  const before = (await slot.boundingBox())!;
  const wall = (await page.locator('.factory-boundary').boundingBox())!;
  expect(before.x + before.width / 2).toBeCloseTo(wall.x, 0);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 100, before.y + before.height / 2 + 85, {
    steps: 8,
  });
  await page.mouse.up();
  const after = (await slot.boundingBox())!;
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeGreaterThan(before.y);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await slot.boundingBox())!.y).toBeCloseTo(before.y, 0);
});

test('production advances while another tab is focused and unapplied edits are not saved', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Open quest board', exact: true }).click();
  const before = Number(await page.getByTestId('tick-count').textContent());
  await expect
    .poll(async () => Number(await page.getByTestId('tick-count').textContent()))
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Close quest board' }).click();
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Build Storage', exact: true }).click();
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('node-count')).toHaveText('6');
  await expect(page.getByTestId('factory-service')).toContainText('In service');
});
