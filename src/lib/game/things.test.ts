import { expect, it } from 'vitest';
import { createGame } from './engine';
import { worldThing, availableThings } from './things';

it('models World and Factory as enclosure Things whose ports belong to their scope', () => {
  const world = worldThing(createGame());
  expect(world.category).toBe('world');
  expect(world.scope?.plane).toBe('world');
  expect(world.scope?.things.map((t) => t.category)).toEqual(['factory', 'supplier', 'customer']);
  const factory = world.scope!.things[0];
  expect(factory.scope?.plane).toBe('interior');
  expect(factory.scope?.things.map((t) => t.category)).toEqual(['storage', 'smelter']);
  expect(factory.scope?.inlets.map((p) => p.id)).toEqual(['import-1']);
  expect(factory.scope?.outlets.map((p) => p.id)).toEqual(['export-1']);
});
it('filters the same purchasable Things by active plane and keeps scope ports separate', () => {
  expect(availableThings('world').map(([kind]) => kind)).toEqual(['supplier', 'customer']);
  const interior = availableThings('interior').map(([kind]) => kind);
  expect(interior).toContain('smelter');
  expect(interior).not.toContain('supplier');
  expect(interior).not.toContain('import');
});
