import {
  capacity,
  CATALOG,
  CONTRACTS,
  duration,
  emptyInventory,
  inputResource,
  outputResource,
  RESOURCES,
  RECIPES,
  total,
} from './catalog';
import type { Diagnosis, Game, Kind, Node, Point, Resource } from './types';
import { FLOW_WINDOW_STEPS } from './flow';
import { buildingUnlockReason, claimQuest, LEGACY_QUEST_IDS } from './quests';
import { connectionScopeError, placeComponent, slotPoint } from './factory';

export function createGame(): Game {
  const kinds: Kind[] = ['supplier', 'import', 'storage', 'smelter', 'export', 'customer'];
  const nodes = kinds.map((kind) => ({
    id: `${kind}-1`,
    kind,
    resource: CATALOG[kind].resource,
    enabled: true,
    level: 1,
  }));
  return {
    version: 1,
    definition: {
      nodes,
      nextId: 2,
      connections: [
        [0, 1],
        [1, 2],
        [2, 3],
        [4, 5],
      ].map(([a, b]) => ({
        id: `${nodes[a].id}:${nodes[b].id}`,
        from: nodes[a].id,
        to: nodes[b].id,
      })),
    },
    state: {
      tick: 0,
      factory: { level: 1, downtime: 0 },
      credits: 2400,
      earned: 0,
      spent: 0,
      nodes: Object.fromEntries(
        nodes.map((n) => [
          n.id,
          { inventory: emptyInventory(), jobRemaining: 0, completed: 0, outputCursor: 0 },
        ]),
      ),
      delivered: emptyInventory(),
      contractIndex: 0,
      contractProgress: 0,
      quests: { claimed: [], tracked: 'foundation' },
      transfers: [],
      routeHistory: {},
      history: [],
      journal: [],
    },
    layout: {
      positions: {
        'supplier-1': { x: 50, y: 160 },
        'import-1': slotPoint('import', 1),
        'storage-1': { x: 610, y: 160 },
        'smelter-1': { x: 610, y: 410 },
        'export-1': slotPoint('export', 4),
        'customer-1': { x: 1320, y: 410 },
      },
      pan: { x: 40, y: 20 },
      zoom: 0.8,
    },
  };
}

function find(game: Game, id: string): Node {
  const node = game.definition.nodes.find((n) => n.id === id);
  if (!node) throw new Error('Node not found.');
  return node;
}

function pruneRouteHistory(game: Game) {
  const routes = new Set(game.definition.connections.map((edge) => edge.id));
  game.state.routeHistory = Object.fromEntries(
    Object.entries(game.state.routeHistory).filter(([id]) => routes.has(id)),
  );
}

export function connect(game: Game, from: string, to: string): Game {
  const source = find(game, from),
    target = find(game, to);
  if (from === to) throw new Error('A node cannot connect to itself.');
  if (game.definition.connections.some((e) => e.from === from && e.to === to))
    throw new Error('These ports are already connected.');
  if (!outputResource(source) || outputResource(source) !== inputResource(target))
    throw new Error('Resource mismatch. Connect ports carrying the same resource.');
  const scopeError = connectionScopeError(source, target);
  if (scopeError) throw new Error(scopeError);
  if (game.definition.connections.length >= 1000)
    throw new Error('This demo supports up to 1,000 connections.');
  const next = structuredClone(game);
  next.definition.connections.push({ id: `${from}:${to}`, from, to });
  return next;
}

export function disconnect(game: Game, id: string): Game {
  const next = structuredClone(game);
  next.definition.connections = next.definition.connections.filter((e) => e.id !== id);
  next.state.transfers = next.state.transfers.filter((e) => e !== id);
  pruneRouteHistory(next);
  return next;
}

export function addNode(game: Game, kind: Kind, position?: Point): Game {
  if (!(kind in CATALOG)) throw new Error('Unknown building.');
  if (game.definition.nodes.length >= 200) throw new Error('This demo supports up to 200 nodes.');
  const unlockReason = buildingUnlockReason(game, kind);
  if (unlockReason) throw new Error(unlockReason);
  if (game.state.credits < CATALOG[kind].cost)
    throw new Error('Not enough credits for this building.');
  const next = structuredClone(game),
    id = `${kind}-${next.definition.nextId++}`;
  next.definition.nodes.push({
    id,
    kind,
    resource: CATALOG[kind].resource,
    enabled: true,
    level: 1,
  });
  next.state.nodes[id] = {
    inventory: emptyInventory(),
    jobRemaining: 0,
    completed: 0,
    outputCursor: 0,
  };
  next.layout.positions[id] = placeComponent(game, kind, position ?? { x: 400, y: 650 });
  next.state.credits -= CATALOG[kind].cost;
  next.state.spent += CATALOG[kind].cost;
  return next;
}

