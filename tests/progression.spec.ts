import { expect, test } from '@playwright/test';

test('progresses from novice to expert through verified discoveries and retains progress', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the factory' }).click();
  await page.getByRole('button', { name: 'Open Logic Lab' }).click();
  await expect(page.getByRole('button', { name: 'IMPLIES', exact: true })).toBeDisabled();
  for (const [name, expression] of [
    ['AND', 'NOT(NAND(A,B))'],
    ['OR', 'NAND(NOT(A),NOT(B))'],
    ['XOR', 'AND(OR(A,B),NAND(A,B))'],
    ['IMPLIES', 'OR(NOT(A),B)'],
    ['MAJORITY', 'OR(AND(A,B),AND(C,OR(A,B)))'],
    ['SELECTOR', 'NAND(NAND(A,NAND(C,C)),NAND(B,C))'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    if (name === 'SELECTOR') {
      await expect(page.getByTestId('learning-tier')).toHaveText('Proficient');
      await page.getByLabel('Your rule', { exact: true }).fill('OR(AND(A,NOT(C)),AND(B,C))');
      await page.getByRole('button', { name: 'Test all inputs' }).click();
      await expect(
        page.getByText('Use only NAND gates for this challenge.', { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Record insight' })).toHaveCount(0);
    }
    await page.getByLabel('Your rule', { exact: true }).fill(expression);
    await page.getByRole('button', { name: 'Test all inputs' }).click();
    await page.getByRole('button', { name: 'Record insight' }).click();
    await expect(page.getByText('Insight already recorded', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record insight' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Open Insight Journal' }).click();
  await expect(page.getByTestId('learning-tier')).toHaveText('Expert');
  await expect(page.locator('.journal-entries article')).toHaveCount(6);
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Save factory', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open Insight Journal' }).click();
  await expect(page.getByTestId('learning-tier')).toHaveText('Expert');
});
