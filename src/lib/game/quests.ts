import { CATALOG, CONTRACTS, RESOURCES } from './catalog';
import type { Discovery, Game, Kind, Resource } from './types';

type Objective =
  | { type: 'contract'; index: number; target: number }
  | { type: 'deliver'; resource: Resource; target: number }
  | { type: 'own'; kind: Kind; target: number; level?: number }
  | { type: 'discover'; discovery: Discovery; target: number };
export type Quest = {
  id: string;
  title: string;
  description: string;
  chapter: string;
  category: 'main' | 'side';
  prerequisites: string[];
  objectives: Objective[];
  reward: number;
  unlock: string;
  legacyIndex?: number;
};
export const LEGACY_QUEST_IDS = ['foundation', 'gears', 'harmony'];
export const QUESTS: Quest[] = [
  ...CONTRACTS.map((contract, index): Quest => ({
    id: LEGACY_QUEST_IDS[index],
    title: contract.title,
    description: contract.description,
    chapter: 'First Light',
    category: 'main',
    prerequisites: index ? [LEGACY_QUEST_IDS[index - 1]] : [],
    objectives: [{ type: 'contract', index, target: contract.amount }],
    reward: contract.reward,
    unlock: contract.unlock,
    legacyIndex: index,
  })),
  {
    id: 'plates',
    title: 'Shape the future',
    chapter: 'New possibilities',
    category: 'main',
    description:
      'Branch from iron ingots into plates. Build a press and route its plates to a customer configured for Iron plate.',
    prerequisites: ['foundation'],
    objectives: [
      { type: 'own', kind: 'press', target: 1 },
      { type: 'deliver', resource: 'plate', target: 12 },
    ],
    reward: 400,
    unlock: 'Unlocks the frame fabricator',
  },
  {
    id: 'wires',
    title: 'Draw a new line',
    chapter: 'New possibilities',
    category: 'main',
    description:
      'A wire mill turns each ingot into wire. Give this branch its own customer and keep the ingots flowing.',
    prerequisites: ['foundation'],
    objectives: [
      { type: 'own', kind: 'wiremill', target: 1 },
      { type: 'deliver', resource: 'wire', target: 16 },
    ],
    reward: 450,
    unlock: 'Contributes to the expansion commission',
  },
  {
    id: 'frames',
    title: 'A stronger structure',
    chapter: 'New possibilities',
    category: 'main',
    description:
      'Take plates one step further. Feed a frame fabricator and deliver structural frames to a matching customer.',
    prerequisites: ['plates'],
    objectives: [
      { type: 'own', kind: 'fabricator', target: 1 },
      { type: 'deliver', resource: 'frame', target: 8 },
    ],
    reward: 800,
    unlock: 'Contributes to the expansion commission',
  },
  {
    id: 'expansion',
    title: 'A factory of possibilities',
    chapter: 'Expansion',
    category: 'main',
    description:
      'Bring the branches together. Keep a warehouse and demonstrate sustained frame and wire production.',
    prerequisites: ['harmony', 'wires', 'frames'],
    objectives: [
      { type: 'own', kind: 'warehouse', target: 1 },
      { type: 'deliver', resource: 'frame', target: 20 },
      { type: 'deliver', resource: 'wire', target: 40 },
    ],
    reward: 1400,
    unlock: 'Completes the expansion journey',
  },
  {
    id: 'buffer',
    title: 'Room to grow',
    chapter: 'Factory practice',
    category: 'side',
    description: 'Add a high-capacity warehouse so you can buffer a growing production line.',
    prerequisites: [],
    objectives: [{ type: 'own', kind: 'warehouse', target: 1 }],
    reward: 120,
    unlock: 'Optional logistics milestone',
  },
  {
    id: 'tuning',
    title: 'Tune the furnace',
    chapter: 'Factory practice',
    category: 'side',
    description: 'Upgrade a smelter to level 2 or higher to shorten its production cycle.',
    prerequisites: [],
    objectives: [{ type: 'own', kind: 'smelter', target: 1, level: 2 }],
    reward: 100,
    unlock: 'Optional production milestone',
  },
  {
    id: 'insight',
    title: 'Understand the gate',
    chapter: 'Factory practice',
    category: 'side',
    description:
      'Record an AND discovery in the Logic Lab. This quest bonus is separate from the discovery reward.',
    prerequisites: [],
    objectives: [{ type: 'discover', discovery: 'and', target: 1 }],
    reward: 100,
    unlock: 'Optional learning milestone',
  },
];