export function removeNode(game: Game, id: string): Game {
  const node = find(game, id),
    next = structuredClone(game);
  next.definition.nodes = next.definition.nodes.filter((n) => n.id !== id);
  next.definition.connections = next.definition.connections.filter(
    (e) => e.from !== id && e.to !== id,
  );
  next.state.transfers = next.state.transfers.filter((id) =>
    next.definition.connections.some((e) => e.id === id),
  );
  delete next.state.nodes[id];
  delete next.layout.positions[id];
  pruneRouteHistory(next);
  // Salvage is deliberately below the purchase cost; inventory is discarded.
  next.state.credits += Math.floor(CATALOG[node.kind].cost / 2);
  return next;
}

export function configureNode(
  game: Game,
  id: string,
  patch: { enabled?: boolean; resource?: Resource },
): Game {
  const node = find(game, id);
  if (patch.resource && patch.resource !== node.resource) {
    if (node.kind === 'supplier' || RECIPES[node.kind])
      throw new Error('This building has a fixed recipe.');
    if (!Object.hasOwn(RESOURCES, patch.resource)) throw new Error('Unknown resource.');
    if (total(game.state.nodes[id].inventory) > 0)
      throw new Error('Empty this node before changing its resource.');
  }
  const next = structuredClone(game);
  Object.assign(find(next, id), patch);
  if (patch.resource && patch.resource !== node.resource) {
    next.definition.connections = next.definition.connections.filter(
      (e) => e.from !== id && e.to !== id,
    );
    next.state.transfers = [];
    pruneRouteHistory(next);
  }
  return next;
}

export const upgradeCost = (node: Node) => 100 * node.level;
export function upgradeNode(game: Game, id: string): Game {
  const node = find(game, id);
  if (node.level >= 3) throw new Error('This building is fully upgraded.');
  if (game.state.credits < upgradeCost(node))
    throw new Error('Not enough credits for this upgrade.');
  const next = structuredClone(game);
  next.state.credits -= upgradeCost(node);
  next.state.spent += upgradeCost(node);
  find(next, id).level++;
  return next;
}

export function claimContract(game: Game): Game {
  const contract = CONTRACTS[game.state.contractIndex];
  if (!contract || game.state.contractProgress < contract.amount)
    throw new Error('Complete the current contract first.');
  return claimQuest(game, LEGACY_QUEST_IDS[game.state.contractIndex]);
}

/**
 * `linkedPorts`: Outlet/Inlet node ids owned by a transport link (docs/TRANSPORT.md).
 * A linked Inlet is supplied only by its link; a linked Outlet only feeds its link.
 */
