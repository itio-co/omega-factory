import { expect, it } from 'vitest';
import { addNode, createGame } from './engine';
import { deserialize, serialize } from './persistence';
import { FACTORY_WALL } from './factory';

it('places external suppliers and customers outside the factory even when built inside it', () => {
  for (const kind of ['supplier', 'customer'] as const) {
    const game = addNode(createGame(), kind, { x: 700, y: 300 });
    const id = game.definition.nodes.at(-1)!.id;
    const x = game.layout.positions[id].x;
    if (kind === 'supplier') expect(x + 216).toBeLessThan(FACTORY_WALL.x);
    else expect(x).toBeGreaterThan(FACTORY_WALL.x + FACTORY_WALL.width);
  }
});
it('keeps internal machines on the interior plane when built outside it', () => {
  const game = addNode(createGame(), 'storage', { x: -500, y: -400 });
  const point = game.layout.positions[game.definition.nodes.at(-1)!.id];
  expect(point.x).toBeGreaterThan(FACTORY_WALL.x);
  expect(point.y).toBeGreaterThan(FACTORY_WALL.y);
});
it('migrates misplaced components without changing inventory or routes', () => {
  const old = createGame();
  old.layout.positions['supplier-1'] = { x: 700, y: 300 };
  old.layout.positions['customer-1'] = { x: 700, y: 500 };
  const restored = deserialize(serialize(old));
  expect(restored.layout.positions['supplier-1'].x + 216).toBeLessThan(FACTORY_WALL.x);
  expect(restored.layout.positions['customer-1'].x).toBeGreaterThan(
    FACTORY_WALL.x + FACTORY_WALL.width,
  );
  expect(restored.definition.connections).toEqual(old.definition.connections);
  expect(restored.state.nodes).toEqual(old.state.nodes);
});

it('requires wall slots when connecting external partners to the interior', async () => {
  const { connect } = await import('./engine');
  const game = createGame();
  expect(() => connect(game, 'supplier-1', 'storage-1')).toThrow(/import slot/i);
  expect(() => connect(game, 'smelter-1', 'customer-1')).toThrow(/export slot/i);
  expect(() => connect(game, 'smelter-1', 'export-1')).not.toThrow();
});
it('migrates legacy direct external routes through slots without losing goods', () => {
  const old = createGame();
  old.definition.connections.push({
    id: 'smelter-1:customer-1',
    from: 'smelter-1',
    to: 'customer-1',
  });
  const game = deserialize(serialize(old));
  expect(game.definition.connections.some((e) => e.id === 'smelter-1:customer-1')).toBe(false);
  const edge = game.definition.connections.find((e) => e.from === 'smelter-1')!;
  expect(game.definition.nodes.find((n) => n.id === edge.to)?.kind).toBe('export');
  expect(game.definition.connections.some((e) => e.from === edge.to && e.to === 'customer-1')).toBe(
    true,
  );
  for (const node of old.definition.nodes)
    expect(game.state.nodes[node.id]).toEqual(old.state.nodes[node.id]);
  expect(deserialize(serialize(game))).toEqual(game);
});
it('reuses a matching boundary port to migrate a full legacy factory', () => {
  let game = createGame();
  while (game.definition.nodes.length < 200) game = addNode(game, 'customer');
  game.definition.connections.push({
    id: 'smelter-1:customer-1',
    from: 'smelter-1',
    to: 'customer-1',
  });
  const restored = deserialize(serialize(game));
  expect(restored.definition.nodes).toHaveLength(200);
  expect(
    restored.definition.connections.some((e) => e.from === 'smelter-1' && e.to === 'export-1'),
  ).toBe(true);
  expect(
    restored.definition.connections.filter((e) => e.from === 'export-1' && e.to === 'customer-1'),
  ).toHaveLength(1);
});
it('migrates legacy external coordinates into the reachable World map', () => {
  const old = createGame();
  old.layout.positions['supplier-1'] = { x: -500, y: -500 };
  old.layout.positions['customer-1'] = { x: 1320, y: 0 };
  const next = deserialize(serialize(old));
  expect(next.layout.positions['supplier-1'].x).toBeGreaterThanOrEqual(0);
  expect(next.layout.positions['supplier-1'].y).toBeGreaterThanOrEqual(80);
  expect(next.layout.positions['customer-1'].y).toBeGreaterThanOrEqual(300);
});
