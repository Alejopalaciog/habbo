/**
 * Dirección en la que mira un avatar o un mueble.
 * Se numeran en el sentido de las agujas del reloj sobre la rejilla de baldosas:
 *   0 = norte (0,-1)   1 = noreste (1,-1)   2 = este (1,0)    3 = sureste (1,1)
 *   4 = sur (0,1)      5 = suroeste (-1,1)  6 = oeste (-1,0)  7 = noroeste (-1,-1)
 */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Point {
  x: number;
  y: number;
}

/** Una baldosa del camino, con la altura del suelo en ese punto. */
export interface PathNode extends Point {
  h: number;
}

/** Colores del avatar. El aspecto es totalmente procedural, no hay sprites. */
export interface AvatarLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export interface AvatarState {
  id: string;
  name: string;
  look: AvatarLook;
  x: number;
  y: number;
  /** Altura del suelo (niveles del mapa) en la baldosa actual. */
  h: number;
  dir: Direction;
  /** El avatar está sentado en un mueble. */
  sitting: boolean;
  /** Milisegundos de retraso de la animación de saludo, o null. */
  gesture: GestureKind | null;
}

export type GestureKind = 'wave' | 'dance';

export type FurniKind =
  | 'silla'
  | 'sofa'
  | 'mesa'
  | 'planta'
  | 'alfombra'
  | 'lampara'
  | 'caja'
  | 'tocadiscos'
  | 'valla';

export interface FurniState {
  id: string;
  kind: FurniKind;
  x: number;
  y: number;
  dir: Direction;
}

export interface FurniDef {
  kind: FurniKind;
  label: string;
  /** Se puede caminar por encima (alfombras). */
  walkable: boolean;
  /** Se puede sentar encima (sillas y sofás). */
  sittable: boolean;
  /** Altura del mueble en píxeles: sirve para sentarse y para apilar objetos. */
  height: number;
  /** Color base con el que se dibuja. */
  color: string;
}

export const FURNI: Record<FurniKind, FurniDef> = {
  silla: { kind: 'silla', label: 'Silla', walkable: false, sittable: true, height: 18, color: '#c8553d' },
  sofa: { kind: 'sofa', label: 'Sofá', walkable: false, sittable: true, height: 20, color: '#3d6bc8' },
  mesa: { kind: 'mesa', label: 'Mesa', walkable: false, sittable: false, height: 26, color: '#8d6a4f' },
  planta: { kind: 'planta', label: 'Planta', walkable: false, sittable: false, height: 40, color: '#2f8f4e' },
  alfombra: { kind: 'alfombra', label: 'Alfombra', walkable: true, sittable: false, height: 0, color: '#b0405f' },
  lampara: { kind: 'lampara', label: 'Lámpara', walkable: false, sittable: false, height: 52, color: '#e8c468' },
  caja: { kind: 'caja', label: 'Caja', walkable: false, sittable: false, height: 24, color: '#a78a5f' },
  tocadiscos: { kind: 'tocadiscos', label: 'Tocadiscos', walkable: false, sittable: false, height: 22, color: '#5b4b8a' },
  valla: { kind: 'valla', label: 'Valla', walkable: false, sittable: false, height: 30, color: '#d8d3c8' },
};

export interface RoomSummary {
  id: string;
  name: string;
  users: number;
  capacity: number;
}

export interface ChatLine {
  id: string;
  name: string;
  text: string;
  at: number;
}
