import { expect, it } from 'vitest';
import {
  addNode,
  claimContract,
  configureNode,
  connect,
  createGame,
  removeNode,
  tick,
  upgradeNode,
} from './engine';
import { claimQuest, questStatus, trackQuest, trackedQuest, QUESTS } from './quests';
import { discoverRule } from './logic';
import { deserialize, serialize } from './persistence';

it('tracks side quests, rejects premature/repeated claims, and retains completion after salvage', () => {
  let game = createGame();
  expect(questStatus(game, 'frames')).toBe('locked');
  expect(() => claimQuest(game, 'buffer')).toThrow();
  expect(() => trackQuest(game, 'frames')).toThrow();
  game = trackQuest(addNode(game, 'warehouse'), 'buffer');
  expect(trackedQuest(game)?.id).toBe('buffer');
  expect(questStatus(game, 'buffer')).toBe('ready');
  const credits = game.state.credits;
  game = claimQuest(game, 'buffer');
  expect(game.state.credits).toBe(credits + 120);
  expect(() => claimQuest(game, 'buffer')).toThrow();
  game = removeNode(game, 'warehouse-2');
  expect(questStatus(game, 'buffer')).toBe('completed');
  expect(deserialize(serialize(game))).toEqual(game);
});

it('completes all main and side quests through actual production without starving branches', () => {
  let game = connect(createGame(), 'smelter-1', 'export-1');
  for (let i = 0; i < 140; i++) game = tick(game);
  game = claimContract(game);
  expect(questStatus(game, 'foundation')).toBe('completed');
  expect(() => claimQuest(game, 'foundation')).toThrow();
  game = upgradeNode(game, 'smelter-1');
  game = addNode(game, 'warehouse');
  game = discoverRule(game, 'and', 'AND(A,B)');
  for (const id of ['buffer', 'tuning', 'insight']) game = claimQuest(game, id);
  const addLine = (
    kind: 'assembler' | 'press' | 'wiremill' | 'fabricator',
    resource: 'gear' | 'plate' | 'wire' | 'frame',
    source: string,
  ) => {
    game = addNode(game, kind);
    const machine = game.definition.nodes.at(-1)!.id;
    game = addNode(game, 'customer');
    const buyer = game.definition.nodes.at(-1)!.id;
    game = configureNode(game, buyer, { resource });
    game = connect(game, source, machine);
    game = addNode(game, 'export');
    const outlet = game.definition.nodes.at(-1)!.id;
    game = configureNode(game, outlet, { resource });
    game = connect(game, machine, outlet);
    game = connect(game, outlet, buyer);
    return machine;
  };
  addLine('assembler', 'gear', 'smelter-1');
  const press = addLine('press', 'plate', 'smelter-1');
  addLine('wiremill', 'wire', 'smelter-1');
  let fabricated = false;
  for (let i = 0; i < 3500; i++) {
    game = tick(game);
    for (const quest of QUESTS)
      if (questStatus(game, quest.id) === 'ready') game = claimQuest(game, quest.id);
    if (!fabricated && questStatus(game, 'plates') === 'completed') {
      addLine('fabricator', 'frame', press);
      fabricated = true;
    }
    if (QUESTS.every((quest) => questStatus(game, quest.id) === 'completed')) break;
  }
  expect(QUESTS.map((quest) => questStatus(game, quest.id))).toEqual(Array(10).fill('completed'));
  expect(game.state.delivered.frame).toBeGreaterThanOrEqual(20);
  expect(game.state.delivered.wire).toBeGreaterThanOrEqual(40);
  expect(deserialize(serialize(game))).toEqual(game);
});

it('rejects duplicate, unknown, and dependency-skipping quest claims in saves', () => {
  for (const claimed of [['buffer', 'buffer'], ['unknown'], ['frames'], ['expansion']]) {
    const game = createGame();
    game.state.quests.claimed = claimed;
    expect(() => deserialize(serialize(game))).toThrow();
  }
});
