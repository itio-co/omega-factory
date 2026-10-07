import { DISCOVERY_IDS, type Discovery, type Game } from './types';
export type { Discovery } from './types';

const OPERATORS = ['NOT', 'AND', 'OR', 'XOR', 'NAND'];
type Challenge = {
  title: string;
  name: string;
  description: string;
  hint: string;
  example: string;
  reward: string;
  inputs: string[];
  operators: string[];
  prerequisites: Discovery[];
  expected: (a: boolean, b: boolean, c: boolean) => boolean;
};
export const DISCOVERIES: Record<Discovery, Challenge> = {
  and: {
    title: 'The Gatekeeper',
    name: 'AND',
    description: 'Output 1 only when both inputs are 1.',
    hint: 'NAND reverses AND. What happens if you negate its result?',
    example: 'NOT(NAND(A, B))',
    reward: 'Unlocks the assembler',
    inputs: ['A', 'B'],
    operators: OPERATORS,
    prerequisites: [],
    expected: (a, b) => a && b,
  },
  or: {
    title: 'The Decision Maker',
    name: 'OR',
    description: 'Output 1 when at least one input is 1.',
    hint: 'Try feeding two negated inputs into NAND.',
    example: 'NAND(NOT(A), NOT(B))',
    reward: 'A new entry in your Insight Journal',
    inputs: ['A', 'B'],
    operators: OPERATORS,
    prerequisites: [],
    expected: (a, b) => a || b,
  },
  xor: {
    title: 'Different, together',
    name: 'XOR',
    description: 'Output 1 when the inputs are different.',
    hint: 'Both OR and NAND must be true at the same time.',
    example: 'AND(OR(A, B), NAND(A, B))',
    reward: 'One of three foundations for Advanced beginner',
    inputs: ['A', 'B'],
    operators: OPERATORS,
    prerequisites: [],
    expected: (a, b) => a !== b,
  },
  implies: {
    title: 'A promise kept',
    name: 'IMPLIES',
    description:
      'Output 0 only when A is 1 and B is 0. If the condition A holds, the promise B must hold too.',
    hint: 'A promise is satisfied when its condition is absent, or its result is present.',
    example: 'OR(NOT(A), B)',
    reward: 'Competent · Logic',
    inputs: ['A', 'B'],
    operators: OPERATORS,
    prerequisites: ['and', 'or', 'xor'],
    expected: (a, b) => !a || b,
  },
  majority: {
    title: 'Two voices agree',
    name: 'MAJORITY',
    description: 'Output 1 when at least two of A, B, and C are 1. Check all eight combinations.',
    hint: 'Either A and B agree on 1, or C is 1 together with at least one of the other inputs.',
    example: 'OR(AND(A, B), AND(C, OR(A, B)))',
    reward: 'Proficient · Logic',
    inputs: ['A', 'B', 'C'],
    operators: OPERATORS,
    prerequisites: ['implies'],
    expected: (a, b, c) => Number(a) + Number(b) + Number(c) >= 2,
  },
  selector: {
    title: 'One gate, many possibilities',
    name: 'SELECTOR',
    description:
      'Choose A when C is 0 and B when C is 1. Build the whole selector using only NAND gates.',
    hint: 'NAND(C, C) negates C. Gate A with that result, gate B with C, then combine their negated outputs.',
    example: 'NAND(NAND(A, NAND(C, C)), NAND(B, C))',
    reward: 'Expert · Logic',
    inputs: ['A', 'B', 'C'],
    operators: ['NAND'],
    prerequisites: ['majority'],
    expected: (a, b, c) => (c ? b : a),
  },
};

export const LEARNING_TIERS = ['Novice', 'Advanced beginner', 'Competent', 'Proficient', 'Expert'];
export function discoveryUnlocked(game: Game, target: Discovery): boolean {
  return DISCOVERIES[target].prerequisites.every((id) =>
    game.state.journal.some((entry) => entry.id === id),
  );
}
export function learningProgress(game: Game) {
  const found = new Set(game.state.journal.map((entry) => entry.id));
  const milestones = [
    ['and', 'or', 'xor'].every((id) => found.has(id as Discovery)),
    found.has('implies'),
    found.has('majority'),
    found.has('selector'),
  ];
  let tierIndex = 0;
  for (const achieved of milestones) {
    if (!achieved) break;
    tierIndex++;
  }
  return {
    tierIndex,
    tier: LEARNING_TIERS[tierIndex],
    completed: found.size,
    total: DISCOVERY_IDS.length,
    next: DISCOVERY_IDS.find((id) => !found.has(id) && discoveryUnlocked(game, id)) ?? null,
  };
}

