import { z } from 'zod';
import { CATALOG } from './catalog';
import { RESOURCE_IDS, type Game, type Resource } from './types';

/** Data model for cross-factory transport links (docs/TRANSPORT.md). */
export type LinkEnd = { factory: string; node: string };
export type TransitPacket = { amount: number; remaining: number };
export type TransportLink = {
  id: string;
  from: LinkEnd;
  to: LinkEnd;
  resource: Resource;
  level: number;
  delay: number;
  enabled: boolean;
  transit: TransitPacket[];
};

export const LINK_LEVELS = [
  { level: 1, capacity: 2, cost: 250 },
  { level: 2, capacity: 4, cost: 400 },
  { level: 3, capacity: 6, cost: 650 },
] as const;
export const MAX_LINK_LEVEL = LINK_LEVELS.length;
export const TRANSIT_TICKS_PER_SLOT = 2;
export const MAX_LINK_DELAY = 64;
export const MAX_LINKS_PER_WORLD = 32;
export const TRANSPORT_UNLOCK_FACTORIES = 2;

export function linkCapacity(level: number) {
  return LINK_LEVELS[Math.min(Math.max(level, 1), MAX_LINK_LEVEL) - 1].capacity;
}
/** Transit delay from World-map slot distance (slot = index in world.factories). */
export function transitDelay(fromSlot: number, toSlot: number) {
  return Math.min(
    MAX_LINK_DELAY,
    Math.max(1, Math.abs(fromSlot - toSlot) * TRANSIT_TICKS_PER_SLOT),
  );
}
export function transportUnlocked(world: { factories: unknown[] }) {
  return world.factories.length >= TRANSPORT_UNLOCK_FACTORIES;
}

const thingId = z
  .string()
  .regex(/^[a-z]+(?:-\d+)?$/)
  .max(60);
const nodeId = z.string().regex(/^[a-z]+-[1-9][0-9]{0,8}$/);
const end = z.object({ factory: thingId, node: nodeId }).strict();
export const linkSchema = z
  .object({
    id: z.string().regex(/^link-[1-9][0-9]{0,8}$/),
    from: end,
    to: end,
    resource: z.enum(RESOURCE_IDS),
    level: z.number().int().min(1).max(MAX_LINK_LEVEL),
    delay: z.number().int().min(1).max(MAX_LINK_DELAY),
    enabled: z.boolean(),
    transit: z
      .array(
        z
          .object({
            amount: z.number().int().min(1).max(1000),
            remaining: z.number().int().min(0).max(MAX_LINK_DELAY),
          })
          .strict(),
      )
      .max(MAX_LINK_DELAY),
  })
  .strict();

type FactoryLike = { id: string; game: Game };
/**
 * Keep only links that are structurally and semantically valid for this World.
 * Invalid links are dropped (never thrown) so one bad link can't lose a save.
 */
export function sanitizeLinks(raw: unknown, factories: FactoryLike[], nextId: number) {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(factories.map((f) => [f.id, f]));
  const ids = new Set<string>();
  const usedOutlets = new Set<string>();
  const usedInlets = new Set<string>();
  const kept: TransportLink[] = [];
  for (const candidate of raw.slice(0, MAX_LINKS_PER_WORLD)) {
    const parsed = linkSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const link = parsed.data as TransportLink;
    if (ids.has(link.id) || Number(link.id.split('-')[1]) >= nextId) continue;
    if (link.from.factory === link.to.factory) continue;
    const port = (e: LinkEnd, want: 'inlet' | 'outlet') => {
      const node = byId.get(e.factory)?.game.definition.nodes.find((n) => n.id === e.node);
      return !!node && CATALOG[node.kind].scopePort === want && node.resource === link.resource;
    };
    if (!port(link.from, 'outlet') || !port(link.to, 'inlet')) continue;
    const outKey = `${link.from.factory}/${link.from.node}`,
      inKey = `${link.to.factory}/${link.to.node}`;
    if (usedOutlets.has(outKey) || usedInlets.has(inKey)) continue;
    const cap = linkCapacity(link.level);
    if (link.transit.length > link.delay) continue;
    if (link.transit.some((p) => p.amount > cap || p.remaining > link.delay)) continue;
    ids.add(link.id);
    usedOutlets.add(outKey);
    usedInlets.add(inKey);
    kept.push(link);
  }
  return kept;
}
