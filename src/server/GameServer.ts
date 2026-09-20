import { WebSocketServer, type WebSocket } from 'ws';

import { decode, encode, type ClientMessage } from '../shared/protocol';
import { Hotel, type Session } from './Hotel';

/**
 * Adaptador de WebSockets sobre el `Hotel`.
 *
 * Aquí solo vive lo propio de la red: aceptar conexiones, traducir mensajes y
 * cerrar las que dejan de responder. Las reglas del juego están en Hotel.
 */
export class GameServer {
  private readonly wss: WebSocketServer;
  private readonly hotel = new Hotel();
  private readonly clients = new Map<Session, Client>();
  private readonly reaper: ReturnType<typeof setInterval>;

  constructor(options: { port: number }) {
    this.hotel.start();
    this.wss = new WebSocketServer({ port: options.port, path: '/ws' });
    this.wss.on('connection', (socket) => this.onConnection(socket));
    // Cada 30 s se cierran las conexiones que no responden al ping.
    this.reaper = setInterval(() => this.reapDeadConnections(), 30_000);
  }

  get port(): number {
    const address = this.wss.address();
    return typeof address === 'object' && address !== null ? address.port : 0;
  }

  close(): void {
    clearInterval(this.reaper);
    this.hotel.stop();
    for (const client of this.clients.values()) client.socket.close();
    this.wss.close();
  }

  private onConnection(socket: WebSocket): void {
    const session = this.hotel.openSession((message) => {
      if (socket.readyState === socket.OPEN) socket.send(encode(message));
    });
    const client: Client = { socket, alive: true };
    this.clients.set(session, client);

    socket.on('pong', () => {
      client.alive = true;
    });

    socket.on('message', (data) => {
      const message = decode<ClientMessage>(String(data));
      if (!message) return;
      try {
        this.hotel.handle(session, message);
      } catch (error) {
        console.error('Error atendiendo un mensaje:', error);
      }
    });

    const disconnect = () => {
      if (!this.clients.delete(session)) return;
      this.hotel.closeSession(session);
    };
    socket.on('close', disconnect);
    socket.on('error', disconnect);
  }

  private reapDeadConnections(): void {
    for (const [session, client] of this.clients) {
      if (!client.alive) {
        client.socket.terminate();
        this.clients.delete(session);
        this.hotel.closeSession(session);
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }
}

interface Client {
  socket: WebSocket;
  alive: boolean;
}
