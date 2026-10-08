import { describe, expect, it } from 'vitest';
import { createGame } from './engine';
import { createCollection, readCollection, writeCollection, type Collection } from './collection';
import {
  linkCapacity,
  linkSchema,
  sanitizeLinks,
  transitDelay,
  transportUnlocked,
  type TransportLink,
} from './transport-model';

function twoFactories(): Collection {
  const book = createCollection(createGame());
  const second = createGame();
  // A lone Inlet re-typed to ingot so it can receive factory-2's ingot Outlet.
  second.definition.nodes = second.definition.nodes
    .filter((n) => n.id === 'import-1')
    .map((n) => ({ ...n, resource: 'ingot' as const }));
  second.definition.connections = [];
  second.state.nodes = { 'import-1': second.state.nodes['import-1'] };
  second.layout.positions = { 'import-1': second.layout.positions['import-1'] };
  book.worlds[0].factories.push({ id: 'factory-3', name: 'B', category: 'factory', game: second });
  book.nextId = 10;
  return book;
}
const link = (over: Partial<TransportLink> = {}): TransportLink => ({
  id: 'link-4',
  from: { factory: 'factory-2', node: 'export-1' },
  to: { factory: 'factory-3', node: 'import-1' },
  resource: 'ingot',
  level: 1,
  delay: 2,
  enabled: true,
  transit: [{ amount: 2, remaining: 1 }],
  ...over,
});

describe('transport link schema', () => {
  it('accepts a well-formed link and rejects malformed ones', () => {
    expect(linkSchema.safeParse(link()).success).toBe(true);
    expect(linkSchema.safeParse({ ...link(), extra: 1 }).success).toBe(false);
    expect(linkSchema.safeParse(link({ delay: 0 })).success).toBe(false);
    expect(linkSchema.safeParse(link({ level: 4 })).success).toBe(false);
    expect(linkSchema.safeParse(link({ id: 'route-4' })).success).toBe(false);
    expect(linkSchema.safeParse({ ...link(), resource: 'credits' }).success).toBe(false);
  });
  it('derives delay from map distance with a 1-tick minimum, and capacity from level', () => {
    expect(transitDelay(0, 0)).toBe(1);
    expect(transitDelay(0, 1)).toBe(2);
    expect(transitDelay(3, 0)).toBe(6);
    expect([1, 2, 3].map(linkCapacity)).toEqual([2, 4, 6]);
  });
  it('unlocks once a World has two factories', () => {
    expect(transportUnlocked(createCollection().worlds[0])).toBe(false);
    expect(transportUnlocked(twoFactories().worlds[0])).toBe(true);
  });
});

describe('link sanitizing', () => {
  const { factories } = twoFactories().worlds[0];
  const keep = (l: unknown[]) => sanitizeLinks(l, factories, 10).map((x) => x.id);
  it('keeps valid links', () => expect(keep([link()])).toEqual(['link-4']));
  it.each([
    ['missing factory', link({ to: { factory: 'factory-9', node: 'import-1' } })],
    ['missing node', link({ from: { factory: 'factory-2', node: 'export-7' } })],
    ['wrong port kind', link({ from: { factory: 'factory-2', node: 'import-1' } })],
    ['resource mismatch', link({ resource: 'gear' })],
    ['same factory', link({ to: { factory: 'factory-2', node: 'import-1' } })],
    ['id beyond nextId', link({ id: 'link-10' })],
    [
      'too many packets',
      link({
        delay: 1,
        transit: [
          { amount: 1, remaining: 1 },
          { amount: 1, remaining: 1 },
        ],
      }),
    ],
    ['packet over capacity', link({ transit: [{ amount: 3, remaining: 1 }] })],
    ['structurally invalid', { id: 'link-5' }],
  ])('drops a link with %s', (_, bad) => expect(keep([bad])).toEqual([]));
  it('drops duplicate ids and reused endpoints, keeping the first', () => {
    expect(keep([link(), link()])).toEqual(['link-4']);
    expect(keep([link(), link({ id: 'link-5' })])).toEqual(['link-4']);
  });
  it('treats a non-array as no links', () => expect(keep('nope' as never)).toEqual([]));
});

describe('collection v3 migration', () => {
  it('creates v3 collections with empty links', () => {
    const book = createCollection();
    expect(book.version).toBe(3);
    expect(book.worlds[0].links).toEqual([]);
  });
  it('migrates a v2 collection to v3 with links: []', () => {
    const v2 = JSON.parse(writeCollection(createCollection()));
    v2.version = 2;
    for (const w of v2.worlds) delete w.links;
    const book = readCollection(JSON.stringify(v2));
    expect(book.version).toBe(3);
    expect(book.worlds[0].links).toEqual([]);
  });
  it('ignores stray links in a v2 save', () => {
    const v2 = JSON.parse(writeCollection(twoFactories()));
    v2.version = 2;
    v2.worlds[0].links = [link()];
    expect(readCollection(JSON.stringify(v2)).worlds[0].links).toEqual([]);
  });
  it('migrates a legacy v1 single-factory save', () => {
    const book = readCollection(JSON.stringify(createGame()));
    expect(book.version).toBe(3);
    expect(book.worlds[0].links).toEqual([]);
  });
  it('round-trips valid links and drops invalid ones without failing the save', () => {
    const book = twoFactories();
    book.worlds[0].links = [link()];
    expect(readCollection(writeCollection(book))).toEqual(book);
    const corrupt = JSON.parse(writeCollection(book));
    corrupt.worlds[0].links.push(link({ id: 'link-6', resource: 'gear' }), 'garbage', null);
    const loaded = readCollection(JSON.stringify(corrupt));
    expect(loaded.worlds[0].links.map((l) => l.id)).toEqual(['link-4']);
    expect(loaded.worlds[0].factories).toHaveLength(2);
  });
  it('still rejects a corrupt collection and unknown versions', () => {
    const bad = JSON.parse(writeCollection(createCollection()));
    bad.version = 4;
    expect(() => readCollection(JSON.stringify(bad))).toThrow();
    expect(() => readCollection('{')).toThrow();
  });
});
