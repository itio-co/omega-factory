import { expect, it } from 'vitest';
import { checkRule, discoverRule, evaluateRule, learningProgress } from './logic';
import { addNode, createGame } from './engine';
import { deserialize, serialize } from './persistence';

it('evaluates composed rules without executing arbitrary code', () => {
  expect(evaluateRule('NAND(NAND(A, B), NAND(A, B))', true, false)).toBe(false);
  expect(evaluateRule('NAND(NAND(A, B), NAND(A, B))', true, true)).toBe(true);
  expect(() => evaluateRule('alert(1)', true, true)).toThrow();
});
it('checks every truth-table row rather than a single successful example', () => {
  expect(checkRule('A', 'and').success).toBe(false);
  expect(checkRule('NAND(NAND(A, B), NAND(A, B))', 'and').success).toBe(true);
  expect(checkRule('NAND(NOT(A), NOT(B))', 'or').success).toBe(true);
});
it('records a rediscovery once, persists its evidence, and unlocks assembly', () => {
  const game = createGame();
  const found = discoverRule(game, 'and', 'NAND(NAND(A, B), NAND(A, B))');
  expect(found.state.journal).toHaveLength(1);
  expect(found.state.credits).toBe(game.state.credits + 100);
  expect(discoverRule(found, 'and', 'AND(A, B)').state.credits).toBe(found.state.credits);
  expect(addNode(found, 'assembler').definition.nodes).toHaveLength(7);
  expect(deserialize(serialize(found))).toEqual(found);
});
it('bounds malformed, deep, and oversized expressions', () => {
  for (const rule of [
    'AND(A)',
    'AND(A,B)junk',
    'NOT('.repeat(30) + 'A' + ')'.repeat(30),
    'A'.repeat(1000),
  ]) {
    expect(() => evaluateRule(rule, false, true)).toThrow();
  }
});

it('checks implication and every combination of three-input challenges', () => {
  expect(checkRule('OR(NOT(A), B)', 'implies').success).toBe(true);
  expect(checkRule('OR(A, B)', 'implies').success).toBe(false);
  const majority = checkRule('OR(AND(A, B), AND(C, OR(A, B)))', 'majority');
  expect(majority.success).toBe(true);
  expect(majority.rows).toHaveLength(8);
  expect(majority.rows.map((row) => +row.expected)).toEqual([0, 0, 0, 1, 0, 1, 1, 1]);
  expect(checkRule('AND(A, B)', 'majority').success).toBe(false);
  const selector = checkRule('NAND(NAND(A,NAND(C,C)),NAND(B,C))', 'selector');
  expect(selector.success).toBe(true);
  expect(selector.rows.map((row) => +row.expected)).toEqual([0, 0, 0, 1, 1, 0, 1, 1]);
});

it('enforces the NAND-only selector constraint and rejects extra inputs on two-input rules', () => {
  expect(checkRule('OR(AND(A,NOT(C)),AND(B,C))', 'selector').success).toBe(false);
  expect(() => checkRule('OR(A,C)', 'or')).toThrow(/C|input/i);
});

it('requires earlier discoveries, grants advanced rewards only once, and restores all evidence', () => {
  let game = createGame();
  expect(learningProgress(game).tier).toBe('Novice');
  expect(() => discoverRule(game, 'implies', 'OR(NOT(A),B)')).toThrow(/complete|unlock/i);
  const solutions = [
    ['and', 'NOT(NAND(A,B))', 'Novice'],
    ['or', 'NAND(NOT(A),NOT(B))', 'Novice'],
    ['xor', 'AND(OR(A,B),NAND(A,B))', 'Advanced beginner'],
    ['implies', 'OR(NOT(A),B)', 'Competent'],
    ['majority', 'OR(AND(A,B),AND(C,OR(A,B)))', 'Proficient'],
    ['selector', 'NAND(NAND(A,NAND(C,C)),NAND(B,C))', 'Expert'],
  ] as const;
  for (const [id, expression, tier] of solutions) {
    const before = game.state.credits;
    game = discoverRule(game, id, expression);
    expect(learningProgress(game).tier).toBe(tier);
    expect(game.state.credits).toBe(before + 100);
    expect(discoverRule(game, id, expression)).toBe(game);
    expect(deserialize(serialize(game))).toEqual(game);
  }
  expect(game.state.journal).toHaveLength(6);
  expect(learningProgress(game).next).toBeNull();
  const forbidden = structuredClone(game);
  forbidden.state.journal.at(-1)!.expression = 'OR(AND(A,NOT(C)),AND(B,C))';
  expect(() => deserialize(serialize(forbidden))).toThrow();
  const invalid = structuredClone(game);
  invalid.state.journal = invalid.state.journal.filter((entry) => entry.id !== 'implies');
  expect(() => deserialize(serialize(invalid))).toThrow();
  const backdated = structuredClone(game);
  backdated.state.tick = 10;
  for (const entry of backdated.state.journal.slice(0, 3)) entry.tick = 10;
  expect(() => deserialize(serialize(backdated))).toThrow();
  const reordered = structuredClone(game);
  const implication = reordered.state.journal.splice(3, 1)[0];
  reordered.state.journal.unshift(implication);
  expect(() => deserialize(serialize(reordered))).toThrow();
});
