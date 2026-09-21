import { CHAT_HISTORY, ROOM_CAPACITY, STEP_MS } from '../shared/constants';
import { directionBetween } from '../shared/iso';
import { findPath, type NavGrid } from '../shared/pathfinding';
import type { RoomPayload, ServerMessage } from '../shared/protocol';
import { findDoor, mapHeightAt, mapSize, type RoomModel } from '../shared/rooms';
import {
  FURNI,
  type AvatarState,
  type ChatLine,
  type Direction,
  type FurniKind,
  type FurniState,
  type PathNode,
  type Point,
} from '../shared/types';

/** Un avatar tal y como lo lleva el servidor: estado visible + camino en curso. */
export interface ServerAvatar extends AvatarState {
  /** Baldosas que quedan por recorrer. Vacío si está quieto. */
  path: PathNode[];
  /** Momento (ms del servidor) en que empezó a recorrer `path`. */
  walkStartedAt: number;
  /** Baldosa desde la que arrancó el camino actual. */
  walkFrom: PathNode;
}

export interface RoomMember {
  avatar: ServerAvatar;
  send(message: ServerMessage): void;
}

let furniSeq = 0;

export class Room {
  readonly id: string;
  readonly name: string;
  private readonly model: RoomModel;
  private readonly width: number;
  private readonly height: number;
  private readonly door: Point;
  private readonly members = new Map<string, RoomMember>();
  private readonly furni: FurniState[] = [];
  private readonly history: ChatLine[] = [];

  constructor(model: RoomModel) {
    this.model = model;
    this.id = model.id;
    this.name = model.name;
    const size = mapSize(model.map);
    this.width = size.width;
    this.height = size.height;
    this.door = findDoor(model.map);
    for (const item of model.furni) {
      this.furni.push({ id: `f${++furniSeq}`, kind: item.kind, x: item.x, y: item.y, dir: item.dir });
    }
  }

  get userCount(): number {
    return this.members.size;
  }

  get isFull(): boolean {
    return this.members.size >= ROOM_CAPACITY;
  }

  /* ---------------------------------------------------------------- */
  /* Entrar y salir                                                    */
  /* ---------------------------------------------------------------- */

  enter(member: RoomMember): void {
    const spawn = this.freeSpawnTile();
    const avatar = member.avatar;
    avatar.x = spawn.x;
    avatar.y = spawn.y;
    avatar.h = mapHeightAt(this.model.map, spawn.x, spawn.y) ?? 0;
    avatar.dir = 3;
    avatar.sitting = false;
    avatar.path = [];
    avatar.walkFrom = { x: spawn.x, y: spawn.y, h: avatar.h };

    this.members.set(avatar.id, member);
    member.send({
      t: 'room',
      room: this.payload(),
      avatars: [...this.members.values()].map((m) => publicAvatar(m.avatar)),
      furni: [...this.furni],
      history: [...this.history],
    });
    this.broadcast({ t: 'avatar_enter', avatar: publicAvatar(avatar) }, avatar.id);

    // Quien acaba de entrar también necesita los caminos ya en curso, o vería
    // a los demás quietos hasta que terminasen de andar.
    for (const other of this.members.values()) {
      if (other.avatar.path.length === 0) continue;
      member.send({
        t: 'avatar_walk',
        id: other.avatar.id,
        from: other.avatar.walkFrom,
        path: other.avatar.path,
        startedAt: other.avatar.walkStartedAt,
      });
    }
  }

  leave(id: string): void {
    if (this.members.delete(id)) {
      this.broadcast({ t: 'avatar_leave', id });
    }
  }

  private payload(): RoomPayload {
    return {
      id: this.model.id,
      name: this.model.name,
      description: this.model.description,
      map: [...this.model.map],
      floorColor: this.model.floorColor,
      wallColor: this.model.wallColor,
    };
  }

