import { CATALOG } from './catalog';
import type { Game, Kind, Node } from './types';

export type Plane = 'world' | 'interior';
export type Thing = {
  id: string;
  category: string;
  name: string;
  scope?: {
    plane: Plane;
    things: Thing[];
    inlets: Node[];
    outlets: Node[];
  };
};

/** A scope projection over the saved graph, keeping ownership in one place. */
export function worldThing(game: Game): Thing {
  const nodes = game.definition.nodes;
  const describe = (node: Node): Thing => ({
    id: node.id,
    category: node.kind,
    name: CATALOG[node.kind].name,
  });
  const factory: Thing = {
    id: 'factory',
    category: 'factory',
    name: 'My first factory',
    scope: {
      plane: 'interior',
      things: nodes
        .filter((n) => CATALOG[n.kind].plane === 'interior' && !CATALOG[n.kind].scopePort)
        .map(describe),
      inlets: nodes.filter((n) => CATALOG[n.kind].scopePort === 'inlet'),
      outlets: nodes.filter((n) => CATALOG[n.kind].scopePort === 'outlet'),
    },
  };
  return {
    id: 'world',
    category: 'world',
    name: 'World',
    scope: {
      plane: 'world',
      things: [factory, ...nodes.filter((n) => CATALOG[n.kind].plane === 'world').map(describe)],
      inlets: [],
      outlets: [],
    },
  };
}

/** Both editors share a palette; ports are edited as enclosure properties. */
export function availableThings(plane: Plane) {
  return (Object.entries(CATALOG) as [Kind, (typeof CATALOG)[Kind]][]).filter(
    ([, thing]) => thing.plane === plane && !thing.scopePort,
  );
}
