import { HEIGHT_STEP, TILE_H, TILE_W } from './constants';
import type { Direction, Point } from './types';

/**
 * Convierte coordenadas de baldosa + altura a coordenadas de pantalla.
 *
 * Devuelve la ESQUINA NORTE de la baldosa (el vértice más alto del rombo).
 * Acepta valores fraccionarios, así que las cuatro esquinas de la baldosa
 * (x,y) son tileToScreen de (x,y), (x+1,y), (x+1,y+1) y (x,y+1).
 */
export function tileToScreen(x: number, y: number, h = 0): Point {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - h * HEIGHT_STEP,
  };
}

/** Centro del rombo de una baldosa: donde se plantan avatares y muebles. */
export function tileCenter(x: number, y: number, h = 0): Point {
  return tileToScreen(x + 0.5, y + 0.5, h);
}

/**
 * Inversa aproximada de `tileToScreen` asumiendo altura 0.
 * Para seleccionar baldosas con altura se usa el picking por polígono del
 * renderizador, que es exacto; esta función sirve para centrar la cámara.
 */
export function screenToTile(sx: number, sy: number): Point {
  const hx = sx / (TILE_W / 2);
  const hy = sy / (TILE_H / 2);
  return {
    x: Math.floor((hy + hx) / 2),
    y: Math.floor((hy - hx) / 2),
  };
}

/** Vector unitario de cada dirección, en coordenadas de baldosa. */
export const DIR_VECTORS: readonly Point[] = [
  { x: 0, y: -1 }, // 0 N
  { x: 1, y: -1 }, // 1 NE
  { x: 1, y: 0 }, // 2 E
  { x: 1, y: 1 }, // 3 SE
  { x: 0, y: 1 }, // 4 S
  { x: -1, y: 1 }, // 5 SW
  { x: -1, y: 0 }, // 6 W
  { x: -1, y: -1 }, // 7 NW
];

/** Dirección que hay que mirar para ir de `from` a `to`. */
export function directionBetween(from: Point, to: Point): Direction {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  for (let d = 0; d < 8; d++) {
    const v = DIR_VECTORS[d]!;
    if (v.x === dx && v.y === dy) return d as Direction;
  }
  return 4;
}

/** ¿La dirección es diagonal? */
export function isDiagonal(dir: Direction): boolean {
  return dir % 2 === 1;
}

/** Suma 1..7 a una dirección dando la vuelta al círculo. */
export function rotateDir(dir: Direction, delta: number): Direction {
  return (((dir + delta) % 8) + 8) % 8 as Direction;
}
