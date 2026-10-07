import { capacity, CATALOG, total } from './catalog';
import { tick } from './engine';
import type { Diagnosis } from './types';
import type { Collection, WorldThing } from './collection';
import {
  LINK_LEVELS,
  linkCapacity,
  MAX_LINKS_PER_WORLD,
  transitDelay,
  transportUnlocked,
  type LinkEnd,
  type TransportLink,
} from './transport-model';

/** Cross-factory transport mechanic (docs/TRANSPORT.md §1–§4). */
const linkNumber = (l: TransportLink) => Number(l.id.split('-')[1]);
const byLinkId = (a: TransportLink, b: TransportLink) => linkNumber(a) - linkNumber(b);
const portNode = (world: WorldThing, end: LinkEnd) =>
  world.factories
    .find((f) => f.id === end.factory)
    ?.game.definition.nodes.find((n) => n.id === end.node);
const sameEnd = (a: LinkEnd, b: LinkEnd) => a.factory === b.factory && a.node === b.node;

/** Why `from → to` can't be linked in `world` alongside `links`, or null if it can. */
export function linkError(
  world: WorldThing,
  links: TransportLink[],
  from: LinkEnd,
  to: LinkEnd,
): string | null {
  if (!transportUnlocked(world)) return 'Transport unlocks once this World has two factories.';
  if (from.factory === to.factory) return 'A link must join two different factories.';
  const out = portNode(world, from),
    inlet = portNode(world, to);
  if (!out || CATALOG[out.kind].scopePort !== 'outlet') return 'A link must start at an Outlet.';
  if (!inlet || CATALOG[inlet.kind].scopePort !== 'inlet') return 'A link must end at an Inlet.';
  if (out.resource !== inlet.resource) return 'The Outlet and Inlet carry different resources.';
  if (links.some((l) => sameEnd(l.from, from))) return 'That Outlet already feeds a link.';
  if (links.some((l) => sameEnd(l.to, to))) return 'That Inlet is already fed by a link.';
  if (links.length >= MAX_LINKS_PER_WORLD) return 'This World supports 32 links.';
  return null;
}

/** Pending link edits for one World, with undo/redo. Nothing is charged until apply. */
export type LinkDraft = {
  world: string;
  links: TransportLink[];
  nextId: number;
  undo: TransportLink[][];
  redo: TransportLink[][];
};
export function draftLinks(book: Collection, worldId = book.activeWorld): LinkDraft {
  const world = book.worlds.find((w) => w.id === worldId)!;
  return {
    world: worldId,
    links: structuredClone(world.links),
    nextId: book.nextId,
    undo: [],
    redo: [],
  };
}
function edit(draft: LinkDraft, links: TransportLink[], nextId = draft.nextId): LinkDraft {
  return { ...draft, links, nextId, undo: [...draft.undo.slice(-29), draft.links], redo: [] };
}
export function addLinkToDraft(
  book: Collection,
  draft: LinkDraft,
  from: LinkEnd,
  to: LinkEnd,
): LinkDraft {
  const world = book.worlds.find((w) => w.id === draft.world)!;
  const error = linkError(world, draft.links, from, to);
  if (error) throw new Error(error);
  const slot = (id: string) => world.factories.findIndex((f) => f.id === id);
  const link: TransportLink = {
    id: `link-${draft.nextId}`,
    from,
    to,
    resource: portNode(world, from)!.resource,
    level: 1,
    delay: transitDelay(slot(from.factory), slot(to.factory)),
    enabled: true,
    transit: [],
  };
  return edit(draft, [...draft.links, link], draft.nextId + 1);
}
export function removeLinkFromDraft(draft: LinkDraft, id: string): LinkDraft {
  return edit(
    draft,
    draft.links.filter((l) => l.id !== id),
  );
}
export function undoLinkEdit(draft: LinkDraft): LinkDraft {
  const previous = draft.undo.at(-1);
  if (!previous) return draft;
  return {
    ...draft,
    links: previous,
    undo: draft.undo.slice(0, -1),
    redo: [...draft.redo, draft.links],
  };
}
export function redoLinkEdit(draft: LinkDraft): LinkDraft {
  const next = draft.redo.at(-1);
  if (!next) return draft;
  return {
    ...draft,
    links: next,
    redo: draft.redo.slice(0, -1),
    undo: [...draft.undo, draft.links],
  };
}
/** Total build cost of the draft's new links, per source factory. */
export function draftCost(book: Collection, draft: LinkDraft) {
  const live = new Set(book.worlds.find((w) => w.id === draft.world)!.links.map((l) => l.id));
  const cost: Record<string, number> = {};
  for (const l of draft.links)
    if (!live.has(l.id)) cost[l.from.factory] = (cost[l.from.factory] ?? 0) + LINK_LEVELS[0].cost;
  return cost;
}

/**
 * Commit a draft onto the *current* collection (which may have ticked since drafting):
 * new links are charged to their source factory and get fresh ids; kept links keep
 * their live transit; removed links return in-transit goods to the source Outlet up
 * to its capacity (the rest is lost — the UI must warn).
 */
