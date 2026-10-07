import { describe, expect, it } from 'vitest';
import {
  addNode,
  claimContract,
  connect,
  createGame,
  diagnose,
  disconnect,
  removeNode,
  tick,
  upgradeNode,
  configureNode,
} from './engine';
import { deserialize, serialize } from './persistence';
import { CONTRACTS } from './catalog';

function running(steps = 180) {
  let game = connect(createGame(), 'smelter-1', 'export-1');
  for (let i = 0; i < steps; i++) game = tick(game);
  return game;
}

describe('First Light factory', () => {
  it('turns imported ore into paid ingot deliveries and completes the first contract', () => {
    const game = running();
    expect(game.state.delivered.ingot).toBeGreaterThanOrEqual(12);
    expect(game.state.contractProgress).toBe(12);
    expect(game.state.earned).toBeGreaterThan(0);
    expect(game.state.credits).toBeGreaterThan(0);
  });
  it('is deterministic and independent of editor positions', () => {
    const a = connect(createGame(), 'smelter-1', 'export-1');
    const b = structuredClone(a);
    b.layout.positions['smelter-1'] = { x: -100, y: 750 };
    let left = a,
      right = b;
    for (let i = 0; i < 60; i++) {
      left = tick(left);
      right = tick(right);
    }
    expect(left.state).toEqual(right.state);
    expect(a.state.tick).toBe(0);
  });
  it('rejects incompatible, duplicate, missing, and self connections', () => {
    const game = createGame();
    expect(() => connect(game, 'supplier-1', 'customer-1')).toThrow(/resource/i);
    expect(() => connect(game, 'supplier-1', 'import-1')).toThrow(/already/i);
    expect(() => connect(game, 'missing', 'import-1')).toThrow(/not found/i);
    expect(() => connect(game, 'storage-1', 'storage-1')).toThrow(/itself/i);
  });
  it('explains a disconnected output and preserves inventory under backpressure', () => {
    let game = createGame();
    for (let i = 0; i < 150; i++) game = tick(game);
    expect(diagnose(game, 'smelter-1').detail).toMatch(/connect|output/i);
    expect(game.state.nodes['smelter-1'].inventory.ingot).toBeGreaterThan(0);
    const before = game.state.nodes['smelter-1'].inventory.ingot;
    game = connect(game, 'smelter-1', 'export-1');
    for (let i = 0; i < 50; i++) game = tick(game);
    expect(game.state.delivered.ingot).toBeGreaterThanOrEqual(before);
  });
  it('moves each unit at most one link per tick and conserves units in cycles', () => {
    let game = createGame();
    game.definition.nodes = game.definition.nodes.filter((n) =>
      ['import-1', 'storage-1'].includes(n.id),
    );
    game.definition.connections = [];
    game = connect(game, 'import-1', 'storage-1');
    game = connect(game, 'storage-1', 'import-1');
    game.state.nodes['import-1'].inventory.ore = 5;
    game = tick(game);
    expect(game.state.nodes['import-1'].inventory.ore).toBe(4);
    expect(game.state.nodes['storage-1'].inventory.ore).toBe(1);
    for (let i = 0; i < 50; i++) game = tick(game);
    expect(
      game.state.nodes['import-1'].inventory.ore + game.state.nodes['storage-1'].inventory.ore,
    ).toBe(5);
  });
  it('disabled nodes neither produce nor transfer', () => {
    let game = createGame();
    game = configureNode(game, 'supplier-1', { enabled: false });
    for (let i = 0; i < 10; i++) game = tick(game);
    expect(game.state.credits).toBe(2400);
    expect(game.state.nodes['import-1'].inventory.ore).toBe(0);
  });
  it('claims each contract once and unlocks assembly', () => {
    const game = running();
    const claimed = claimContract(game);
    expect(claimed.state.credits).toBe(game.state.credits + 350);
    expect(claimed.state.contractIndex).toBe(1);
    expect(() => claimContract(claimed)).toThrow(/complete/i);
    expect(addNode(claimed, 'assembler').definition.nodes).toHaveLength(7);
    expect(() => addNode(createGame(), 'assembler')).toThrow(/contract/i);
  });
  it('charges for buildings and upgrades, and cleans connections on removal', () => {
    const game = createGame();
    const built = addNode(game, 'storage');
    expect(built.state.credits).toBeLessThan(game.state.credits);
    const upgraded = upgradeNode(built, 'smelter-1');
    expect(upgraded.definition.nodes.find((n) => n.id === 'smelter-1')?.level).toBe(2);
    const removed = removeNode(upgraded, 'storage-1');
    expect(
      removed.definition.connections.some((e) => e.from === 'storage-1' || e.to === 'storage-1'),
    ).toBe(false);
    expect(removed.state.nodes['storage-1']).toBeUndefined();
    expect(removed.layout.positions['storage-1']).toBeUndefined();
  });
  it('rejects purchases when credits are insufficient', () => {
    const game = createGame();
    game.state.credits = 0;
    expect(() => addNode(game, 'smelter')).toThrow(/credits/i);
    expect(() => upgradeNode(game, 'smelter-1')).toThrow(/credits/i);
  });
  it('resource reconfiguration requires an empty node and disconnects old routes', () => {
    let game = createGame();
    game.state.nodes['export-1'].inventory.ingot = 1;
    expect(() => configureNode(game, 'export-1', { resource: 'gear' })).toThrow(/empty/i);
    game.state.nodes['export-1'].inventory.ingot = 0;
    game = configureNode(game, 'export-1', { resource: 'gear' });
    expect(
      game.definition.connections.some((e) => e.from === 'export-1' || e.to === 'export-1'),
    ).toBe(false);
  });
  it('disconnects only the selected route', () => {
    const game = createGame();
    const next = disconnect(game, game.definition.connections[0].id);
    expect(next.definition.connections).toHaveLength(game.definition.connections.length - 1);
  });
  it('completes every contract through production and retains valid saves', () => {
    let game = claimContract(running());
    game = addNode(game, 'assembler');
    game = addNode(game, 'export');
    game = addNode(game, 'customer');
    game = configureNode(game, 'export-3', { resource: 'gear' });
    game = configureNode(game, 'customer-4', { resource: 'gear' });
    game = connect(game, 'smelter-1', 'assembler-2');
    game = connect(game, 'assembler-2', 'export-3');
    game = connect(game, 'export-3', 'customer-4');
    for (let i = 0; i < 1000; i++) {
      game = tick(game);
      const contract = CONTRACTS[game.state.contractIndex];
      if (contract && game.state.contractProgress === contract.amount) game = claimContract(game);
      expect(deserialize(serialize(game))).toEqual(game);
    }
    expect(game.state.contractIndex).toBe(CONTRACTS.length);
    expect(game.state.delivered.gear).toBeGreaterThanOrEqual(34);
    expect(game.state.credits).toBeGreaterThan(0);
  });
});

