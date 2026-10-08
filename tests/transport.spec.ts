import { expect, test, type Page } from '@playwright/test';
import { createGame } from '../src/lib/game/engine';
import { createCollection, writeCollection } from '../src/lib/game/collection';
import { SAVE_KEY } from '../src/lib/game/persistence';
import type { TransportLink } from '../src/lib/game/transport-model';

/** Factory 2 = the starter factory with its line finished; Factory 3 holds a lone Iron-ingot Inlet. */
function save(links: TransportLink[] = [], inletStock = 0) {
  const a = createGame();
  // Finish the starter line so the Outlet actually produces ingots.
  a.definition.connections.push({ id: 'smelter-1:export-1', from: 'smelter-1', to: 'export-1' });
  const book = createCollection(a);
  const b = createGame();
  b.definition.nodes = b.definition.nodes
    .filter((n) => n.id === 'import-1')
    .map((n) => ({ ...n, resource: 'ingot' as const }));
  b.definition.connections = [];
  b.state.nodes = { 'import-1': b.state.nodes['import-1'] };
  b.state.nodes['import-1'].inventory.ingot = inletStock;
  b.layout.positions = { 'import-1': b.layout.positions['import-1'] };
  book.worlds[0].factories.push({ id: 'factory-3', name: 'Depot', category: 'factory', game: b });
  book.worlds[0].links = links;
  book.nextId = 10;
  return writeCollection(book);
}
async function open(page: Page, text: string) {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [SAVE_KEY, text],
  );
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Transport network' })).toBeVisible();
}
const outlet = (page: Page) =>
  page.getByRole('button', { name: 'Outlet export-1 of My first factory' });
const depotInlet = (page: Page) => page.getByRole('button', { name: 'Inlet import-1 of Depot' });
async function dragLink(page: Page, to = depotInlet(page)) {
  await outlet(page).scrollIntoViewIfNeeded();
  const a = (await outlet(page).boundingBox())!,
    b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('shows the locked state with fewer than two factories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await expect(page.getByTestId('transport-locked')).toContainText('build a second factory');
});

test('drags a link, undoes it, applies it, sees delivery and keeps it after reload', async ({
  page,
}) => {
  await open(page, save());
  await dragLink(page);
  await expect(page.getByRole('button', { name: /^Link link-/ })).toContainText('Draft');
  await expect(page.getByTestId('factory-io-factory-3')).toContainText('ingot ← My first factory');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Link link-/ })).toHaveCount(0);
  await dragLink(page);
  await page.getByRole('button', { name: 'Apply transport links · 250 CR' }).click();
  await expect(page.getByRole('button', { name: 'Link link-10' })).toBeVisible();
  await expect(depotInlet(page)).toHaveText(/· [1-9]\d*$/, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Link link-10' }).click();
  const inspector = page.getByRole('complementary', { name: 'Link inspector' });
  await expect(inspector).toContainText('Iron ingot');
  await expect(inspector).toContainText('2/tick');
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Link link-10' })).toBeVisible();
});

test('refuses an incompatible link and dims the port', async ({ page }) => {
  await open(page, save());
  const ownInlet = page.getByRole('button', { name: 'Inlet import-1 of My first factory' });
  await outlet(page).click();
  await expect(ownInlet).toHaveClass(/dim/);
  await expect(depotInlet(page)).not.toHaveClass(/dim/);
  await ownInlet.click();
  await expect(page.getByRole('status')).toContainText('Link refused');
  await expect(page.getByRole('button', { name: /^Link link-/ })).toHaveCount(0);
});

test('shows stalled feedback and a loss warning in the inspector', async ({ page }) => {
  const link: TransportLink = {
    id: 'link-9',
    from: { factory: 'factory-2', node: 'export-1' },
    to: { factory: 'factory-3', node: 'import-1' },
    resource: 'ingot',
    level: 1,
    delay: 2,
    enabled: true,
    transit: [{ amount: 2, remaining: 0 }],
  };
  await open(page, save([link], 8));
  const label = page.getByRole('button', { name: 'Link link-9' });
  await expect(label).toContainText('Stalled');
  await label.click();
  await expect(page.getByRole('complementary', { name: 'Link inspector' })).toContainText(
    'the Inlet in Depot is full',
  );
  await expect(page.getByRole('alert')).toContainText('Removing returns');
});
