import { z } from 'zod';
import {
  capacity,
  CATALOG,
  CONTRACTS,
  duration,
  inputResource,
  outputResource,
  total,
  RECIPES,
} from './catalog';
import type { Game } from './types';
import { checkRule, DISCOVERIES } from './logic';
import { DISCOVERY_IDS, BUILDING_KINDS, RESOURCE_IDS, type Discovery } from './types';
import { buildingUnlockReason, getQuest, questClaimed, QUESTS } from './quests';
import { FLOW_WINDOW_STEPS } from './flow';
import { factoryCooldownTicks, migrateExternalRoutes, normalizeFactorySlots } from './factory';

export const SAVE_KEY = 'itioverse.omega-factory.v1';
const count = z.number().int().min(0).max(1_000_000_000);
const money = z.number().int().min(0).max(1_000_000_000_000);
const resource = z.enum(RESOURCE_IDS);
const id = z.string().regex(/^[a-z]+-[1-9][0-9]{0,8}$/);
const inventory = z
  .object({
    ore: count,
    ingot: count,
    gear: count,
    plate: count.default(0),
    wire: count.default(0),
    frame: count.default(0),
  })
  .strict();
const point = z
  .object({ x: z.number().min(-100000).max(100000), y: z.number().min(-100000).max(100000) })
  .strict();
const schema = z
  .object({
    version: z.literal(1),
    definition: z
      .object({
        nodes: z
          .array(
            z
              .object({
                id,
                kind: z.enum(BUILDING_KINDS),
                resource,
                enabled: z.boolean(),
                level: z.number().int().min(1).max(3),
              })
              .strict(),
          )
          .max(200),
        connections: z
          .array(z.object({ id: z.string().max(100), from: id, to: id }).strict())
          .max(1000),
        nextId: z.number().int().min(2).max(99999999),
      })
      .strict(),
    state: z
      .object({
        tick: count,
        factory: z
          .object({
            level: z.number().int().min(1).max(3),
            downtime: z.number().int().min(0).max(120),
          })
          .strict()
          .default({ level: 1, downtime: 0 }),
        credits: money,
        earned: money,
        spent: money,
        nodes: z.record(
          id,
          z
            .object({
              inventory,
              jobRemaining: z.number().int().min(0).max(5),
              completed: count,
              outputCursor: z.number().int().min(0).max(999).default(0),
            })
            .strict(),
        ),
        delivered: inventory,
        contractIndex: z.number().int().min(0).max(CONTRACTS.length),
        contractProgress: count,
        quests: z
          .object({
            claimed: z.array(z.string().max(40)).max(QUESTS.length),
            tracked: z.string().max(40).nullable(),
          })
          .strict()
          .default({ claimed: [], tracked: 'foundation' }),
        transfers: z.array(z.string().max(100)).max(1000),
        routeHistory: z
          .record(
            z.string().max(100),
            z.array(z.number().int().min(0).max(1)).max(FLOW_WINDOW_STEPS),
          )
          .default({}),
        history: z.array(count).max(60),
        journal: z
          .array(
            z
              .object({
                id: z.enum(DISCOVERY_IDS),
                title: z.string().max(80),
                expression: z.string().max(256),
                tick: count,
              })
              .strict(),
          )
          .max(DISCOVERY_IDS.length),
      })
      .strict(),
    layout: z
      .object({ positions: z.record(id, point), pan: point, zoom: z.number().min(0.3).max(1.8) })
      .strict(),
  })
  .strict();