type Expr = { op: string; children: Expr[] };
function parseRule(source: string): Expr {
  if (source.length > 256) throw new Error('Keep your rule under 256 characters.');
  const tokens = source.toUpperCase().match(/[A-Z]+|[(),]|\S/g) ?? [];
  let index = 0;
  function parse(depth: number): Expr {
    if (depth > 24) throw new Error('This rule is nested too deeply.');
    const op = tokens[index++];
    if (op === 'A' || op === 'B' || op === 'C') return { op, children: [] };
    if (!OPERATORS.includes(op)) throw new Error('Use A, B, C, NOT, AND, OR, XOR, or NAND.');
    if (tokens[index++] !== '(') throw new Error(`Expected ( after ${op}.`);
    const children = [parse(depth + 1)];
    if (op !== 'NOT') {
      if (tokens[index++] !== ',') throw new Error(`${op} needs two inputs separated by a comma.`);
      children.push(parse(depth + 1));
    }
    if (tokens[index++] !== ')') throw new Error('Check the closing parentheses in your rule.');
    return { op, children };
  }
  const expression = parse(0);
  if (index !== tokens.length) throw new Error('Unexpected text after the rule.');
  return expression;
}
function evaluate(expr: Expr, a: boolean, b: boolean, c: boolean): boolean {
  if (expr.op === 'A') return a;
  if (expr.op === 'B') return b;
  if (expr.op === 'C') return c;
  const left = evaluate(expr.children[0], a, b, c);
  if (expr.op === 'NOT') return !left;
  const right = evaluate(expr.children[1], a, b, c);
  switch (expr.op) {
    case 'AND':
      return left && right;
    case 'OR':
      return left || right;
    case 'NAND':
      return !(left && right);
    case 'XOR':
      return left !== right;
    default:
      throw new Error('Unknown operator.');
  }
}
export function evaluateRule(source: string, a: boolean, b: boolean, c = false): boolean {
  return evaluate(parseRule(source), a, b, c);
}
export function checkRule(source: string, target: Discovery) {
  const expr = parseRule(source);
  const mission = DISCOVERIES[target];
  const used = new Set<string>();
  function inspect(node: Expr) {
    if (!node.children.length && !mission.inputs.includes(node.op))
      throw new Error(
        `This challenge uses only inputs ${mission.inputs.join(' and ')}; ${node.op} is unavailable.`,
      );
    if (node.children.length) used.add(node.op);
    node.children.forEach(inspect);
  }
  inspect(expr);
  const constraints = [...used].some((op) => !mission.operators.includes(op))
    ? [`Use only ${mission.operators.join(', ')} gates for this challenge.`]
    : [];
  const threeInputs = mission.inputs.length === 3;
  const rows = Array.from({ length: threeInputs ? 8 : 4 }, (_, index) => {
    const a = !!(index & (threeInputs ? 4 : 2));
    const b = !!(index & (threeInputs ? 2 : 1));
    const c = threeInputs && !!(index & 1);
    return { a, b, c, actual: evaluate(expr, a, b, c), expected: mission.expected(a, b, c) };
  });
  return {
    success: !constraints.length && rows.every((row) => row.actual === row.expected),
    rows,
    constraints,
  };
}
export function discoverRule(game: Game, target: Discovery, source: string): Game {
  if (!discoveryUnlocked(game, target))
    throw new Error(
      `Complete ${DISCOVERIES[target].prerequisites.map((id) => DISCOVERIES[id].name).join(', ')} to unlock this challenge.`,
    );
  const result = checkRule(source, target);
  if (result.constraints.length) throw new Error(result.constraints.join(' '));
  if (!result.success)
    throw new Error('Not all input combinations match yet. Check the truth table and try again.');
  if (game.state.journal.some((entry) => entry.id === target)) return game;
  const next = structuredClone(game);
  next.state.journal.push({
    id: target,
    title: DISCOVERIES[target].title,
    expression: source.trim(),
    tick: game.state.tick,
  });
  next.state.credits += 100;
  next.state.earned += 100;
  return next;
}
