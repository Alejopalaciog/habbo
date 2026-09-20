import {
  CHAT_MIN_INTERVAL_MS,
  MAX_CHAT_LEN,
  MAX_NAME_LEN,
  ROOM_CAPACITY,
  TICK_MS,
} from '../shared/constants';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { ROOMS } from '../shared/rooms';
import { FURNI, type AvatarLook, type Direction, type FurniKind, type RoomSummary } from '../shared/types';
import { Room, type ServerAvatar } from './Room';

/**
 * El hotel: todas las salas y todos los jugadores conectados.
 *
 * No sabe nada de WebSockets ni de red. Un jugador es una `Session` con una
 * función `send`, así que este mismo núcleo sirve para el servidor de verdad
 * (src/server/GameServer.ts) y para ejecutar el juego dentro del navegador.
 */
export class Hotel {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Set<Session>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    for (const model of ROOMS) {
      this.rooms.set(model.id, new Room(model));
    }
  }

  /** Arranca el bucle de simulación. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(Date.now()), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  tick(now: number): void {
    for (const room of this.rooms.values()) room.tick(now);
  }

  /** Da de alta a un jugador. `send` le hace llegar los mensajes del servidor. */
  openSession(send: (message: ServerMessage) => void): Session {
    const session = new Session(makeId(), send);
    this.sessions.add(session);
    return session;
  }

  /** Da de baja a un jugador y avisa a su sala. */
  closeSession(session: Session): void {
    if (!this.sessions.delete(session)) return;
    session.room?.leave(session.avatar.id);
    session.room = null;
    this.broadcastRoomList();
  }

  /* ---------------------------------------------------------------- */

  handle(session: Session, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        return this.onHello(session, message.name, message.look);
      case 'ping':
        return session.send({ t: 'pong', now: Date.now() });
      default:
        break;
    }

    if (!session.ready) {
      return session.send({ t: 'notice', text: 'Identifícate antes de jugar.' });
    }

    switch (message.t) {
      case 'join':
        return this.onJoin(session, message.roomId);
      case 'walk':
        return this.onWalk(session, message.x, message.y);
      case 'turn':
        return this.onTurn(session, message.dir);
      case 'chat':
        return this.onChat(session, message.text);
      case 'gesture':
        session.room?.gesture(session.avatar, message.kind);
        return;
      case 'furni_place':
        return this.onPlaceFurni(session, message.kind, message.x, message.y, message.dir);
      case 'furni_rotate':
        session.room?.rotateFurni(message.id);
        return;
      case 'furni_remove':
        session.room?.removeFurni(message.id);
        return;
      default:
        return;
    }
  }

  private onHello(session: Session, rawName: unknown, rawLook: unknown): void {
    session.avatar.name = sanitizeName(rawName) ?? session.avatar.name;
    session.avatar.look = sanitizeLook(rawLook);
    session.ready = true;
    session.send({
      t: 'welcome',
      youId: session.avatar.id,
      name: session.avatar.name,
      rooms: this.roomList(),
    });
  }

  private onJoin(session: Session, roomId: unknown): void {
    const room = typeof roomId === 'string' ? this.rooms.get(roomId) : undefined;
    if (!room) {
      return session.send({ t: 'notice', text: 'Esa sala no existe.' });
    }
    if (session.room === room) return;
    if (room.isFull) {
      return session.send({ t: 'notice', text: `${room.name} está llena.` });
    }

    session.room?.leave(session.avatar.id);
    session.room = room;
    room.enter({ avatar: session.avatar, send: (message) => session.send(message) });
    room.systemSay(`${session.avatar.name} ha entrado.`);
    this.broadcastRoomList();
  }

  private onWalk(session: Session, x: unknown, y: unknown): void {
    if (!session.room) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    session.room.requestWalk(session.avatar, { x: x as number, y: y as number }, Date.now());
  }

  private onTurn(session: Session, dir: unknown): void {
    if (!session.room) return;
    if (!Number.isInteger(dir) || (dir as number) < 0 || (dir as number) > 7) return;
    session.room.turn(session.avatar, dir as Direction);
  }

  private onChat(session: Session, rawText: unknown): void {
    if (!session.room) return;
    if (typeof rawText !== 'string') return;
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LEN);
    if (!text) return;

    const now = Date.now();
    if (now - session.lastChatAt < CHAT_MIN_INTERVAL_MS) {
      return session.send({ t: 'notice', text: 'Vas demasiado rápido, respira.' });
    }
    session.lastChatAt = now;
    session.room.say(session.avatar, text);
  }

  private onPlaceFurni(
    session: Session,
    kind: unknown,
    x: unknown,
    y: unknown,
    dir: unknown,
  ): void {
    if (!session.room) return;
    if (typeof kind !== 'string' || !(kind in FURNI)) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    const direction = Number.isInteger(dir) ? (((dir as number) & 7) as Direction) : 4;
    const placed = session.room.placeFurni(kind as FurniKind, x as number, y as number, direction);
    if (!placed) {
      session.send({ t: 'notice', text: 'Ahí no cabe.' });
    }
  }

  /* ---------------------------------------------------------------- */

  roomList(): RoomSummary[] {
    return [...this.rooms.values()].map((room) => ({
      id: room.id,
      name: room.name,
      users: room.userCount,
      capacity: ROOM_CAPACITY,
    }));
  }

  broadcastRoomList(): void {
    const rooms = this.roomList();
    for (const session of this.sessions) {
      if (session.ready) session.send({ t: 'rooms', rooms });
    }
  }
}

/** Un jugador conectado, con su avatar y su canal de salida. */
export class Session {
  room: Room | null = null;
  ready = false;
  lastChatAt = 0;
  readonly avatar: ServerAvatar;

  constructor(
    readonly id: string,
    readonly send: (message: ServerMessage) => void,
  ) {
    this.avatar = {
      id,
      name: `Invitado-${id.slice(0, 4)}`,
      look: { ...DEFAULT_LOOK },
      x: 0,
      y: 0,
      h: 0,
      dir: 4,
      sitting: false,
      gesture: null,
      path: [],
      walkStartedAt: 0,
      walkFrom: { x: 0, y: 0, h: 0 },
    };
  }
}

export const DEFAULT_LOOK: AvatarLook = {
  skin: '#f2c9a0',
  hair: '#3b2a20',
  shirt: '#3f7fd6',
  pants: '#2f3a4a',
  shoes: '#1d2330',
};

/** Identificador corto que funciona tanto en Node como en el navegador. */
function makeId(): string {
  const webcrypto = globalThis.crypto;
  if (typeof webcrypto?.randomUUID === 'function') return webcrypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function sanitizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Solo letras, números y separadores simples: nada de HTML ni caracteres raros.
  const name = value
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN);
  return name.length >= 2 ? name : null;
}

const HEX = /^#[0-9a-f]{6}$/i;

function sanitizeLook(value: unknown): AvatarLook {
  const look = { ...DEFAULT_LOOK };
  if (typeof value !== 'object' || value === null) return look;
  for (const part of Object.keys(DEFAULT_LOOK) as (keyof AvatarLook)[]) {
    const color = (value as Record<string, unknown>)[part];
    if (typeof color === 'string' && HEX.test(color)) look[part] = color;
  }
  return look;
}
