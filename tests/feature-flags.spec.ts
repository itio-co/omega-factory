import { expect, test, type Page, type Route } from '@playwright/test';

const wishButton = (page: Page) => page.getByRole('button', { name: 'Make a Wish', exact: true });

async function enterFactory(page: Page, settled: Promise<unknown>) {
  await page.goto('/');
  await settled;
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await expect(page.getByRole('button', { name: 'Save factory' })).toBeVisible();
}

test('Wish UI is hidden with the shipped config.json (all features off)', async ({ page }) => {
  const config = page.waitForResponse('**/config.json');
  await enterFactory(page, config);
  expect(await (await config).json()).toEqual({
    features: { wishes: false, maximizeOnLaunch: false },
  });
  await expect(wishButton(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Make a Wish' })).toHaveCount(0);
});

test('Wish UI appears when config.json turns wishes on, without a rebuild', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { features: { wishes: true } } }),
  );
  await enterFactory(page, Promise.resolve());
  await expect(wishButton(page)).toBeVisible();
  await wishButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Make a Wish' })).toBeVisible();
});

const failures: [string, (route: Route) => Promise<void>][] = [
  ['404', (route) => route.fulfill({ status: 404, body: 'Not found' })],
  ['500', (route) => route.fulfill({ status: 500, json: { features: { wishes: true } } })],
  ['invalid JSON', (route) => route.fulfill({ body: '<html>not json</html>' })],
  ['a network failure', (route) => route.abort('failed')],
];
for (const [name, handle] of failures) {
  test(`Wish UI stays hidden when config.json fails with ${name}`, async ({ page }) => {
    let served!: () => void;
    const settled = new Promise<void>((resolve) => (served = resolve));
    await page.route('**/config.json', async (route) => {
      await handle(route);
      served();
    });
    await enterFactory(page, settled);
    await expect(wishButton(page)).toHaveCount(0);
  });
}

test('the game and the launch maximizer share one config.json request', async ({ page }) => {
  let requests = 0;
  await page.route('**/config.json', (route) => {
    requests += 1;
    return route.fulfill({ json: { features: { wishes: true, maximizeOnLaunch: true } } });
  });
  await enterFactory(page, Promise.resolve());
  await expect(wishButton(page)).toBeVisible();
  // A browser tab is not standalone, so maximizeOnLaunch leaves no launch marker.
  expect(
    await page.evaluate(() => sessionStorage.getItem('omega-factory-launch-maximized')),
  ).toBeNull();
  expect(requests).toBe(1);
});
