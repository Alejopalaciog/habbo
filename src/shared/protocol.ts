import type {
  AvatarLook,
  AvatarState,
  ChatLine,
  Direction,
  FurniKind,
  FurniState,
  GestureKind,
  PathNode,
  RoomSummary,
} from './types';

/* ------------------------------------------------------------------ */
/* Mensajes que envía el CLIENTE                                       */
/* ------------------------------------------------------------------ */

export type ClientMessage =
  /** Primer mensaje de la conexión: identifica al jugador. */
  | { t: 'hello'; name: string; look: AvatarLook }
  /** Entrar a una sala (o cambiarse de sala). */
  | { t: 'join'; roomId: string }
  /** Pedir caminar hasta una baldosa. */
  | { t: 'walk'; x: number; y: number }
  /** Girar sobre uno mismo sin moverse. */
  | { t: 'turn'; dir: Direction }
  | { t: 'chat'; text: string }
  | { t: 'gesture'; kind: GestureKind }
  | { t: 'furni_place'; kind: FurniKind; x: number; y: number; dir: Direction }
  | { t: 'furni_rotate'; id: string }
  | { t: 'furni_remove'; id: string }
  /** Latido para mantener viva la conexión. */
  | { t: 'ping' };

/* ------------------------------------------------------------------ */
/* Mensajes que envía el SERVIDOR                                      */
/* ------------------------------------------------------------------ */

export interface RoomPayload {
  id: string;
  name: string;
  description: string;
  map: string[];
  floorColor: string;
  wallColor: string;
}

export type ServerMessage =
  /** Confirmación de `hello`: identidad asignada y lista de salas. */
  | { t: 'welcome'; youId: string; name: string; rooms: RoomSummary[] }
  /** Estado completo de la sala en la que acabas de entrar. */
  | {
      t: 'room';
      room: RoomPayload;
      avatars: AvatarState[];
      furni: FurniState[];
      history: ChatLine[];
    }
  | { t: 'rooms'; rooms: RoomSummary[] }
  | { t: 'avatar_enter'; avatar: AvatarState }
  | { t: 'avatar_leave'; id: string }
  /**
   * Un avatar empieza a recorrer un camino.
   * `startedAt` es el reloj del servidor: el cliente interpola desde ahí,
   * gastando STEP_MS por baldosa, así todos ven lo mismo.
   */
  | { t: 'avatar_walk'; id: string; from: PathNode; path: PathNode[]; startedAt: number }
  /** Cambio de estado puntual (posición fijada, giro, sentarse...). */
  | {
      t: 'avatar_update';
      id: string;
      x?: number;
      y?: number;
      h?: number;
      dir?: Direction;
      sitting?: boolean;
    }
  | { t: 'chat'; line: ChatLine }
  | { t: 'gesture'; id: string; kind: GestureKind }
  | { t: 'furni_add'; furni: FurniState }
  | { t: 'furni_update'; furni: FurniState }
  | { t: 'furni_remove'; id: string }
  /** El servidor rechazó algo; se muestra como aviso en el cliente. */
  | { t: 'notice'; text: string }
  | { t: 'pong'; now: number };

export function encode(message: ServerMessage | ClientMessage): string {
  return JSON.stringify(message);
}

/** Decodifica sin confiar en el contenido: devuelve null si no es válido. */
export function decode<T>(raw: string): T | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    if (typeof (value as { t?: unknown }).t !== 'string') return null;
    return value as T;
  } catch {
    return null;
  }
}
