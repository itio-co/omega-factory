import type { Point, Game } from './game/types';
import { isFactorySlot, SLOT_WIDTH, SLOT_HEIGHT } from './game/factory';
export type RouteAnchor = Point & { width?: number; height?: number; portY?: number };
export function routeAnchor(game: Game, id: string): RouteAnchor {
  const node = game.definition.nodes.find((entry) => entry.id === id)!;
  return {
    ...game.layout.positions[id],
    ...(isFactorySlot(node.kind)
      ? { width: SLOT_WIDTH, height: SLOT_HEIGHT, portY: SLOT_HEIGHT / 2 }
      : {}),
  };
}
export const NODE_WIDTH = 216;
export const NODE_HEIGHT = 206;
export function routePoints(from: RouteAnchor, to: RouteAnchor) {
  const a = { x: from.x + (from.width ?? NODE_WIDTH), y: from.y + (from.portY ?? 87) };
  const b = { x: to.x, y: to.y + (to.portY ?? 87) };
  const bend = Math.max(65, Math.abs(b.x - a.x) * 0.45);
  return [a, { x: a.x + bend, y: a.y }, { x: b.x - bend, y: b.y }, b];
}
export function routePath(from: RouteAnchor, to: RouteAnchor) {
  const [a, b, c, d] = routePoints(from, to);
  return `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
}
export function alongRoute(from: RouteAnchor, to: RouteAnchor, t: number) {
  const [a, b, c, d] = routePoints(from, to),
    u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  };
}

export function routeLabelPoint(from: RouteAnchor, to: RouteAnchor) {
  const middle = alongRoute(from, to, 0.5);
  const candidates = [-22, 22, 0].map((offset) => ({ x: middle.x, y: middle.y + offset }));
  return (
    candidates.find((point) =>
      [from, to].every(
        (node) =>
          point.x + 28 < node.x ||
          point.x - 28 > node.x + (node.width ?? NODE_WIDTH) ||
          point.y + 13 < node.y ||
          point.y - 13 > node.y + (node.height ?? NODE_HEIGHT),
      ),
    ) ?? candidates[0]
  );
}