  /** Busca un hueco libre empezando por la puerta y abriéndose en espiral. */
  private freeSpawnTile(): Point {
    if (this.isTileFree(this.door.x, this.door.y)) return this.door;
    for (let radius = 1; radius <= 6; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = this.door.x + dx;
          const y = this.door.y + dy;
          if (this.isTileFree(x, y)) return { x, y };
        }
      }
    }
    return this.door;
  }

  private isTileFree(x: number, y: number): boolean {
    if (mapHeightAt(this.model.map, x, y) === null) return false;
    return !this.isBlockedFor(x, y, null);
  }

  /* ---------------------------------------------------------------- */
  /* Navegación                                                        */
  /* ---------------------------------------------------------------- */

  /** El mueble que hay en una baldosa, si hay alguno. */
  furniAt(x: number, y: number): FurniState | undefined {
    return this.furni.find((f) => f.x === x && f.y === y);
  }

  /**
   * ¿La baldosa está ocupada para quien pregunta?
   * Un avatar que camina reserva su baldosa de destino, para que dos jugadores
   * no acaben pisando la misma.
   */
  private isBlockedFor(x: number, y: number, exceptId: string | null): boolean {
    const furni = this.furniAt(x, y);
    if (furni && !FURNI[furni.kind].walkable) return true;

    for (const member of this.members.values()) {
      const avatar = member.avatar;
      if (avatar.id === exceptId) continue;
      const claimed = avatar.path.length > 0 ? avatar.path[avatar.path.length - 1]! : avatar;
      if (claimed.x === x && claimed.y === y) return true;
      // También cuenta la baldosa en la que está ahora mismo, para no
      // atravesarla mientras se aparta.
      if (avatar.x === x && avatar.y === y) return true;
    }
    return false;
  }

  private navGridFor(avatar: ServerAvatar): NavGrid {
    return {
      width: this.width,
      height: this.height,
      heightAt: (x, y) => mapHeightAt(this.model.map, x, y),
      isBlocked: (x, y) => this.isBlockedFor(x, y, avatar.id),
    };
  }

  /**
   * Pide a un avatar que camine hasta una baldosa.
   * Devuelve false si no hay camino posible.
   */
  requestWalk(avatar: ServerAvatar, target: Point, now: number): boolean {
    const targetHeight = mapHeightAt(this.model.map, target.x, target.y);
    if (targetHeight === null) return false;

    const furni = this.furniAt(target.x, target.y);
    const def = furni ? FURNI[furni.kind] : null;
    // Sobre una silla se puede acabar el camino; sobre una mesa no.
    if (def && !def.walkable && !def.sittable) return false;
    if (this.isOccupiedByOther(target, avatar.id)) return false;

    // Se recalcula desde la baldosa ya "confirmada", y el camino nuevo arranca
    // en el instante en que llegó a ella: así no da un salto en pantalla.
    const { tile, at } = this.committedTile(avatar, now);
    const path = findPath(this.navGridFor(avatar), tile, target);
    if (path.length === 0) return false;

    avatar.walkFrom = tile;
    avatar.walkStartedAt = at;
    avatar.path = path;
    if (avatar.sitting) {
      avatar.sitting = false;
      this.broadcast({ t: 'avatar_update', id: avatar.id, sitting: false });
    }
    this.broadcast({ t: 'avatar_walk', id: avatar.id, from: tile, path, startedAt: at });
    return true;
  }

  private isOccupiedByOther(target: Point, exceptId: string): boolean {
    for (const member of this.members.values()) {
      const other = member.avatar;
      if (other.id === exceptId) continue;
      const claimed = other.path.length > 0 ? other.path[other.path.length - 1]! : other;
      if (claimed.x === target.x && claimed.y === target.y) return true;
    }
    return false;
  }

  /** Última baldosa que el avatar ha pisado del todo, y cuándo la pisó. */
  private committedTile(avatar: ServerAvatar, now: number): { tile: PathNode; at: number } {
    if (avatar.path.length === 0) {
      return { tile: { x: avatar.x, y: avatar.y, h: avatar.h }, at: now };
    }
    const elapsed = Math.max(0, now - avatar.walkStartedAt);
    const steps = Math.min(Math.floor(elapsed / STEP_MS), avatar.path.length);
    const tile = steps === 0 ? avatar.walkFrom : avatar.path[steps - 1]!;
    return { tile, at: avatar.walkStartedAt + steps * STEP_MS };
  }

  turn(avatar: ServerAvatar, dir: Direction): void {
    if (avatar.path.length > 0 || avatar.sitting) return;
    avatar.dir = dir;
    this.broadcast({ t: 'avatar_update', id: avatar.id, dir });
  }

  /** Avanza la simulación: comprueba quién ha terminado su camino. */
  tick(now: number): void {
    for (const member of this.members.values()) {
      const avatar = member.avatar;
      if (avatar.path.length === 0) continue;

      const elapsed = now - avatar.walkStartedAt;
      const steps = Math.floor(elapsed / STEP_MS);
      if (steps < avatar.path.length) {
        // Todavía en camino: solo actualizamos la posición autoritativa.
        const tile = steps === 0 ? avatar.walkFrom : avatar.path[steps - 1]!;
        avatar.x = tile.x;
        avatar.y = tile.y;
        avatar.h = tile.h;
        continue;
      }

      const last = avatar.path[avatar.path.length - 1]!;
      const previous = avatar.path.length > 1 ? avatar.path[avatar.path.length - 2]! : avatar.walkFrom;
      avatar.x = last.x;
      avatar.y = last.y;
      avatar.h = last.h;
      avatar.dir = directionBetween(previous, last);
      avatar.path = [];
      avatar.walkFrom = last;

      const furni = this.furniAt(last.x, last.y);
      if (furni && FURNI[furni.kind].sittable) {
        avatar.sitting = true;
        avatar.dir = furni.dir;
      }

      this.broadcast({
        t: 'avatar_update',
        id: avatar.id,
        x: avatar.x,
        y: avatar.y,
        h: avatar.h,
        dir: avatar.dir,
        sitting: avatar.sitting,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Chat y gestos                                                     */
  /* ---------------------------------------------------------------- */

  say(avatar: ServerAvatar, text: string): void {
    const line: ChatLine = { id: avatar.id, name: avatar.name, text, at: Date.now() };
    this.history.push(line);
    if (this.history.length > CHAT_HISTORY) this.history.shift();
    this.broadcast({ t: 'chat', line });
  }

  systemSay(text: string): void {
    const line: ChatLine = { id: 'sistema', name: 'Hotel', text, at: Date.now() };
    this.history.push(line);
    if (this.history.length > CHAT_HISTORY) this.history.shift();
    this.broadcast({ t: 'chat', line });
  }

  gesture(avatar: ServerAvatar, kind: 'wave' | 'dance'): void {
    this.broadcast({ t: 'gesture', id: avatar.id, kind });
  }

  /* ---------------------------------------------------------------- */
  /* Muebles                                                           */
  /* ---------------------------------------------------------------- */

  placeFurni(kind: FurniKind, x: number, y: number, dir: Direction): FurniState | null {
    if (mapHeightAt(this.model.map, x, y) === null) return null;
    if (this.furniAt(x, y)) return null;
    // No se puede tapar a un jugador con algo sólido.
    if (!FURNI[kind].walkable) {
      for (const member of this.members.values()) {
        const avatar = member.avatar;
        if (avatar.x === x && avatar.y === y) return null;
        const claimed = avatar.path.length > 0 ? avatar.path[avatar.path.length - 1]! : null;
        if (claimed && claimed.x === x && claimed.y === y) return null;
      }
    }
    const furni: FurniState = { id: `f${++furniSeq}`, kind, x, y, dir };
    this.furni.push(furni);
    this.broadcast({ t: 'furni_add', furni });
    return furni;
  }

  rotateFurni(id: string): void {
    const furni = this.furni.find((f) => f.id === id);
    if (!furni) return;
    furni.dir = (((furni.dir + 2) % 8) as Direction);
    this.broadcast({ t: 'furni_update', furni });
    // Quien esté sentado encima gira con el mueble.
    for (const member of this.members.values()) {
      const avatar = member.avatar;
      if (avatar.sitting && avatar.x === furni.x && avatar.y === furni.y) {
        avatar.dir = furni.dir;
        this.broadcast({ t: 'avatar_update', id: avatar.id, dir: avatar.dir });
      }
    }
  }

  removeFurni(id: string): void {
    const index = this.furni.findIndex((f) => f.id === id);
    if (index === -1) return;
    const [furni] = this.furni.splice(index, 1);
    this.broadcast({ t: 'furni_remove', id });
    if (!furni) return;
    for (const member of this.members.values()) {
      const avatar = member.avatar;
      if (avatar.sitting && avatar.x === furni.x && avatar.y === furni.y) {
        avatar.sitting = false;
        this.broadcast({ t: 'avatar_update', id: avatar.id, sitting: false });
      }
    }
  }

  /* ---------------------------------------------------------------- */

  broadcast(message: ServerMessage, exceptId?: string): void {
    for (const member of this.members.values()) {
      if (member.avatar.id === exceptId) continue;
      member.send(message);
    }
  }
}

/** Copia del avatar sin los campos internos de simulación. */
export function publicAvatar(avatar: ServerAvatar): AvatarState {
  return {
    id: avatar.id,
    name: avatar.name,
    look: avatar.look,
    x: avatar.x,
    y: avatar.y,
    h: avatar.h,
    dir: avatar.dir,
    sitting: avatar.sitting,
    gesture: null,
  };
}
