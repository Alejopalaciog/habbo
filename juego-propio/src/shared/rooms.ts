import type { Direction, FurniKind, Point } from './types';

/**
 * Definición de una sala.
 *
 * El mapa se describe con texto, una fila por cadena:
 *   'x'      baldosa inexistente (fuera de la sala)
 *   '0'-'9'  suelo pisable, el dígito es la altura
 *   'D'      puerta: suelo pisable a altura 0 por donde entran los jugadores
 */
export interface RoomModel {
  id: string;
  name: string;
  description: string;
  map: readonly string[];
  /** Color del suelo y de las paredes, para dar personalidad a cada sala. */
  floorColor: string;
  wallColor: string;
  furni: readonly { kind: FurniKind; x: number; y: number; dir: Direction }[];
}

export const VOID = 'x';
export const DOOR = 'D';

export const ROOMS: readonly RoomModel[] = [
  {
    id: 'lobby',
    name: 'Lobby del Hotel',
    description: 'La entrada principal, con su escenario elevado.',
    floorColor: '#c9a978',
    wallColor: '#8fa8c4',
    map: [
      'xxxxxxxxxxxx',
      'x0000000000x',
      'x0000000000x',
      'x0011111000x',
      'x0011111000x',
      'x0011111000x',
      'x0000000000x',
      'x0000000000x',
      'x0000000000x',
      'D0000000000x',
      'xxxxxxxxxxxx',
    ],
    furni: [
      { kind: 'alfombra', x: 5, y: 7, dir: 0 },
      { kind: 'sofa', x: 4, y: 8, dir: 0 },
      { kind: 'sofa', x: 5, y: 8, dir: 0 },
      { kind: 'sofa', x: 6, y: 8, dir: 0 },
      { kind: 'planta', x: 1, y: 1, dir: 0 },
      { kind: 'planta', x: 10, y: 1, dir: 0 },
      { kind: 'planta', x: 10, y: 8, dir: 0 },
      { kind: 'tocadiscos', x: 4, y: 3, dir: 4 },
      { kind: 'lampara', x: 6, y: 3, dir: 0 },
      { kind: 'silla', x: 3, y: 4, dir: 2 },
      { kind: 'silla', x: 5, y: 5, dir: 4 },
    ],
  },
  {
    id: 'cafe',
    name: 'Cafetería',
    description: 'Mesas, sillas y mucho ruido de tazas.',
    floorColor: '#b98a6a',
    wallColor: '#d7c3a5',
    map: [
      'xxxxxxxxxx',
      'x00000000x',
      'x00000000x',
      'x00000000x',
      'x00000000x',
      'x00000000x',
      'x00000000x',
      'D00000000x',
      'xxxxxxxxxx',
    ],
    furni: [
      { kind: 'mesa', x: 2, y: 2, dir: 0 },
      { kind: 'silla', x: 1, y: 2, dir: 2 },
      { kind: 'silla', x: 3, y: 2, dir: 6 },
      { kind: 'mesa', x: 6, y: 2, dir: 0 },
      { kind: 'silla', x: 5, y: 2, dir: 2 },
      { kind: 'silla', x: 7, y: 2, dir: 6 },
      { kind: 'mesa', x: 2, y: 5, dir: 0 },
      { kind: 'silla', x: 2, y: 4, dir: 4 },
      { kind: 'silla', x: 2, y: 6, dir: 0 },
      { kind: 'mesa', x: 6, y: 5, dir: 0 },
      { kind: 'silla', x: 6, y: 4, dir: 4 },
      { kind: 'silla', x: 6, y: 6, dir: 0 },
      { kind: 'planta', x: 8, y: 1, dir: 0 },
      { kind: 'alfombra', x: 4, y: 4, dir: 0 },
    ],
  },
  {
    id: 'terraza',
    name: 'Terraza',
    description: 'Tres niveles y una valla para no caerse.',
    floorColor: '#7fae8c',
    wallColor: '#9fc9d8',
    map: [
      'xxxxxxxxxxxxxx',
      'x000000000000x',
      'x000000000000x',
      'x000011111000x',
      'x000011111000x',
      'x000112222100x',
      'x000112222100x',
      'x000011111000x',
      'x000000000000x',
      'x000000000000x',
      'D000000000000x',
      'xxxxxxxxxxxxxx',
    ],
    furni: [
      { kind: 'silla', x: 7, y: 5, dir: 4 },
      { kind: 'silla', x: 8, y: 5, dir: 4 },
      { kind: 'mesa', x: 7, y: 6, dir: 0 },
      { kind: 'planta', x: 4, y: 3, dir: 0 },
      { kind: 'planta', x: 9, y: 3, dir: 0 },
      { kind: 'planta', x: 4, y: 7, dir: 0 },
      { kind: 'planta', x: 9, y: 7, dir: 0 },
      { kind: 'valla', x: 1, y: 1, dir: 0 },
      { kind: 'valla', x: 2, y: 1, dir: 0 },
      { kind: 'valla', x: 3, y: 1, dir: 0 },
      { kind: 'caja', x: 12, y: 9, dir: 0 },
      { kind: 'caja', x: 11, y: 9, dir: 0 },
      { kind: 'alfombra', x: 6, y: 9, dir: 0 },
      { kind: 'lampara', x: 1, y: 9, dir: 0 },
    ],
  },
];

export function getRoomModel(id: string): RoomModel | undefined {
  return ROOMS.find((room) => room.id === id);
}

/** Altura del suelo en una baldosa, o null si no es pisable. */
export function mapHeightAt(map: readonly string[], x: number, y: number): number | null {
  const row = map[y];
  if (row === undefined) return null;
  const char = row[x];
  if (char === undefined || char === VOID) return null;
  if (char === DOOR) return 0;
  const h = Number(char);
  return Number.isNaN(h) ? null : h;
}

/** Baldosa de la puerta: por ahí aparecen los jugadores al entrar. */
export function findDoor(map: readonly string[]): Point {
  for (let y = 0; y < map.length; y++) {
    const row = map[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === DOOR) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

export function mapSize(map: readonly string[]): { width: number; height: number } {
  return {
    width: map.reduce((max, row) => Math.max(max, row.length), 0),
    height: map.length,
  };
}
