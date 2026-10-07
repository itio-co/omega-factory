export const RESOURCE_IDS = ['ore', 'ingot', 'gear', 'plate', 'wire', 'frame'] as const;
export type Resource = (typeof RESOURCE_IDS)[number];
export const DISCOVERY_IDS = ['and', 'or', 'xor', 'implies', 'majority', 'selector'] as const;
export type Discovery = (typeof DISCOVERY_IDS)[number];
export const BUILDING_KINDS = [
  'supplier',
  'import',
  'storage',
  'smelter',
  'assembler',
  'export',
  'customer',
  'press',
  'wiremill',
  'fabricator',
  'warehouse',
] as const;
export type Kind = (typeof BUILDING_KINDS)[number];
export type Inventory = Record<Resource, number>;
export type Point = { x: number; y: number };
export type Node = { id: string; kind: Kind; resource: Resource; enabled: boolean; level: number };
export type Connection = { id: string; from: string; to: string };
export type NodeState = {
  inventory: Inventory;
  jobRemaining: number;
  completed: number;
  outputCursor: number;
};
export type Game = {
  version: 1;
  definition: { nodes: Node[]; connections: Connection[]; nextId: number };
  state: {
    tick: number;
    factory: { level: number; downtime: number };
    credits: number;
    earned: number;
    spent: number;
    nodes: Record<string, NodeState>;
    delivered: Inventory;
    contractIndex: number;
    contractProgress: number;
    quests: { claimed: string[]; tracked: string | null };
    transfers: string[];
    routeHistory: Record<string, number[]>;
    history: number[];
    journal: { id: Discovery; title: string; expression: string; tick: number }[];
  };
  layout: { positions: Record<string, Point>; pan: Point; zoom: number };
};
export type Diagnosis = { label: string; detail: string; tone: 'good' | 'warn' | 'neutral' };
