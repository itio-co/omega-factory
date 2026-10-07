import { z } from 'zod';
import { createGame } from './engine';
import { deserialize } from './persistence';
import type { Game } from './types';

export type EnclosureCategory = { id: string; name: string; template: 'world' | 'factory' };
export type FactoryThing = { id: string; name: string; category: string; game: Game };
export type WorldThing = { id: string; name: string; category: string; factories: FactoryThing[] };
export type Collection = {
  version: 2;
  nextId: number;
  categories: EnclosureCategory[];
  worlds: WorldThing[];
  activeWorld: string;
  activeFactory: string;
};
export const FACTORY_PRICE = 500,
  FACTORY_BUDGET = 1000;
export function createCollection(game = createGame()): Collection {
  return {
    version: 2,
    nextId: 3,
    categories: [
      { id: 'world', name: 'World', template: 'world' },
      { id: 'factory', name: 'Factory', template: 'factory' },
    ],
    worlds: [
      {
        id: 'world-1',
        name: 'Local world',
        category: 'world',
        factories: [{ id: 'factory-2', name: 'My first factory', category: 'factory', game }],
      },
    ],
    activeWorld: 'world-1',
    activeFactory: 'factory-2',
  };
}
export function activeWorld(book: Collection) {
  return book.worlds.find((w) => w.id === book.activeWorld)!;
}
export function activeFactory(book: Collection) {
  return activeWorld(book).factories.find((f) => f.id === book.activeFactory)!;
}
function category(book: Collection, id: string, template: EnclosureCategory['template']) {
  const found = book.categories.find((c) => c.id === id && c.template === template);
  if (!found) throw new Error('This category is not compatible with this scope.');
  return found;
}
export function addCategory(
  book: Collection,
  name: string,
  template: EnclosureCategory['template'],
): Collection {
  name = name.trim();
  if (!name || name.length > 40) throw new Error('Category names need 1–40 characters.');
  if (book.categories.length >= 24) throw new Error('This collection supports 24 categories.');
  if (book.categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    throw new Error('That category already exists.');
  if (template !== 'world' && template !== 'factory') throw new Error('Unknown category behavior.');
  const next = structuredClone(book);
  next.categories.push({ id: `category-${next.nextId++}`, name, template });
  return next;
}
export function addWorld(book: Collection, categoryId: string): Collection {
  const type = category(book, categoryId, 'world');
  if (book.worlds.length >= 8) throw new Error('This collection supports 8 Worlds.');
  const next = structuredClone(book),
    id = `world-${next.nextId++}`,
    factoryId = `factory-${next.nextId++}`;
  next.worlds.push({
    id,
    name: `${type.name} ${next.worlds.length + 1}`,
    category: categoryId,
    factories: [
      { id: factoryId, name: 'My first factory', category: 'factory', game: createGame() },
    ],
  });
  next.activeWorld = id;
  next.activeFactory = factoryId;
  return next;
}
export function addFactory(book: Collection, categoryId: string): Collection {
  const type = category(book, categoryId, 'factory');
  if (activeWorld(book).factories.length >= 16)
    throw new Error('This World supports 16 Factory Things.');
  if (activeFactory(book).game.state.credits < FACTORY_PRICE + FACTORY_BUDGET)
    throw new Error(
      'A new Factory needs 1,500 CR: 500 to build and 1,000 transferred as its budget.',
    );
  const next = structuredClone(book);
  const source = activeFactory(next).game;
  source.state.credits -= FACTORY_PRICE + FACTORY_BUDGET;
  source.state.spent += FACTORY_PRICE;
  const game = createGame();
  game.definition.nodes = [];
  game.definition.connections = [];
  game.layout.positions = {};
  game.state.nodes = {};
  game.state.credits = FACTORY_BUDGET;
  const id = `factory-${next.nextId++}`,
    world = activeWorld(next);
  world.factories.push({
    id,
    name: `${type.name} ${world.factories.length + 1}`,
    category: categoryId,
    game,
  });
  return next;
}
const identifier = z
  .string()
  .regex(/^[a-z]+(?:-\d+)?$/)
  .max(60);
const name = z.string().trim().min(1).max(80);
const schema = z
  .object({
    version: z.literal(2),
    nextId: z.number().int().min(3).max(1000000),
    categories: z
      .array(
        z
          .object({ id: identifier, name: name.max(40), template: z.enum(['world', 'factory']) })
          .strict(),
      )
      .min(2)
      .max(24),
    worlds: z
      .array(
        z
          .object({
            id: identifier,
            name,
            category: identifier,
            factories: z
              .array(
                z
                  .object({ id: identifier, name, category: identifier, game: z.unknown() })
                  .strict(),
              )
              .min(1)
              .max(16),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    activeWorld: identifier,
    activeFactory: identifier,
  })
  .strict();
export function writeCollection(book: Collection) {
  return JSON.stringify(book);
}
export function readCollection(text: string): Collection {
  if (text.length > 16000000) throw new Error('Collection save is too large (maximum 16 MB).');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid Things save.');
  }
  if ((parsed as { version?: number })?.version === 1) return createCollection(deserialize(text));
  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error('This is not a valid Things collection.');
  const data = result.data;
  const ids = new Set<string>();
  const register = (id: string) => {
    if (ids.has(id)) throw new Error('Duplicate Thing or category identity.');
    ids.add(id);
    const suffix = Number(id.split('-')[1]);
    if (suffix >= data.nextId) throw new Error('Invalid next Thing identity.');
  };
  for (const c of data.categories) register(c.id);
  if (
    !data.categories.some((c) => c.id === 'world' && c.template === 'world') ||
    !data.categories.some((c) => c.id === 'factory' && c.template === 'factory')
  )
    throw new Error('Missing built-in enclosure categories.');
  if (new Set(data.categories.map((c) => c.name.toLowerCase())).size !== data.categories.length)
    throw new Error('Duplicate category name.');
  const worlds = data.worlds.map((w) => {
    register(w.id);
    if (!data.categories.some((c) => c.id === w.category && c.template === 'world'))
      throw new Error('Invalid World category.');
    return {
      ...w,
      factories: w.factories.map((f) => {
        register(f.id);
        if (!data.categories.some((c) => c.id === f.category && c.template === 'factory'))
          throw new Error('Invalid Factory category.');
        return { ...f, game: deserialize(JSON.stringify(f.game)) };
      }),
    };
  });
  const book: Collection = { ...data, worlds };
  if (!activeWorld(book) || !activeFactory(book))
    throw new Error('The selected Thing is outside this scope.');
  return book;
}
