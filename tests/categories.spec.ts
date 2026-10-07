import { expect, test } from '@playwright/test';

test('creates categories and multiple enclosure Things while preserving isolated drafts and saves', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByText('Things & categories', { exact: true }).click();
  await page.getByLabel('Category name', { exact: true }).fill('Laboratory');
  await page.getByRole('button', { name: 'Create category', exact: true }).click();
  await page.getByText('Things & categories', { exact: true }).click();
  await page.getByRole('button', { name: 'Build Laboratory', exact: true }).click();
  await expect(page.getByLabel('Factory Thing', { exact: true }).locator('option')).toHaveCount(2);
  const initialTick = Number(await page.getByTestId('tick-count').textContent());
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Build Storage', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('7');
  await page.getByLabel('Factory Thing', { exact: true }).selectOption({ label: 'Laboratory 2' });
  await expect(page.getByTestId('node-count')).toHaveText('0');
  await expect(page.getByTestId('credits')).toHaveText('1,000');
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Build Storage', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('1');
  await page
    .getByLabel('Factory Thing', { exact: true })
    .selectOption({ label: 'My first factory' });
  await expect(page.getByTestId('node-count')).toHaveText('7');
  expect(Number(await page.getByTestId('tick-count').textContent())).toBeGreaterThan(initialTick);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('6');
  await page.getByText('Things & categories', { exact: true }).click();
  await page.getByRole('button', { name: 'Create World', exact: true }).click();
  await expect(page.getByLabel('World Thing', { exact: true }).locator('option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('World Thing', { exact: true }).locator('option')).toHaveCount(2);
  await page.getByLabel('World Thing', { exact: true }).selectOption({ label: 'Local world' });
  await expect(page.getByRole('button', { name: 'Build Laboratory', exact: true })).toBeVisible();
  await page.getByLabel('Factory Thing', { exact: true }).selectOption({ label: 'Laboratory 2' });
  await expect(page.getByTestId('node-count')).toHaveText('0'); // drafts never become live saves
});
