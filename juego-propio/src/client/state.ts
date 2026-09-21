import { CHAT_BUBBLE_MS, STEP_MS } from '../shared/constants';
import { directionBetween } from '../shared/iso';
import type { RoomPayload } from '../shared/protocol';
import { mapHeightAt, mapSize } from '../shared/rooms';
import type {
  AvatarState,
  ChatLine,
  Direction,
  FurniState,
  GestureKind,
  PathNode,
  RoomSummary,
} from '../shared/types';

export interface WalkAnimation {
  from: PathNode;
  path: PathNode[];
  /** Reloj DEL SERVIDOR en el que arrancó el recorrido. */
  startedAt: number;
}

export interface ClientAvatar extends AvatarState {
  walk: WalkAnimation | null;
  bubble: { text: string; at: number } | null;
  gestureKind: GestureKind | null;
  gestureUntil: number;
}

/** Posición ya interpolada para dibujar: x/y pueden ser fraccionarios. */
export interface RenderPose {
  x: number;
  y: number;
  h: number;
  dir: Direction;
  /** 0..1 dentro del paso actual, o null si está quieto. */
  walkPhase: number | null;
}

export class GameState {
  youId = '';
  yourName = '';
  room: RoomPayload | null = null;
  roomWidth = 0;
  roomHeight = 0;
  readonly avatars = new Map<string, ClientAvatar>();
  furni: FurniState[] = [];
  rooms: RoomSummary[] = [];
  readonly chat: ChatLine[] = [];

  setRoom(room: RoomPayload, avatars: AvatarState[], furni: FurniState[]): void {
    this.room = room;
    const size = mapSize(room.map);
    this.roomWidth = size.width;
    this.roomHeight = size.height;
    this.avatars.clear();
    for (const avatar of avatars) this.addAvatar(avatar);
    this.furni = [...furni];
  }

  addAvatar(avatar: AvatarState): ClientAvatar {
    const entry: ClientAvatar = {
      ...avatar,
      walk: null,
      bubble: null,
      gestureKind: null,
      gestureUntil: 0,
    };
    this.avatars.set(avatar.id, entry);
    return entry;
  }

  get you(): ClientAvatar | undefined {
    return this.avatars.get(this.youId);
  }

  heightAt(x: number, y: number): number | null {
    if (!this.room) return null;
    return mapHeightAt(this.room.map, x, y);
  }

  furniAt(x: number, y: number): FurniState | undefined {
    return this.furni.find((f) => f.x === x && f.y === y);
  }

  pushChat(line: ChatLine): void {
    this.chat.push(line);
    if (this.chat.length > 120) this.chat.shift();
    const avatar = this.avatars.get(line.id);
    if (avatar) avatar.bubble = { text: line.text, at: line.at };
  }
}

/**
 * Calcula dónde dibujar un avatar.
 *
 * El servidor manda el camino completo con el instante de salida; el cliente
 * reproduce esa animación gastando STEP_MS por baldosa. Al usar el reloj del
 * servidor (corregido con el desfase medido por el ping), todos los jugadores
 * ven el mismo movimiento aunque tengan latencias distintas.
 */
export function poseOf(avatar: ClientAvatar, serverNow: number): RenderPose {
  const walk = avatar.walk;
  if (!walk || walk.path.length === 0) {
    return { x: avatar.x, y: avatar.y, h: avatar.h, dir: avatar.dir, walkPhase: null };
  }

  const progress = Math.max(0, (serverNow - walk.startedAt) / STEP_MS);
  const index = Math.floor(progress);

  if (index >= walk.path.length) {
    const last = walk.path[walk.path.length - 1]!;
    return { x: last.x, y: last.y, h: last.h, dir: avatar.dir, walkPhase: null };
  }

  const from = index === 0 ? walk.from : walk.path[index - 1]!;
  const to = walk.path[index]!;
  const t = progress - index;
  // Curva suave en los extremos: arranca y frena sin tirones.
  const eased = t * t * (3 - 2 * t);

  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    h: from.h + (to.h - from.h) * eased,
    dir: directionBetween(from, to),
    // La fase avanza a lo largo de todo el camino para que el ciclo de piernas
    // no se reinicie en cada baldosa.
    walkPhase: (progress / 2) % 1,
  };
}

export function bubbleAlpha(avatar: ClientAvatar, now: number): number {
  if (!avatar.bubble) return 0;
  const age = now - avatar.bubble.at;
  if (age >= CHAT_BUBBLE_MS) return 0;
  const fade = CHAT_BUBBLE_MS - 900;
  return age <= fade ? 1 : 1 - (age - fade) / 900;
}
