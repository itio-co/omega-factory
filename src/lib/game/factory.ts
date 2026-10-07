import { CATALOG, emptyInventory, total } from './catalog';
import type { Game, Kind, Node, Point } from './types';

export const FACTORY_WALL = { x: 350, y: 86, width: 840 };
export const SLOT_WIDTH = 68,
  SLOT_HEIGHT = 76;
export const isFactorySlot = (kind: Kind) => kind === 'import' || kind === 'export';
export function factoryBounds(game: Game) {
  const count = Math.max(
    ...['import', 'export'].map(
      (kind) => game.definition.nodes.filter((node) => node.kind === kind).length,
    ),
    6,
  );
  return { ...FACTORY_WALL, height: 80 + count * 90 };
}
export function slotPoint(kind: Kind, index: number): Point {
  return {
    x: FACTORY_WALL.x + (kind === 'export' ? FACTORY_WALL.width : 0) - SLOT_WIDTH / 2,
    y: FACTORY_WALL.y + 40 + index * 90,
  };
}
export function placeFactorySlot(
  game: Game,
  kind: Kind,
  desiredY: number,
  ignoreId?: string,
): Point {
  const peers = game.definition.nodes.filter((node) => node.kind === kind && node.id !== ignoreId);
  const occupied = new Set(
    peers.map((node) => Math.round((game.layout.positions[node.id].y - FACTORY_WALL.y - 40) / 90)),
  );
  const candidates = Array.from(
    { length: Math.max(6, peers.length + 1) },
    (_, index) => index,
  ).filter((index) => !occupied.has(index));
  candidates.sort(
    (a, b) => Math.abs(slotPoint(kind, a).y - desiredY) - Math.abs(slotPoint(kind, b).y - desiredY),
  );
  return slotPoint(kind, candidates[0]);
}
export const COMPONENT_WIDTH = 216,
  COMPONENT_HEIGHT = 206;
export function placeComponent(game: Game, kind: Kind, desired: Point, ignoreId?: string): Point {
  if (CATALOG[kind].scopePort) return placeFactorySlot(game, kind, desired.y, ignoreId);
  const wall = factoryBounds(game),
    margin = 50;
  if (CATALOG[kind].plane === 'world')
    return {
      x:
        kind === 'supplier'
          ? Math.max(0, Math.min(desired.x, wall.x - COMPONENT_WIDTH - margin))
          : Math.min(1360, Math.max(desired.x, wall.x + wall.width + margin)),
      y: Math.max(kind === 'supplier' ? 80 : 300, Math.min(89000, desired.y)),
    };
  return {
    x: Math.max(
      wall.x + margin,
      Math.min(desired.x, wall.x + wall.width - COMPONENT_WIDTH - margin),
    ),
    y: Math.max(wall.y + 40, Math.min(desired.y, wall.y + wall.height - COMPONENT_HEIGHT - 20)),
  };
}
export function normalizeFactorySlots(game: Game) {
  for (const node of game.definition.nodes) {
    if (!isFactorySlot(node.kind))
      game.layout.positions[node.id] = placeComponent(
        game,
        node.kind,
        game.layout.positions[node.id],
      );
  }
  // Place each slot against its wall, preserving vertical preference in old saves.
  for (const kind of ['import', 'export'] as const) {
    const used = new Set<number>();
    const slots = game.definition.nodes.filter((node) => node.kind === kind);
    for (const node of slots) {
      const desired = game.layout.positions[node.id];
      const indices = Array.from({ length: Math.max(6, slots.length) }, (_, i) => i).filter(
        (i) => !used.has(i),
      );
      indices.sort(
        (a, b) =>
          Math.abs(slotPoint(kind, a).y - desired.y) - Math.abs(slotPoint(kind, b).y - desired.y),
      );
      used.add(indices[0]);
      game.layout.positions[node.id] = slotPoint(kind, indices[0]);
    }
  }
}
export const factoryCooldownTicks = (level: number) => [120, 80, 40][level - 1];
export const factoryUpgradeCost = (level: number) => level * 1000;
export function upgradeFactory(game: Game): Game {
  if (game.state.factory.level >= 3) throw new Error('Factory is already at maximum level.');
  if (game.state.factory.downtime > 0)
    throw new Error('Wait until the factory returns to service.');
  const cost = factoryUpgradeCost(game.state.factory.level);
  if (game.state.credits < cost) throw new Error('Not enough credits to upgrade the factory.');
  const next = structuredClone(game);
  next.state.credits -= cost;
  next.state.spent += cost;
  next.state.factory.level++;
  next.state.factory.downtime = factoryCooldownTicks(next.state.factory.level);
  next.state.transfers = [];
  next.state.routeHistory = {};
  return next;
}

