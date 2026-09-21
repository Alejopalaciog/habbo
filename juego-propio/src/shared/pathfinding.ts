import { directionBetween, DIR_VECTORS } from './iso';
import type { PathNode, Point } from './types';

/** Lo que el buscador de caminos necesita saber del mundo. */
export interface NavGrid {
  width: number;
  height: number;
  /** Altura del suelo, o null si la baldosa no existe / no es pisable. */
  heightAt(x: number, y: number): number | null;
  /** La baldosa está ocupada (otro avatar, un mueble sólido...). */
  isBlocked(x: number, y: number): boolean;
}

/** Diferencia de altura máxima que se puede subir o bajar de una baldosa a otra. */
const MAX_CLIMB = 1;

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

function key(x: number, y: number): number {
  return y * 4096 + x;
}

/** Distancia octil: coste real de moverse en 8 direcciones. */
function heuristic(a: Point, b: Point): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * ¿Se puede pasar de `from` a un vecino adyacente?
 * Reglas (copiadas del comportamiento clásico de este tipo de juegos):
 *  - la baldosa destino existe y no está ocupada
 *  - la diferencia de altura no supera MAX_CLIMB
 *  - en diagonal no se recortan esquinas ni se sube/baja de nivel
 */
function canStep(grid: NavGrid, from: Point, to: Point, target: Point): boolean {
  const hFrom = grid.heightAt(from.x, from.y);
  const hTo = grid.heightAt(to.x, to.y);
  if (hFrom === null || hTo === null) return false;
  if (Math.abs(hTo - hFrom) > MAX_CLIMB) return false;

  // El destino final puede estar "ocupado" si es una silla: eso lo decide
  // quien llama pasando un grid que no marca su propia silla como bloqueada.
  const isTarget = to.x === target.x && to.y === target.y;
  if (!isTarget && grid.isBlocked(to.x, to.y)) return false;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) {
    if (hTo !== hFrom) return false; // sin diagonales en escaleras
    const sideA = grid.heightAt(from.x + dx, from.y);
    const sideB = grid.heightAt(from.x, from.y + dy);
    if (sideA === null || sideB === null) return false;
    if (grid.isBlocked(from.x + dx, from.y) || grid.isBlocked(from.x, from.y + dy)) return false;
  }
  return true;
}

/**
 * A* sobre la rejilla de baldosas.
 * Devuelve el camino SIN incluir la baldosa de origen, o [] si no hay ruta.
 */
export function findPath(grid: NavGrid, from: Point, to: Point): PathNode[] {
  if (from.x === to.x && from.y === to.y) return [];
  if (grid.heightAt(to.x, to.y) === null) return [];

  const start: Node = { x: from.x, y: from.y, g: 0, f: heuristic(from, to), parent: null };
  const open = new Map<number, Node>([[key(from.x, from.y), start]]);
  const closed = new Set<number>();

  // Tope de seguridad: las salas son pequeñas, si se pasa de aquí algo va mal.
  let iterations = 0;
  const maxIterations = grid.width * grid.height * 4;

  while (open.size > 0 && iterations++ < maxIterations) {
    // Rejillas de ~200 baldosas: recorrer la lista abierta es más rápido que
    // mantener un montículo binario, y el código queda mucho más legible.
    let current: Node | null = null;
    for (const node of open.values()) {
      if (current === null || node.f < current.f) current = node;
    }
    if (current === null) break;

    const currentKey = key(current.x, current.y);
    open.delete(currentKey);
    closed.add(currentKey);

    if (current.x === to.x && current.y === to.y) {
      return reconstruct(grid, current);
    }

    for (const v of DIR_VECTORS) {
      const nx = current.x + v.x;
      const ny = current.y + v.y;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const nKey = key(nx, ny);
      if (closed.has(nKey)) continue;
      if (!canStep(grid, current, { x: nx, y: ny }, to)) continue;

      const stepCost = v.x !== 0 && v.y !== 0 ? Math.SQRT2 : 1;
      const g = current.g + stepCost;
      const existing = open.get(nKey);
      if (existing && existing.g <= g) continue;
      open.set(nKey, { x: nx, y: ny, g, f: g + heuristic({ x: nx, y: ny }, to), parent: current });
    }
  }

  return [];
}

function reconstruct(grid: NavGrid, end: Node): PathNode[] {
  const path: PathNode[] = [];
  let node: Node | null = end;
  while (node && node.parent) {
    path.push({ x: node.x, y: node.y, h: grid.heightAt(node.x, node.y) ?? 0 });
    node = node.parent;
  }
  return path.reverse();
}

/** Direcciones que hay que ir mirando al recorrer un camino. */
export function pathDirections(from: Point, path: PathNode[]) {
  const dirs = [];
  let prev: Point = from;
  for (const node of path) {
    dirs.push(directionBetween(prev, node));
    prev = node;
  }
  return dirs;
}