export function serialize(game: Game): string {
  return JSON.stringify(game);
}
export function deserialize(text: string): Game {
  if (text.length > 2_000_000) throw new Error('Save file is too large (maximum 2 MB).');
  let game: Game;
  try {
    game = schema.parse(JSON.parse(text));
  } catch {
    throw new Error('This is not a valid Omega Factory v1 save. Your factory has not changed.');
  }
  const fail = () => {
    throw new Error('Save contains inconsistent factory data. Your factory has not changed.');
  };
  const nodes = new Map(game.definition.nodes.map((n) => [n.id, n]));
  if (game.state.factory.downtime > factoryCooldownTicks(game.state.factory.level)) fail();
  if (nodes.size !== game.definition.nodes.length) fail();
  if (
    Object.keys(game.state.nodes).length !== nodes.size ||
    Object.keys(game.layout.positions).length !== nodes.size
  )
    fail();
  for (const node of nodes.values()) {
    const state = game.state.nodes[node.id];
    if (!state || !game.layout.positions[node.id]) fail();
    if (Number(node.id.split('-')[1]) >= game.definition.nextId) fail();
    if (
      (node.kind === 'supplier' || RECIPES[node.kind]) &&
      node.resource !== CATALOG[node.kind].resource
    )
      fail();
    if (buildingUnlockReason(game, node.kind)) fail();
    if (total(state.inventory) + (state.jobRemaining > 0 ? 1 : 0) > capacity(node)) fail();
    const processing = !!RECIPES[node.kind];
    // Upgrades may shorten the next recipe while an existing job is still running.
    if (
      state.jobRemaining > 0 &&
      (!processing || state.jobRemaining > duration({ ...node, level: 1 }))
    )
      fail();
    for (const [r, n] of Object.entries(state.inventory))
      if (n > 0 && r !== inputResource(node) && r !== outputResource(node)) fail();
  }
  const edges = new Set<string>();
  for (const edge of game.definition.connections) {
    const source = nodes.get(edge.from),
      target = nodes.get(edge.to);
    if (
      !source ||
      !target ||
      edge.from === edge.to ||
      edge.id !== `${edge.from}:${edge.to}` ||
      edges.has(edge.id)
    )
      fail();
    if (!outputResource(source!) || outputResource(source!) !== inputResource(target!)) fail();
    edges.add(edge.id);
  }
  if (game.state.transfers.some((id) => !edges.has(id))) fail();
  for (const [id, samples] of Object.entries(game.state.routeHistory)) {
    if (!edges.has(id) || samples.length > game.state.tick) fail();
  }
  if (game.state.contractProgress > (CONTRACTS[game.state.contractIndex]?.amount ?? 0)) fail();
  const claimed = game.state.quests.claimed;
  if (new Set(claimed).size !== claimed.length) fail();
  if (game.state.quests.tracked && !QUESTS.some((quest) => quest.id === game.state.quests.tracked))
    fail();
  const seen = new Set<string>();
  for (const id of claimed) {
    const quest = QUESTS.find((entry) => entry.id === id);
    if (!quest || quest.legacyIndex !== undefined) fail();
    if (
      !quest!.prerequisites.every((prerequisite) =>
        getQuest(prerequisite).legacyIndex !== undefined
          ? questClaimed(game, prerequisite)
          : seen.has(prerequisite),
      )
    )
      fail();
    for (const objective of quest!.objectives) {
      if (
        objective.type === 'deliver' &&
        game.state.delivered[objective.resource] < objective.target
      )
        fail();
      if (
        objective.type === 'discover' &&
        !game.state.journal.some((entry) => entry.id === objective.discovery)
      )
        fail();
    }
    seen.add(id);
  }
  if (new Set(game.state.journal.map((j) => j.id)).size !== game.state.journal.length) fail();
  const verified = new Map<Discovery, number>();
  for (const entry of game.state.journal) {
    if (
      entry.tick > game.state.tick ||
      !DISCOVERIES[entry.id].prerequisites.every(
        (id) => verified.has(id) && verified.get(id)! <= entry.tick,
      ) ||
      !checkRule(entry.expression, entry.id).success
    )
      fail();
    verified.set(entry.id, entry.tick);
  }
  migrateExternalRoutes(game);
  normalizeFactorySlots(game);
  return game;
}
