import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

import {
  CHAT_MIN_INTERVAL_MS,
  MAX_CHAT_LEN,
  MAX_NAME_LEN,
  TICK_MS,
} from '../shared/constants';
import { decode, encode, type ClientMessage, type ServerMessage } from '../shared/protocol';
import { ROOMS } from '../shared/rooms';
import { FURNI, type AvatarLook, type Direction, type FurniKind, type RoomSummary } from '../shared/types';
import { Room, type ServerAvatar } from './Room';

const DEFAULT_LOOK: AvatarLook = {
  skin: '#f2c9a0',
  hair: '#3b2a20',
  shirt: '#3f7fd6',
  pants: '#2f3a4a',
  shoes: '#1d2330',
};

interface Connection {
  socket: WebSocket;
  avatar: ServerAvatar;
  room: Room | null;
  ready: boolean;
  lastChatAt: number;
  alive: boolean;
}

export class GameServer {
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<string, Room>();
  private readonly connections = new Set<Connection>();
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(options: { port: number }) {
    for (const model of ROOMS) {
      this.rooms.set(model.id, new Room(model));
    }

    this.wss = new WebSocketServer({ port: options.port, path: '/ws' });
    this.wss.on('connection', (socket) => this.onConnection(socket));

    this.timers.push(setInterval(() => this.tick(), TICK_MS));
    // Cada 30 s se cierran las conexiones que no responden al ping.
    this.timers.push(setInterval(() => this.reapDeadConnections(), 30_000));
  }

  get port(): number {
    const address = this.wss.address();
    return typeof address === 'object' && address !== null ? address.port : 0;
  }

  close(): void {
    for (const timer of this.timers) clearInterval(timer);
    for (const connection of this.connections) connection.socket.close();
    this.wss.close();
  }

  /* ---------------------------------------------------------------- */

  private onConnection(socket: WebSocket): void {
    const id = randomUUID().slice(0, 8);
    const connection: Connection = {
      socket,
      room: null,
      ready: false,
      lastChatAt: 0,
      alive: true,
      avatar: {
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
      },
    };
    this.connections.add(connection);

    socket.on('pong', () => {
      connection.alive = true;
    });
    socket.on('message', (data) => {
      const message = decode<ClientMessage>(String(data));
      if (!message) return;
      try {
        this.handle(connection, message);
      } catch (error) {
        console.error('Error atendiendo un mensaje:', error);
      }
    });
    socket.on('close', () => this.disconnect(connection));
    socket.on('error', () => this.disconnect(connection));
  }

  private disconnect(connection: Connection): void {
    if (!this.connections.delete(connection)) return;
    connection.room?.leave(connection.avatar.id);
    connection.room = null;
    this.broadcastRoomList();
  }

  private send(connection: Connection, message: ServerMessage): void {
    if (connection.socket.readyState !== connection.socket.OPEN) return;
    connection.socket.send(encode(message));
  }

  /* ---------------------------------------------------------------- */

  private handle(connection: Connection, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        return this.onHello(connection, message.name, message.look);
      case 'ping':
        return this.send(connection, { t: 'pong', now: Date.now() });
      default:
        break;
    }

    if (!connection.ready) {
      return this.send(connection, { t: 'notice', text: 'Identifícate antes de jugar.' });
    }

    switch (message.t) {
      case 'join':
        return this.onJoin(connection, message.roomId);
      case 'walk':
        return this.onWalk(connection, message.x, message.y);
      case 'turn':
        return this.onTurn(connection, message.dir);
      case 'chat':
        return this.onChat(connection, message.text);
      case 'gesture':
        connection.room?.gesture(connection.avatar, message.kind);
        return;
      case 'furni_place':
        return this.onPlaceFurni(connection, message.kind, message.x, message.y, message.dir);
      case 'furni_rotate':
        connection.room?.rotateFurni(message.id);
        return;
      case 'furni_remove':
        connection.room?.removeFurni(message.id);
        return;
      default:
        return;
    }
  }

  private onHello(connection: Connection, rawName: unknown, rawLook: unknown): void {
    connection.avatar.name = sanitizeName(rawName) ?? connection.avatar.name;
    connection.avatar.look = sanitizeLook(rawLook);
    connection.ready = true;
    this.send(connection, {
      t: 'welcome',
      youId: connection.avatar.id,
      name: connection.avatar.name,
      rooms: this.roomList(),
    });
  }

  private onJoin(connection: Connection, roomId: unknown): void {
    const room = typeof roomId === 'string' ? this.rooms.get(roomId) : undefined;
    if (!room) {
      return this.send(connection, { t: 'notice', text: 'Esa sala no existe.' });
    }
    if (connection.room === room) return;
    if (room.isFull) {
      return this.send(connection, { t: 'notice', text: `${room.name} está llena.` });
    }

    connection.room?.leave(connection.avatar.id);
    connection.room = room;
    room.enter({
      avatar: connection.avatar,
      send: (message) => this.send(connection, message),
    });
    room.systemSay(`${connection.avatar.name} ha entrado.`);
    this.broadcastRoomList();
  }

  private onWalk(connection: Connection, x: unknown, y: unknown): void {
    if (!connection.room) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    connection.room.requestWalk(connection.avatar, { x: x as number, y: y as number }, Date.now());
  }

  private onTurn(connection: Connection, dir: unknown): void {
    if (!connection.room) return;
    if (!Number.isInteger(dir) || (dir as number) < 0 || (dir as number) > 7) return;
    connection.room.turn(connection.avatar, dir as Direction);
  }

  private onChat(connection: Connection, rawText: unknown): void {
    if (!connection.room) return;
    if (typeof rawText !== 'string') return;
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LEN);
    if (!text) return;

    const now = Date.now();
    if (now - connection.lastChatAt < CHAT_MIN_INTERVAL_MS) {
      return this.send(connection, { t: 'notice', text: 'Vas demasiado rápido, respira.' });
    }
    connection.lastChatAt = now;
    connection.room.say(connection.avatar, text);
  }

  private onPlaceFurni(
    connection: Connection,
    kind: unknown,
    x: unknown,
    y: unknown,
    dir: unknown,
  ): void {
    if (!connection.room) return;
    if (typeof kind !== 'string' || !(kind in FURNI)) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    const direction = Number.isInteger(dir) ? ((dir as number) & 7) as Direction : 4;
    const placed = connection.room.placeFurni(kind as FurniKind, x as number, y as number, direction);
    if (!placed) {
      this.send(connection, { t: 'notice', text: 'Ahí no cabe.' });
    }
  }

  /* ---------------------------------------------------------------- */

  private roomList(): RoomSummary[] {
    return [...this.rooms.values()].map((room) => ({
      id: room.id,
      name: room.name,
      users: room.userCount,
      capacity: 25,
    }));
  }

  private broadcastRoomList(): void {
    const rooms = this.roomList();
    for (const connection of this.connections) {
      if (connection.ready) this.send(connection, { t: 'rooms', rooms });
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) room.tick(now);
  }

  private reapDeadConnections(): void {
    for (const connection of this.connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        this.disconnect(connection);
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }
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