/** Merge structural edits into the latest live runtime; never rewind production or rewards. */
export function applyFactoryDraft(
  live: Game,
  draft: Game,
  creditDelta: number,
  spentDelta: number,
): Game {
  if (live.state.factory.downtime > 0)
    throw new Error('Wait until the factory returns to service before applying another update.');
  if (live.state.credits + creditDelta < 0)
    throw new Error('Not enough live credits to apply this draft.');
  const next = structuredClone(live);
  next.definition = structuredClone(draft.definition);
  next.layout = structuredClone(draft.layout);
  next.state.nodes = {};
  for (const node of next.definition.nodes) {
    const previous = live.definition.nodes.find((old) => old.id === node.id);
    if (
      previous &&
      previous.resource !== node.resource &&
      total(live.state.nodes[node.id].inventory) > 0
    )
      throw new Error(
        'A node received resources while you were editing. Empty it before changing its resource.',
      );
    next.state.nodes[node.id] = previous
      ? structuredClone(live.state.nodes[node.id])
      : { inventory: emptyInventory(), jobRemaining: 0, completed: 0, outputCursor: 0 };
  }
  next.state.credits += creditDelta;
  next.state.spent += spentDelta;
  next.state.transfers = [];
  next.state.routeHistory = {};
  next.state.factory.downtime = factoryCooldownTicks(next.state.factory.level);
  normalizeFactorySlots(next);
  return next;
}

/** World partners cross the factory boundary only through its public ports. */
export function connectionScopeError(source: Node, target: Node): string | null {
  if (source.kind === 'supplier' && target.kind !== 'import')
    return 'External supply must connect to a factory import slot.';
  if (target.kind === 'customer' && source.kind !== 'export')
    return 'External customers must connect from a factory export slot.';
  return null;
}

/** Upgrade earlier saves that allowed external routes to bypass the boundary. */
export function migrateExternalRoutes(game: Game) {
  const original = [...game.definition.connections];
  for (const edge of original) {
    const source = game.definition.nodes.find((n) => n.id === edge.from)!;
    const target = game.definition.nodes.find((n) => n.id === edge.to)!;
    if (!connectionScopeError(source, target)) continue;
    const chain = [source.id];
    for (const kind of ['import', 'export'] as const) {
      if (
        kind === 'import'
          ? source.kind !== 'supplier' || target.kind === 'import'
          : target.kind !== 'customer' || source.kind === 'export'
      )
        continue;
      const resource = kind === 'import' ? source.resource : target.resource;
      const reusable = game.definition.nodes.find((n) => {
        if (n.kind !== kind || n.resource !== resource || !n.enabled) return false;
        const externalEdges = game.definition.connections.filter((e) =>
          kind === 'import' ? e.to === n.id : e.from === n.id,
        );
        return (
          externalEdges.length > 0 &&
          externalEdges.every((e) =>
            kind === 'import' ? e.from === source.id : e.to === target.id,
          )
        );
      });
      if (reusable) {
        chain.push(reusable.id);
        continue;
      }
      if (game.definition.nodes.length >= 200)
        throw new Error(
          'This save needs more boundary slots than the 200-component limit permits.',
        );
      const id = `${kind}-${game.definition.nextId++}`;
      game.layout.positions[id] = placeFactorySlot(game, kind, game.layout.positions[source.id].y);
      game.definition.nodes.push({ id, kind, resource, enabled: true, level: 1 });
      game.state.nodes[id] = {
        inventory: emptyInventory(),
        jobRemaining: 0,
        completed: 0,
        outputCursor: 0,
      };
      chain.push(id);
    }
    chain.push(target.id);
    game.definition.connections = game.definition.connections.filter((e) => e.id !== edge.id);
    for (let i = 1; i < chain.length; i++) {
      const from = chain[i - 1],
        to = chain[i];
      if (!game.definition.connections.some((e) => e.from === from && e.to === to))
        game.definition.connections.push({ id: `${from}:${to}`, from, to });
    }
    delete game.state.routeHistory[edge.id];
    game.state.transfers = game.state.transfers.filter((id) => id !== edge.id);
  }
  if (game.definition.connections.length > 1000)
    throw new Error('Migrating boundary routes exceeds the route limit.');
}
