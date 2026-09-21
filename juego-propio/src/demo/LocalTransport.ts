import type { ClientMessage, ServerMessage } from '../shared/protocol';
import type { ConnectionStatus, Transport } from '../client/transport';
import type { Hotel, Session } from '../server/Hotel';

/**
 * Canal que conecta el cliente con un hotel que corre en esta misma pestaña.
 *
 * Es exactamente el mismo servidor que el de producción, sin la red por medio.
 * La entrega se aplaza a un microtask para que se comporte como un socket de
 * verdad: nadie recibe una respuesta dentro de su propia llamada a `send`.
 */
export class LocalTransport implements Transport {
  private session: Session | null = null;
  private handler: (message: ServerMessage) => void = () => {};
  private statusHandler: (status: ConnectionStatus) => void = () => {};
  private readonly handshake: ClientMessage[] = [];
  private readonly inbox: ServerMessage[] = [];
  private flushing = false;

  constructor(private readonly hotel: Hotel) {}

  now(): number {
    // Cliente y servidor comparten reloj: no hay desfase que corregir.
    return Date.now();
  }

  connect(): void {
    this.statusHandler('conectando');
    this.session = this.hotel.openSession((message) => this.deliver(message));
    this.statusHandler('conectado');
    for (const message of this.handshake) this.hotel.handle(this.session, message);
  }

  send(message: ClientMessage): void {
    if (!this.session) return;
    this.hotel.handle(this.session, message);
  }

  remember(message: ClientMessage): void {
    const index = this.handshake.findIndex((m) => m.t === message.t);
    if (index >= 0) this.handshake.splice(index, 1);
    this.handshake.push(message);
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.handler = handler;
  }

  onStatus(handler: (status: ConnectionStatus) => void): void {
    this.statusHandler = handler;
  }

  private deliver(message: ServerMessage): void {
    this.inbox.push(message);
    if (this.flushing) return;
    this.flushing = true;
    queueMicrotask(() => {
      this.flushing = false;
      while (this.inbox.length > 0) this.handler(this.inbox.shift()!);
    });
  }
}
