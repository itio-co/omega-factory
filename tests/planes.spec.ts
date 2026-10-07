import { expect, test } from '@playwright/test';

test('keeps external partners in World and exposes factory ports as scope context', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await expect(page.getByRole('region', { name: 'World map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit world map' }).click();
  const partners = page.getByRole('region', { name: 'External world partners' });
  await expect(partners).toContainText('Ore supplier');
  await expect(partners).toContainText('Customer');
  await expect(page.getByTestId('factory-service')).toContainText('4 installed Things');
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  const scope = page.getByRole('region', { name: 'Factory scope ports' });
  await expect(scope).toContainText('Inlet · ore');
  await expect(scope).toContainText('Outlet · ingot');
  await expect(
    page
      .getByRole('region', { name: 'Build palette' })
      .getByRole('button', { name: 'Build Import gate' }),
  ).toHaveCount(0);
  await scope.getByRole('button', { name: 'Build Import gate' }).click();
  await expect(scope.getByRole('button', { name: 'Inlet · ore', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(scope.getByRole('button', { name: 'Inlet · ore', exact: true })).toHaveCount(1);
  await expect(page.locator('[data-node-id="supplier-1"]')).toHaveCount(0);
  await expect(page.locator('[data-node-id="customer-1"]')).toHaveCount(0);
});