export function getQuest(id: string): Quest {
  const quest = QUESTS.find((entry) => entry.id === id);
  if (!quest) throw new Error('Unknown quest.');
  return quest;
}
export function questClaimed(game: Game, id: string): boolean {
  const quest = getQuest(id);
  return quest.legacyIndex !== undefined
    ? game.state.contractIndex > quest.legacyIndex
    : game.state.quests.claimed.includes(id);
}
export function questObjectives(game: Game, id: string) {
  const quest = getQuest(id);
  return quest.objectives.map((objective) => {
    let value = 0,
      label = '';
    switch (objective.type) {
      case 'contract':
        value =
          game.state.contractIndex > objective.index
            ? objective.target
            : game.state.contractIndex === objective.index
              ? game.state.contractProgress
              : 0;
        label = `Deliver ${RESOURCES[CONTRACTS[objective.index].resource].name}`;
        break;
      case 'deliver':
        value = game.state.delivered[objective.resource];
        label = `Lifetime deliveries: ${RESOURCES[objective.resource].name}`;
        break;
      case 'own':
        value = game.definition.nodes.filter(
          (node) => node.kind === objective.kind && node.level >= (objective.level ?? 1),
        ).length;
        label = `Own ${CATALOG[objective.kind].name}${objective.level ? ` · level ${objective.level}+` : ''}`;
        break;
      case 'discover':
        value = Number(game.state.journal.some((entry) => entry.id === objective.discovery));
        label = `Record ${objective.discovery.toUpperCase()} discovery`;
        break;
    }
    const current = questClaimed(game, id) ? objective.target : Math.min(value, objective.target);
    return { label, current, target: objective.target, complete: current >= objective.target };
  });
}
export function questStatus(game: Game, id: string): 'locked' | 'active' | 'ready' | 'completed' {
  if (questClaimed(game, id)) return 'completed';
  if (!getQuest(id).prerequisites.every((prerequisite) => questClaimed(game, prerequisite)))
    return 'locked';
  return questObjectives(game, id).every((goal) => goal.complete) ? 'ready' : 'active';
}
export function trackedQuest(game: Game): Quest | undefined {
  const tracked = QUESTS.find((quest) => quest.id === game.state.quests.tracked);
  if (tracked && ['active', 'ready'].includes(questStatus(game, tracked.id))) return tracked;
  return (
    QUESTS.find((quest) => quest.category === 'main' && questStatus(game, quest.id) === 'ready') ??
    QUESTS.find((quest) => quest.category === 'main' && questStatus(game, quest.id) === 'active') ??
    QUESTS.find((quest) => ['active', 'ready'].includes(questStatus(game, quest.id)))
  );
}
export function trackQuest(game: Game, id: string): Game {
  if (!['active', 'ready'].includes(questStatus(game, id)))
    throw new Error('Only available quests can be tracked.');
  const next = structuredClone(game);
  next.state.quests.tracked = id;
  return next;
}
export function claimQuest(game: Game, id: string): Game {
  const quest = getQuest(id);
  if (questStatus(game, id) !== 'ready')
    throw new Error(
      'Complete the quest objectives and prerequisites before claiming its reward. Rewards can only be claimed once.',
    );
  const next = structuredClone(game);
  if (quest.legacyIndex !== undefined) {
    next.state.contractIndex++;
    next.state.contractProgress = 0;
  } else next.state.quests.claimed.push(id);
  next.state.credits += quest.reward;
  next.state.earned += quest.reward;
  next.state.quests.tracked = null;
  next.state.quests.tracked = trackedQuest(next)?.id ?? null;
  return next;
}
export function buildingUnlockReason(game: Game, kind: Kind): string | null {
  if (
    kind === 'assembler' &&
    game.state.contractIndex < 1 &&
    !game.state.journal.some((entry) => entry.id === 'and')
  )
    return 'Complete the first contract or rediscover AND to unlock assembly.';
  if (['press', 'wiremill'].includes(kind) && game.state.contractIndex < 1)
    return 'Complete A solid foundation to unlock this building.';
  if (kind === 'fabricator' && !questClaimed(game, 'plates'))
    return 'Complete Shape the future to unlock the frame fabricator.';
  return null;
}
