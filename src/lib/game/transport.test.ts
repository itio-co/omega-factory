import { describe, expect, it } from 'vitest';
import { createGame } from './engine';
import { tick } from './engine';
import { createCollection, readCollection, writeCollection, type Collection } from './collection';
import type { Game, Kind } from './types';
import {
  addLinkToDraft,
  applyLinkDraft,
  draftCost,
  draftLinks,
  linkError,
  linkStalled,
  redoLinkEdit,
  removeLinkFromDraft,
  tickWorld,
  undoLinkEdit,
  diagnoseLink,
  removalLoss,
  factoryLinks,
  inTransit,
} from './transport';
import type { TransportLink } from './transport-model';

/** A factory holding only one port node, so no production interferes with conservation. */
function portGame(kind: Kind, stock = 0): Game {
  const game = createGame();
  const id = `${kind}-1`;
  game.definition.nodes = game.definition.nodes
    .filter((n) => n.id === id)
    .map((n) => ({ ...n, resource: 'ingot' as const }));
  game.definition.connections = [];
  game.state.nodes = { [id]: game.state.nodes[id] };
  game.state.nodes[id].inventory.ingot = stock;
  game.layout.positions = { [id]: game.layout.positions[id] };
  return game;
}
function world(outStock = 8): Collection {
  const book = createCollection(portGame('export', outStock));
  book.worlds[0].factories.push({
    id: 'factory-3',
    name: 'B',
    category: 'factory',
    game: portGame('import'),
  });
  book.nextId = 4;
  return book;
}
const OUT = { factory: 'factory-2', node: 'export-1' },
  IN = { factory: 'factory-3', node: 'import-1' };
function linked(outStock = 8) {
  const book = world(outStock);
  return applyLinkDraft(book, addLinkToDraft(book, draftLinks(book), OUT, IN));
}
const inv = (book: Collection, f: number, id: string) =>
  book.worlds[0].factories[f].game.state.nodes[id].inventory.ingot;
const goods = (book: Collection) =>
  inv(book, 0, 'export-1') + inv(book, 1, 'import-1') + inTransit(book.worlds[0].links[0]);
const step = (book: Collection, n = 1) => {
  for (let i = 0; i < n; i++) book = { ...book, worlds: [tickWorld(book.worlds[0])] };
  return book;
};

describe('link validation', () => {
  it('requires two factories, Outlet→Inlet, same resource and free ports', () => {
    const book = world();
    const w = book.worlds[0];
    expect(linkError(createCollection().worlds[0], [], OUT, IN)).toMatch(/two factories/);
    expect(linkError(w, [], OUT, IN)).toBeNull();
    expect(linkError(w, [], IN, OUT)).toMatch(/Outlet/);
    expect(linkError(w, [], OUT, { factory: 'factory-2', node: 'export-1' })).toMatch(/different/);
    expect(linkError(w, [], OUT, { factory: 'factory-3', node: 'import-9' })).toMatch(/Inlet/);
    const l = linked().worlds[0].links;
    expect(linkError(w, l, OUT, IN)).toMatch(/already feeds/);
  });
  it('rejects resource mismatches', () => {
    const book = world();
    book.worlds[0].factories[1].game.definition.nodes[0].resource = 'ore';
    expect(linkError(book.worlds[0], [], OUT, IN)).toMatch(/different resources/);
  });
});

describe('draft, apply and undo', () => {
  it('charges nothing until apply, then charges the source factory once', () => {
    const book = world();
    const draft = addLinkToDraft(book, draftLinks(book), OUT, IN);
    expect(book.worlds[0].links).toEqual([]);
    expect(draftCost(book, draft)).toEqual({ 'factory-2': 250 });
    const applied = applyLinkDraft(book, draft);
    const src = applied.worlds[0].factories[0].game.state;
    expect(src.credits).toBe(book.worlds[0].factories[0].game.state.credits - 250);
    expect(applied.worlds[0].links).toMatchObject([{ id: 'link-4', delay: 2, level: 1 }]);
    expect(applied.nextId).toBe(5);
  });
  it('undoes and redoes link edits; discarding a draft leaves the live world untouched', () => {
    const book = world();
    let d = addLinkToDraft(book, draftLinks(book), OUT, IN);
    d = undoLinkEdit(d);
    expect(d.links).toEqual([]);
    d = redoLinkEdit(d);
    expect(d.links).toHaveLength(1);
    expect(applyLinkDraft(book, undoLinkEdit(d)).worlds[0].links).toEqual([]);
    expect(undoLinkEdit(draftLinks(book))).toEqual(draftLinks(book));
  });
  it('refuses to apply without the build budget', () => {
    const book = world();
    book.worlds[0].factories[0].game.state.credits = 10;
    expect(() => applyLinkDraft(book, addLinkToDraft(book, draftLinks(book), OUT, IN))).toThrow(
      /250/,
    );
  });
  it('removing a link returns in-transit goods to the Outlet', () => {
    let book = step(linked(), 1);
    expect(inTransit(book.worlds[0].links[0])).toBe(2);
    book = applyLinkDraft(book, removeLinkFromDraft(draftLinks(book), 'link-4'));
    expect(book.worlds[0].links).toEqual([]);
    expect(inv(book, 0, 'export-1')).toBe(8);
  });
});

