import { expect, it } from 'vitest';
import { addNode, claimContract, configureNode, connect, createGame, tick } from './engine';
import { capacity, emptyInventory } from './catalog';
import { deserialize, serialize } from './persistence';

function founded() {
  let game = connect(createGame(), 'smelter-1', 'export-1');
  for (let i = 0; i < 140; i++) game = tick(game);
  return claimContract(game);
}

it('offers a larger warehouse and gates new production behind the founding quest', () => {
  const game = addNode(createGame(), 'warehouse');
  expect(capacity(game.definition.nodes.at(-1)!)).toBe(96);
  expect(() => addNode(createGame(), 'press')).toThrow(/unlock|foundation|quest/i);
  expect(() => addNode(createGame(), 'wiremill')).toThrow(/unlock|foundation|quest/i);
  expect(() => addNode(founded(), 'fabricator')).toThrow(/unlock|plate|quest/i);
});

it.each([
  ['press', 2, 'plate', 4],
  ['wiremill', 1, 'wire', 3],
] as const)(
  'runs the %s recipe once without losing inputs or overflowing inventory',
  (kind, amount, output, steps) => {
    let game = addNode(founded(), kind);
    const id = game.definition.nodes.at(-1)!.id;
    game.state.nodes[id].inventory = { ...emptyInventory(), ingot: amount };
    game = tick(game);
    expect(game.state.nodes[id].inventory.ingot).toBe(0);
    for (let i = 0; i < steps; i++) game = tick(game);
    expect(game.state.nodes[id].inventory[output]).toBe(1);
    expect(game.state.nodes[id].completed).toBe(1);
    expect(() => configureNode(game, id, { resource: 'gear' })).toThrow(/fixed/);
    expect(deserialize(serialize(game))).toEqual(game);
  },
);

it('migrates inventories in earlier saves without losing existing goods', () => {
  const old = JSON.parse(serialize(founded()));
  delete old.state.quests;
  for (const inv of [
    old.state.delivered,
    ...Object.values(old.state.nodes).map((node: any) => node.inventory),
  ]) {
    delete inv.plate;
    delete inv.wire;
    delete inv.frame;
  }
  const restored = deserialize(JSON.stringify(old));
  expect(restored.state.delivered.ingot).toBe(old.state.delivered.ingot);
  expect(restored.state.delivered.plate).toBe(0);
  expect(() => addNode(restored, 'press')).not.toThrow();
  expect(restored.state.quests.claimed).toEqual([]);
});
