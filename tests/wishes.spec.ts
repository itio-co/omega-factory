import { expect, test } from '@playwright/test';

// The Wish UI ships behind a runtime flag (default off); these tests turn it on.
test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { features: { wishes: true } } }),
  );
});

const story = (id: string) => ({
  id: `20261007120000_wish-${id}`,
  slug: `wish-${id}`,
  path: `omega-factory/202610/20261007120000_wish-${id}`,
});

test('submits a Unicode Wish and announces its story without affecting the game', async ({
  page,
}) => {
  let submitted: { requestId: string; text: string } | undefined;
  await page.route('**/api/wishes', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      json: { id: submitted!.requestId, status: 'submitted', story: story(submitted!.requestId) },
      status: 201,
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Make a Wish' });
  await dialog.getByLabel('Your Wish').fill('เพิ่มโรงงาน 🌱\nMore room, please!');
  await dialog.getByRole('button', { name: 'Send Wish', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Wish submitted');
  expect(submitted!.text).toBe('เพิ่มโรงงาน 🌱\nMore room, please!');
  await expect(dialog).toContainText(story(submitted!.requestId).id);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Make a Wish', exact: true })).toBeFocused();
});

test('preserves text and request identity after a lost response, pending story and reload', async ({
  page,
}) => {
  const requests: { requestId: string; text: string }[] = [];
  await page.route('**/api/wishes', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) return route.abort('failed');
    if (requests.length === 2)
      return route.fulfill({
        status: 202,
        json: { id: body.requestId, status: 'pending', story: null },
      });
    await route.fulfill({
      status: 200,
      json: { id: body.requestId, status: 'submitted', story: story(body.requestId) },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  await page.getByLabel('Your Wish').fill('Keep my idea');
  await page.getByRole('button', { name: 'Send Wish', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('retry');
  await page.reload();
  const welcome = page.getByRole('button', { name: 'Enter the factory' });
  if (await welcome.isVisible()) await welcome.click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  await expect(page.getByLabel('Your Wish')).toHaveValue('Keep my idea');
  await expect(page.getByLabel('Your Wish')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Retry Wish', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Story creation is pending');
  await page.getByRole('button', { name: 'Retry Wish', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Wish submitted');
  expect(new Set(requests.map((r) => r.requestId)).size).toBe(1);
  expect(requests.every((r) => r.text === 'Keep my idea')).toBe(true);
});

test('rejects false success and traps keyboard focus inside the modal', async ({ page }) => {
  await page.route('**/api/wishes', (route) =>
    route.fulfill({ status: 200, json: { status: 'submitted' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Make a Wish' });
  await dialog.getByLabel('Your Wish').fill('No invented success');
  await dialog.getByRole('button', { name: 'Send Wish', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('retry');
  await expect(dialog).not.toContainText('Wish submitted');
  const last = dialog.getByRole('button', { name: 'Retry Wish', exact: true });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close Wish form' })).toBeFocused();
});

test('keeps an unsent draft intact across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  await page.getByLabel('Your Wish').fill('Unsent idea 🌱');
  await page.reload();
  const welcome = page.getByRole('button', { name: 'Enter the factory' });
  if (await welcome.isVisible()) await welcome.click();
  await page.getByRole('button', { name: 'Make a Wish', exact: true }).click();
  await expect(page.getByLabel('Your Wish')).toHaveValue('Unsent idea 🌱');
});
