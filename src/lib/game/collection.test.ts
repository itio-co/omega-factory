import { expect, it } from 'vitest';
import { createGame } from './engine';
import {
  createCollection,
  addCategory,
  addWorld,
  addFactory,
  readCollection,
  writeCollection,
} from './collection';

it('migrates an old save and preserves multiple Worlds, Factory Things, and categories', () => {
  let book = readCollection(JSON.stringify(createGame()));
  book = addCategory(book, 'Laboratory', 'factory');
  const category = book.categories.at(-1)!.id;
  book = addFactory(book, category);
  expect(book.worlds[0].factories).toHaveLength(2);
  expect(book.worlds[0].factories[1].category).toBe(category);
  expect(book.worlds[0].factories[1].game.definition.nodes).toHaveLength(0);
  book = addWorld(book, 'world');
  expect(book.worlds).toHaveLength(2);
  expect(readCollection(writeCollection(book))).toEqual(book);
});
it('funds new factories without duplicating money or existing inventories', () => {
  const initial = createCollection(createGame());
  const next = addFactory(initial, 'factory');
  expect(next.worlds[0].factories[0].game.state.credits).toBe(900);
  expect(next.worlds[0].factories[1].game.state.credits).toBe(1000);
  expect(initial.worlds[0].factories[0].game.state.credits).toBe(2400);
  expect(next.worlds[0].factories[1].game.state.nodes).toEqual({});
});
it('rejects invalid ownership and category references without replacing valid data', () => {
  const book = createCollection(createGame());
  const bad = structuredClone(book);
  bad.worlds[0].factories[0].category = 'missing';
  expect(() => readCollection(JSON.stringify(bad))).toThrow();
  expect(() => addFactory(book, 'world')).toThrow();
  expect(() => addCategory(book, 'Factory', 'factory')).toThrow();
});