export function applyLinkDraft(book: Collection, draft: LinkDraft): Collection {
  const next = structuredClone(book);
  const world = next.worlds.find((w) => w.id === draft.world)!;
  const live = new Map(world.links.map((l) => [l.id, l]));
  const kept: TransportLink[] = [];
  for (const l of draft.links) {
    const current = live.get(l.id);
    if (current) {
      kept.push(current);
      continue;
    }
    const error = linkError(world, kept, l.from, l.to);
    if (error) throw new Error(error);
    const source = world.factories.find((f) => f.id === l.from.factory)!.game.state;
    if (source.credits < LINK_LEVELS[0].cost)
      throw new Error(`A link costs ${LINK_LEVELS[0].cost} CR from the source factory.`);
    source.credits -= LINK_LEVELS[0].cost;
    source.spent += LINK_LEVELS[0].cost;
    kept.push({ ...structuredClone(l), id: `link-${next.nextId++}`, transit: [] });
  }
  const keptIds = new Set(kept.map((l) => l.id));
  for (const removed of world.links.filter((l) => !keptIds.has(l.id))) {
    const node = portNode(world, removed.from);
    if (!node) continue;
    const game = world.factories.find((f) => f.id === removed.from.factory)!.game;
    const inv = game.state.nodes[node.id].inventory;
    const back = removed.transit.reduce((sum, p) => sum + p.amount, 0);
    inv[removed.resource] += Math.max(0, Math.min(back, capacity(node) - total(inv)));
  }
  world.links = kept.sort(byLinkId);
  return next;
}

/** True while the link can neither send nor deliver (factory out of service, port gone or paused). */
function outage(world: WorldThing, link: TransportLink) {
  return [link.from, link.to].some((end) => {
    const factory = world.factories.find((f) => f.id === end.factory);
    const node = portNode(world, end);
    return !factory || !node?.enabled || factory.game.state.factory.downtime > 0;
  });
}
export const linkStalled = (link: TransportLink) => link.transit[0]?.remaining === 0;

/**
 * One World tick (§3): factories tick, then arrivals, then departures, links in id order.
 * Goods are conserved: they move Outlet → transit → Inlet and are never created or lost.
 */
export function tickWorld(world: WorldThing): WorldThing {
  const ports = new Map<string, Set<string>>();
  for (const l of world.links)
    for (const end of [l.from, l.to])
      ports.set(end.factory, (ports.get(end.factory) ?? new Set()).add(end.node));
  const next: WorldThing = {
    ...world,
    factories: world.factories.map((f) => ({ ...f, game: tick(f.game, ports.get(f.id)) })),
    links: structuredClone(world.links).sort(byLinkId),
  };
  const state = (end: LinkEnd) =>
    next.factories.find((f) => f.id === end.factory)!.game.state.nodes[end.node].inventory;
  for (const link of next.links) {
    if (outage(next, link)) continue;
    for (const p of link.transit) p.remaining = Math.max(0, p.remaining - 1);
    const inlet = portNode(next, link.to)!,
      inv = state(link.to);
    while (link.transit[0]?.remaining === 0) {
      const head = link.transit[0];
      const moved = Math.min(head.amount, capacity(inlet) - total(inv));
      if (moved <= 0) break;
      inv[link.resource] += moved;
      head.amount -= moved;
      if (head.amount === 0) link.transit.shift();
    }
  }
  for (const link of next.links) {
    if (!link.enabled || outage(next, link) || linkStalled(link)) continue;
    if (link.transit.length >= link.delay) continue;
    const inv = state(link.from);
    const amount = Math.min(linkCapacity(link.level), inv[link.resource]);
    if (amount <= 0) continue;
    inv[link.resource] -= amount;
    link.transit.push({ amount, remaining: link.delay });
  }
  return next;
}

/** Goods currently on a link. */
export const inTransit = (link: TransportLink) => link.transit.reduce((s, p) => s + p.amount, 0);
/** Goods a removal would lose: in-transit goods beyond the source Outlet's free capacity. */
export function removalLoss(world: WorldThing, link: TransportLink) {
  const node = portNode(world, link.from);
  if (!node) return inTransit(link);
  const inv = world.factories.find((f) => f.id === link.from.factory)!.game.state.nodes[node.id]
    .inventory;
  return Math.max(0, inTransit(link) - Math.max(0, capacity(node) - total(inv)));
}
/** Links touching a factory, split into what it imports and exports. */
export function factoryLinks(links: TransportLink[], factory: string) {
  return {
    imports: links.filter((l) => l.to.factory === factory),
    exports: links.filter((l) => l.from.factory === factory),
  };
}
const factoryName = (world: WorldThing, id: string) =>
  world.factories.find((f) => f.id === id)?.name ?? id;
/** Bottleneck diagnosis for one link, naming the link and both factories. */
export function diagnoseLink(world: WorldThing, link: TransportLink): Diagnosis {
  const name = `${link.id} (${factoryName(world, link.from.factory)} → ${factoryName(world, link.to.factory)})`;
  if (outage(world, link))
    return {
      label: 'Link outage',
      detail: `${name} is holding ${inTransit(link)} goods until both factories are in service.`,
      tone: 'warn',
    };
  if (linkStalled(link))
    return {
      label: 'Link stalled',
      detail: `${name} is backed up: the Inlet in ${factoryName(world, link.to.factory)} is full.`,
      tone: 'warn',
    };
  if (!link.enabled)
    return { label: 'Link paused', detail: `${name} is disabled.`, tone: 'neutral' };
  if (!inTransit(link))
    return {
      label: 'Link idle',
      detail: `${name} is waiting for goods at the Outlet in ${factoryName(world, link.from.factory)}.`,
      tone: 'neutral',
    };
  return {
    label: 'Link moving',
    detail: `${name} carries ${inTransit(link)} goods, up to ${linkCapacity(link.level)}/tick.`,
    tone: 'good',
  };
}