describe('World tick', () => {
  it('delivers after the transit delay', () => {
    let book = step(linked(), 1);
    expect(inv(book, 1, 'import-1')).toBe(0);
    book = step(book, 2);
    expect(inv(book, 1, 'import-1')).toBe(2);
  });
  it('conserves goods every tick', () => {
    let book = linked(8);
    for (let i = 0; i < 20; i++) {
      book = step(book);
      expect(goods(book)).toBe(8);
    }
  });
  it('stalls under back-pressure and resumes when the Inlet drains', () => {
    let book = linked(24);
    book = step(book, 12);
    const link = book.worlds[0].links[0];
    expect(inv(book, 1, 'import-1')).toBe(8);
    expect(linkStalled(link)).toBe(true);
    expect(goods(book)).toBe(24);
    const out = inv(book, 0, 'export-1');
    book = step(book, 3);
    expect(inv(book, 0, 'export-1')).toBe(out);
    book.worlds[0].factories[1].game.state.nodes['import-1'].inventory.ingot = 0;
    book = step(book, 1);
    expect(inv(book, 1, 'import-1')).toBeGreaterThan(0);
  });
  it('holds goods in transit during an outage', () => {
    let book = step(linked(), 1);
    book.worlds[0].factories[1].game.state.factory.downtime = 3;
    const before = structuredClone(book.worlds[0].links[0].transit);
    book = step(book, 2);
    expect(book.worlds[0].links[0].transit).toEqual(before);
    expect(goods(book)).toBe(8);
    book = step(book, 4);
    expect(inv(book, 1, 'import-1')).toBeGreaterThan(0);
  });
  it('is deterministic and survives a save round-trip mid-transit', () => {
    const a = step(linked(), 5),
      b = step(linked(), 5);
    expect(a).toEqual(b);
    const reloaded = readCollection(writeCollection(a));
    expect(step(reloaded, 3)).toEqual(step(a, 3));
  });
  it('linked Inlets feed their factory and bypass external suppliers', () => {
    const game = createGame();
    const ports = new Set(['import-1']);
    const next = tick(game, ports);
    expect(
      next.state.transfers.some(
        (e) => game.definition.connections.find((c) => c.id === e)?.to === 'import-1',
      ),
    ).toBe(false);
    const fed = structuredClone(game);
    fed.state.nodes['import-1'].inventory.ore = 4;
    expect(tick(fed, ports).state.nodes['import-1'].inventory.ore).toBeLessThan(4);
  });
});

describe('link feedback', () => {
  it('names the link in its diagnosis and reports stalls, outages and losses', () => {
    let book = linked(24);
    expect(diagnoseLink(book.worlds[0], book.worlds[0].links[0]).label).toBe('Link idle');
    book = step(book, 1);
    expect(diagnoseLink(book.worlds[0], book.worlds[0].links[0]).detail).toMatch(/link-4 \(/);
    book = step(book, 12);
    expect(diagnoseLink(book.worlds[0], book.worlds[0].links[0]).label).toBe('Link stalled');
    const out = book.worlds[0].factories[0].game.state.nodes['export-1'].inventory;
    const carried = inTransit(book.worlds[0].links[0]);
    out.ingot = 8;
    expect(removalLoss(book.worlds[0], book.worlds[0].links[0])).toBe(carried);
    out.ingot = 8 - carried;
    expect(removalLoss(book.worlds[0], book.worlds[0].links[0])).toBe(0);
    book.worlds[0].factories[1].game.state.factory.downtime = 2;
    expect(diagnoseLink(book.worlds[0], book.worlds[0].links[0]).label).toBe('Link outage');
    expect(factoryLinks(book.worlds[0].links, 'factory-3').imports).toHaveLength(1);
  });
});