export function tick(game: Game, linkedPorts: ReadonlySet<string> = new Set()): Game {
  const next = structuredClone(game),
    { nodes, connections } = next.definition,
    state = next.state;
  state.tick++;
  state.transfers = [];
  if (state.factory.downtime > 0) {
    state.factory.downtime--;
    state.routeHistory = {};
    state.history = [...state.history, 0].slice(-60);
    return next;
  }
  for (const node of nodes) {
    if (!node.enabled) continue;
    const runtime = state.nodes[node.id],
      inv = runtime.inventory;
    if (node.kind === 'supplier') {
      if (
        state.tick % Math.max(1, 3 - node.level) === 0 &&
        total(inv) < capacity(node) &&
        state.credits >= 2
      ) {
        inv.ore++;
        state.credits -= 2;
        state.spent += 2;
        runtime.completed++;
      }
    } else if (RECIPES[node.kind]) {
      const recipe = RECIPES[node.kind]!;
      if (runtime.jobRemaining > 0) {
        runtime.jobRemaining--;
        if (runtime.jobRemaining === 0) {
          inv[outputResource(node)!]++;
          runtime.completed++;
        }
      } else if (
        inv[recipe.input] >= recipe.amount &&
        inv[outputResource(node)!] < capacity(node) - 1
      ) {
        inv[recipe.input] -= recipe.amount;
        runtime.jobRemaining = duration(node);
      }
    }
  }
  // Source budgets are snapshots: arrivals cannot cross a second link this tick.
  const budgets = Object.fromEntries(nodes.map((n) => [n.id, { ...state.nodes[n.id].inventory }]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const source of nodes) {
    const resource = outputResource(source);
    if (!source.enabled || !resource) continue;
    const outgoing = connections.filter((edge) => edge.from === source.id);
    const runtime = state.nodes[source.id];
    const offset = outgoing.length ? runtime.outputCursor % outgoing.length : 0;
    // Advance on successful transfers, not wall-clock ticks. Periodic production
    // must not repeatedly favor the same branch when the two periods align.
    for (let index = 0; index < outgoing.length; index++) {
      const edgeIndex = (offset + index) % outgoing.length;
      const edge = outgoing[edgeIndex],
        target = byId.get(edge.to);
      if (
        !target?.enabled ||
        (linkedPorts.has(source.id) && CATALOG[source.kind].scopePort === 'outlet') ||
        (linkedPorts.has(target.id) && CATALOG[target.kind].scopePort === 'inlet') ||
        resource !== inputResource(target) ||
        budgets[source.id][resource] < 1
      )
        continue;
      const targetState = state.nodes[target.id];
      const reserved = targetState.jobRemaining > 0 ? 1 : 0;
      if (total(targetState.inventory) + reserved >= capacity(target)) continue;
      budgets[source.id][resource]--;
      runtime.inventory[resource]--;
      targetState.inventory[resource]++;
      runtime.outputCursor = (edgeIndex + 1) % outgoing.length;
      state.transfers.push(edge.id);
    }
  }
  const transferred = new Set(state.transfers);
  state.routeHistory = Object.fromEntries(
    connections.map((edge) => [
      edge.id,
      [...(state.routeHistory[edge.id] ?? []), transferred.has(edge.id) ? 1 : 0].slice(
        -FLOW_WINDOW_STEPS,
      ),
    ]),
  );
  let deliveredThisTick = 0;
  for (const node of nodes.filter((n) => n.enabled && n.kind === 'customer')) {
    const inv = state.nodes[node.id].inventory,
      amount = inv[node.resource];
    if (!amount) continue;
    inv[node.resource] = 0;
    state.delivered[node.resource] += amount;
    state.nodes[node.id].completed += amount;
    const income = amount * RESOURCES[node.resource].price;
    state.credits += income;
    state.earned += income;
    deliveredThisTick += amount;
    const contract = CONTRACTS[state.contractIndex];
    if (contract?.resource === node.resource)
      state.contractProgress = Math.min(contract.amount, state.contractProgress + amount);
  }
  state.history = [...state.history, deliveredThisTick].slice(-60);
  return next;
}

export function diagnose(game: Game, id: string): Diagnosis {
  const node = find(game, id),
    runtime = game.state.nodes[id];
  const incoming = game.definition.connections.some((e) => e.to === id),
    outgoing = game.definition.connections.some((e) => e.from === id);
  if (!node.enabled)
    return {
      label: 'Paused',
      detail: 'This node is disabled. Enable it to resume production and transfers.',
      tone: 'neutral',
    };
  if (node.kind !== 'customer' && !outgoing)
    return {
      label: 'No output route',
      detail: 'Connect the output port to a compatible input to move resources onward.',
      tone: 'warn',
    };
  if (node.kind !== 'supplier' && !incoming)
    return {
      label: 'No input route',
      detail: 'Connect a matching upstream output to supply this node.',
      tone: 'warn',
    };
  if (node.kind === 'supplier' && game.state.credits < 2)
    return {
      label: 'Needs credits',
      detail: 'Ore costs 2 credits per unit. Sell goods or salvage a building to resume supply.',
      tone: 'warn',
    };
  if (runtime.jobRemaining > 0)
    return {
      label: 'Processing',
      detail: `Batch in progress. ${runtime.jobRemaining} simulation steps remaining.`,
      tone: 'good',
    };
  if (total(runtime.inventory) >= capacity(node) - 1)
    return {
      label: 'Output backed up',
      detail:
        'Inventory is nearly full. Check downstream capacity, disabled nodes, or add another route.',
      tone: 'warn',
    };
  if (node.kind === 'supplier')
    return {
      label: 'Supplying',
      detail: 'Automatically purchases ore while inventory space and credits are available.',
      tone: 'good',
    };
  if (node.kind === 'customer')
    return {
      label: 'Accepting orders',
      detail: `Pays ${RESOURCES[node.resource].price} credits for each ${RESOURCES[node.resource].name.toLowerCase()}.`,
      tone: 'good',
    };
  if (total(runtime.inventory) === 0)
    return {
      label: 'Waiting for input',
      detail: 'The route is connected. Waiting for resources from the upstream node.',
      tone: 'neutral',
    };
  return {
    label: 'Flowing',
    detail: 'Resources are available and routes are connected.',
    tone: 'good',
  };
}
