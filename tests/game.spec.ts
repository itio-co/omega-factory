import { test, expect } from '@playwright/test';
import { createGame } from '../src/lib/game/engine';

async function enter(page: any) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
}
async function interior(page: any) {
  await enter(page);
  await page.getByRole('button', { name: 'Open factory interior' }).click();
}

test('runs one factory automatically, applies a draft with downtime, and restores live progress', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  await expect(page.getByTestId('world-factory')).toHaveCount(1);
  await expect(page.locator('.node-card')).toHaveCount(0);
  await expect(page.getByTestId('tick-count')).not.toHaveText('0000');
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Connect Smelter output', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Export gate input', exact: true }).click();
  await page.getByRole('button', { name: '4× speed' }).click();
  await page.getByRole('button', { name: 'Apply factory update' }).click();
  await expect(page.getByTestId('factory-service')).toContainText('Out of service');
  await expect(page.getByTestId('delivered-count')).toHaveText('0');
  await expect(page.getByTestId('factory-service')).toContainText('In service', { timeout: 15000 });
  await expect(page.getByTestId('delivered-count')).not.toHaveText('0', { timeout: 10000 });
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  const ticks = Number(await page.getByTestId('tick-count').textContent());
  await page.reload();
  await expect
    .poll(async () => Number(await page.getByTestId('tick-count').textContent()))
    .toBeGreaterThanOrEqual(ticks);
  expect(errors).toEqual([]);
});

test('builds and undoes within a draft without installing it in the live factory', async ({
  page,
}) => {
  await interior(page);
  await page.getByRole('button', { name: 'Build Storage', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('7');
  await expect(page.getByRole('heading', { name: 'Storage', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'World', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('7');
  await page.getByRole('button', { name: /Factory interior/ }).click();
  await expect(page.getByTestId('node-count')).toHaveText('7');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('node-count')).toHaveText('6');
});

test('invalid imported save preserves the factory', async ({ page }) => {
  await enter(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole('status')).toContainText('not a valid');
  await expect(page.getByTestId('node-count')).toHaveText('6');
});

test('tablet users can connect wall slots and apply a factory update', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).tap();
  await page.getByRole('button', { name: 'Open factory interior' }).tap();
  await page.getByRole('button', { name: 'Connect Smelter output', exact: true }).tap();
  await page.getByRole('button', { name: 'Connect Export gate input', exact: true }).tap();
  await page.getByRole('button', { name: 'Apply factory update' }).tap();
  await expect(page.getByTestId('factory-service')).toContainText('Out of service');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('a route can be selected with the mouse and disconnected in a draft', async ({ page }) => {
  await interior(page);
  await page.getByRole('button', { name: 'Fit factory' }).click();
  const route = page.locator('.route-hit').first();
  const point = await route.evaluate((element) => {
    const path = element as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(point.x, point.y);
  await page.getByRole('button', { name: 'Disconnect selected route', exact: true }).click();
  await expect(page.locator('.route-hit')).toHaveCount(1);
});

test('rediscovery unlocks assembly and persists its journal entry', async ({ page }) => {
  await interior(page);
  await expect(page.getByRole('button', { name: 'Build Assembler', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open Logic Lab' }).click();
  await page.getByLabel('Your rule', { exact: true }).fill('NOT(NAND(A, B))');
  await page.getByRole('button', { name: 'Test all inputs' }).click();
  await page.getByRole('button', { name: 'Record insight' }).click();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await expect(page.getByRole('button', { name: 'Build Assembler', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open Insight Journal' }).click();
  await expect(page.getByText('NOT(NAND(A, B))', { exact: true })).toBeVisible();
});

test('occupied nodes cannot change resource while editing', async ({ page }) => {
  const game = createGame();
  game.state.nodes['export-1'].inventory.ingot = 1;
  game.definition.nodes.find((n) => n.id === 'export-1')!.enabled = false;
  await enter(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'occupied.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(game)),
  });
  await page.getByRole('button', { name: 'Open factory interior' }).click();
  await page.getByRole('button', { name: 'Select Export gate', exact: true }).click();
  await expect(page.getByLabel('Node resource')).toBeDisabled();
  await expect(page.getByLabel('Node resource')).toHaveValue('ingot');
});
