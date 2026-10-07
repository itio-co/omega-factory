import { expect, it } from 'vitest';
import { addNode, configureNode, connect, createGame, tick } from './engine';
import {
  applyFactoryDraft,
  factoryCooldownTicks,
  placeFactorySlot,
  slotPoint,
  upgradeFactory,
} from './factory';
import { deserialize, serialize } from './persistence';

it('anchors new and migrated gates to separate factory wall slots', () => {
  let game = addNode(createGame(), 'import', { x: -500, y: 216 });
  const slot = game.definition.nodes.at(-1)!;
  expect(game.layout.positions[slot.id].x).toBe(slotPoint('import', 0).x);
  expect(game.layout.positions[slot.id].y).not.toBe(game.layout.positions['import-1'].y);
  expect(placeFactorySlot(game, 'export', -500).x).toBe(slotPoint('export', 0).x);
  game.layout.positions[slot.id].x = -500;
  game = deserialize(serialize(game));
  expect(game.layout.positions[slot.id].x).toBe(slotPoint('import', 0).x);
});

it('merges an edited layout without rewinding goods, deliveries, currency, or ticks', () => {
  let live = connect(createGame(), 'smelter-1', 'export-1');
  const draft = addNode(live, 'warehouse');
  const cost = draft.state.credits - live.state.credits;
  for (let i = 0; i < 80; i++) live = tick(live);
  const applied = applyFactoryDraft(live, draft, cost, 320);
  expect(applied.state.delivered).toEqual(live.state.delivered);
  expect(applied.state.tick).toBe(live.state.tick);
  expect(applied.state.nodes['smelter-1']).toEqual(live.state.nodes['smelter-1']);
  expect(applied.state.credits).toBe(live.state.credits - 320);
  expect(applied.state.factory.downtime).toBe(120);
  expect(deserialize(serialize(applied))).toEqual(applied);
});

it.each([
  [1, 120],
  [2, 80],
  [3, 40],
])('keeps level %i out of service for %i ticks then automatically resumes', (level, ticks) => {
  let game = createGame();
  game.state.factory.level = level;
  game = applyFactoryDraft(game, structuredClone(game), 0, 0);
  const before = structuredClone(game.state.nodes);
  for (let i = 0; i < ticks; i++) game = tick(game);
  expect(game.state.nodes).toEqual(before);
  expect(game.state.factory.downtime).toBe(0);
  game = tick(tick(game));
  expect(game.state.spent).toBe(2);
  expect(factoryCooldownTicks(level)).toBe(ticks);
});

it('checks live inventory before applying a draft resource change and bounds factory upgrades', () => {
  const live = createGame();
  const draft = configureNode(live, 'export-1', { resource: 'gear' });
  live.state.nodes['export-1'].inventory.ingot = 1;
  expect(() => applyFactoryDraft(live, draft, 0, 0)).toThrow(/received resources/);
  const upgraded = upgradeFactory(createGame());
  expect(upgraded.state.factory.level).toBe(2);
  expect(upgraded.state.factory.downtime).toBe(80);
  expect(upgraded.state.credits).toBe(1400);
  expect(() => upgradeFactory(upgraded)).toThrow(/service/);
});
