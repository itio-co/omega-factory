import type { Inventory, Kind, Node, Resource } from './types';

export const RESOURCES: Record<
  Resource,
  { name: string; short: string; color: string; price: number }
> = {
  ore: { name: 'Iron ore', short: 'ORE', color: '#b88755', price: 2 },
  ingot: { name: 'Iron ingot', short: 'FE', color: '#71979a', price: 16 },
  gear: { name: 'Precision gear', short: 'GEAR', color: '#9281b0', price: 48 },
  plate: { name: 'Iron plate', short: 'PLATE', color: '#7895ab', price: 42 },
  wire: { name: 'Iron wire', short: 'WIRE', color: '#b78c68', price: 22 },
  frame: { name: 'Structural frame', short: 'FRAME', color: '#71947a', price: 110 },
};
export const CATALOG: Record<
  Kind,
  {
    name: string;
    description: string;
    cost: number;
    capacity: number;
    resource: Resource;
    color: string;
    category: string;
    plane: 'world' | 'interior';
    scopePort?: 'inlet' | 'outlet';
  }
> = {
  supplier: {
    plane: 'world',
    name: 'Ore supplier',
    description: 'Sources iron ore for 2 credits per unit.',
    cost: 180,
    capacity: 8,
    resource: 'ore',
    color: '#ae8051',
    category: 'External',
  },
  import: {
    plane: 'interior',
    scopePort: 'inlet',
    name: 'Import gate',
    description: 'Brings resources into your factory.',
    cost: 80,
    capacity: 8,
    resource: 'ore',
    color: '#7e9570',
    category: 'Logistics',
  },
  storage: {
    plane: 'interior',
    name: 'Storage',
    description: 'Buffers resources to keep your line flowing.',
    cost: 120,
    capacity: 24,
    resource: 'ore',
    color: '#a79871',
    category: 'Logistics',
  },
  smelter: {
    plane: 'interior',
    name: 'Smelter',
    description: 'Refines 2 iron ore into 1 iron ingot.',
    cost: 300,
    capacity: 8,
    resource: 'ore',
    color: '#cc8557',
    category: 'Production',
  },
  assembler: {
    plane: 'interior',
    name: 'Assembler',
    description: 'Shapes 2 iron ingots into 1 precision gear.',
    cost: 450,
    capacity: 8,
    resource: 'ingot',
    color: '#9281b0',
    category: 'Production',
  },
  export: {
    plane: 'interior',
    scopePort: 'outlet',
    name: 'Export gate',
    description: 'Sends finished goods to your customers.',
    cost: 80,
    capacity: 8,
    resource: 'ingot',
    color: '#71979a',
    category: 'Logistics',
  },
  customer: {
    plane: 'world',
    name: 'Customer',
    description: 'Buys goods and fulfills your contracts.',
    cost: 0,
    capacity: 8,
    resource: 'ingot',
    color: '#6e8b9c',
    category: 'External',
  },
  press: {
    plane: 'interior',
    name: 'Plate press',
    description: 'Presses 2 iron ingots into 1 iron plate.',
    cost: 380,
    capacity: 8,
    resource: 'ingot',
    color: '#7895ab',
    category: 'Production',
  },
  wiremill: {
    plane: 'interior',
    name: 'Wire mill',
    description: 'Draws 1 iron ingot into 1 coil of iron wire.',
    cost: 360,
    capacity: 8,
    resource: 'ingot',
    color: '#b78c68',
    category: 'Production',
  },
  fabricator: {
    plane: 'interior',
    name: 'Frame fabricator',
    description: 'Joins 2 iron plates into 1 structural frame.',
    cost: 600,
    capacity: 8,
    resource: 'plate',
    color: '#71947a',
    category: 'Production',
  },
  warehouse: {
    plane: 'interior',
    name: 'Warehouse',
    description: 'Stores up to 96 units of a selected resource per level.',
    cost: 320,
    capacity: 96,
    resource: 'ore',
    color: '#9c956d',
    category: 'Logistics',
  },
};
export const CONTRACTS: {
  title: string;
  client: string;
  description: string;
  resource: Resource;
  amount: number;
  reward: number;
  unlock: string;
}[] = [
  {
    title: 'A solid foundation',
    client: 'Itioverse · Founding order',
    description:
      'Every great system starts with a single working connection. Deliver your first batch of iron.',
    resource: 'ingot',
    amount: 12,
    reward: 350,
    unlock: 'Unlocks assembler, plate press, and wire mill',
  },
  {
    title: 'The next turning point',
    client: 'Itioverse · Workshop order',
    description:
      'Give your materials a new purpose. Build an assembly line and route precision gears to a customer.',
    resource: 'gear',
    amount: 10,
    reward: 750,
    unlock: 'Opens the final commission',
  },
  {
    title: 'A system in harmony',
    client: 'Itioverse · Expansion order',
    description:
      'Scale what works. Balance supply, storage, and production to deliver a larger batch of gears.',
    resource: 'gear',
    amount: 24,
    reward: 1500,
    unlock: 'Completes the founding commissions',
  },
];
export const RECIPES: Partial<
  Record<Kind, { input: Resource; amount: number; output: Resource; steps: number }>
> = {
  smelter: {
    input: 'ore',
    amount: 2,
    output: 'ingot',
    steps: 3,
  },
  assembler: {
    input: 'ingot',
    amount: 2,
    output: 'gear',
    steps: 5,
  },
  press: {
    input: 'ingot',
    amount: 2,
    output: 'plate',
    steps: 4,
  },
  wiremill: {
    input: 'ingot',
    amount: 1,
    output: 'wire',
    steps: 3,
  },
  fabricator: {
    input: 'plate',
    amount: 2,
    output: 'frame',
    steps: 5,
  },
};
export const emptyInventory = (): Inventory => ({
  ore: 0,
  ingot: 0,
  gear: 0,
  plate: 0,
  wire: 0,
  frame: 0,
});
export const total = (inv: Inventory) =>
  Object.values(inv).reduce((sum, amount) => sum + amount, 0);
export const capacity = (node: Node) => CATALOG[node.kind].capacity * node.level;
export const inputResource = (node: Node): Resource | null =>
  node.kind === 'supplier' ? null : (RECIPES[node.kind]?.input ?? node.resource);
export const outputResource = (node: Node): Resource | null =>
  node.kind === 'customer' ? null : (RECIPES[node.kind]?.output ?? node.resource);
export const duration = (node: Node) =>
  Math.max(1, (RECIPES[node.kind]?.steps ?? 3) - node.level + 1);
