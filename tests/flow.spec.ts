import { expect, test } from '@playwright/test';

test('shows live throughput in the interior and details on route selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  const rate = page.getByRole('button', { name: /^Flow rate for route import-1:storage-1:/ });
  await expect(rate).not.toHaveText('0.0/s', { timeout: 5000 });
  await rate.click();
  await expect(page.getByText(/items \/ simulation s$/, { exact: false })).toBeVisible();
  await expect(page.getByText('Live throughput', { exact: true })).toBeVisible();
});