describe('versioned saves', () => {
  it('round-trips a running factory including layout and jobs', () => {
    const game = running(25);
    expect(deserialize(serialize(game))).toEqual(game);
  });
  it.each([
    (g: any) => {
      g.version = 99;
    },
    (g: any) => {
      g.state.credits = -1;
    },
    (g: any) => {
      g.state.nodes['smelter-1'].inventory.ore = -2;
    },
    (g: any) => {
      g.definition.nodes[0].kind = 'unknown';
    },
    (g: any) => {
      g.definition.connections[0].to = 'missing';
    },
    (g: any) => {
      g.definition.nodes.push(g.definition.nodes[0]);
    },
    (g: any) => {
      delete g.layout.positions['supplier-1'];
    },
    (g: any) => {
      g.layout.zoom = 0;
    },
    (g: any) => {
      g.state.contractProgress = 999;
    },
    (g: any) => {
      g.state.nodes['supplier-1'].inventory.ore = 10000;
    },
  ])('rejects corrupted saves before replacement', (mutate) => {
    const game = createGame();
    mutate(game);
    expect(() => deserialize(JSON.stringify(game))).toThrow();
  });
  it('rejects invalid JSON and oversized files', () => {
    expect(() => deserialize('not json')).toThrow();
    expect(() => deserialize(' '.repeat(2_000_001))).toThrow(/large/i);
  });
});
