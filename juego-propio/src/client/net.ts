import { decode, encode, type ClientMessage, type ServerMessage } from '../shared/protocol';
import type { ConnectionStatus, Transport } from './transport';

type Handler = (message: ServerMessage) => void;

/**
 * Conexión con el servidor de juego.
 *
 * Se encarga de tres cosas: reconectar si se corta, medir el desfase entre el
 * reloj del navegador y el del servidor (los caminos llegan con marcas de
 * tiempo del servidor) y encolar los mensajes que se envían antes de estar
 * conectado.
 */
export class Net implements Transport {
  private socket: WebSocket | null = null;
  private readonly queue: ClientMessage[] = [];
  private handler: Handler = () => {};
  private statusHandler: (status: ConnectionStatus, detail?: string) => void = () => {};
  private reconnectDelay = 700;
  private pingTimer: number | null = null;
  private pingSentAt = 0;
  private closedByUser = false;

  /** Desfase estimado: serverNow ≈ Date.now() + clockOffset. */
  private clockOffset = 0;
  private bestRtt = Infinity;

  /** Mensaje que se reenvía automáticamente al reconectar. */
  private handshake: ClientMessage[] = [];

  constructor(private readonly url: string) {}

  onMessage(handler: Handler): void {
    this.handler = handler;
  }

  onStatus(handler: (status: ConnectionStatus, detail?: string) => void): void {
    this.statusHandler = handler;
  }

  /** Reloj del servidor estimado, en milisegundos. */
  now(): number {
    return Date.now() + this.clockOffset;
  }

  connect(): void {
    this.closedByUser = false;
    this.statusHandler(this.socket === null ? 'conectando' : 'reconectando');

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectDelay = 700;
      this.bestRtt = Infinity;
      this.statusHandler('conectado');
      for (const message of this.handshake) socket.send(encode(message));
      while (this.queue.length > 0) socket.send(encode(this.queue.shift()!));
      this.startPinging();
    });

    socket.addEventListener('message', (event) => {
      const message = decode<ServerMessage>(String(event.data));
      if (!message) return;
      if (message.t === 'pong') {
        this.applyClockSample(message.now);
        return;
      }
      this.handler(message);
    });

    socket.addEventListener('close', () => {
      this.stopPinging();
      if (this.closedByUser) {
        this.statusHandler('cerrado');
        return;
      }
      this.statusHandler('reconectando');
      window.setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 8000);
    });

    socket.addEventListener('error', () => {
      // El evento 'close' llega justo después y es el que gestiona el reintento.
    });
  }

  close(): void {
    this.closedByUser = true;
    this.stopPinging();
    this.socket?.close();
  }

  /**
   * Guarda mensajes que definen la sesión (identidad y sala) para reenviarlos
   * tal cual si hay que reconectar.
   */
  remember(message: ClientMessage): void {
    this.handshake = this.handshake.filter((m) => m.t !== message.t);
    this.handshake.push(message);
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encode(message));
    } else {
      this.queue.push(message);
    }
  }

  private startPinging(): void {
    this.stopPinging();
    const ping = () => {
      this.pingSentAt = Date.now();
      this.send({ t: 'ping' });
    };
    ping();
    this.pingTimer = window.setInterval(ping, 8000);
  }

  private stopPinging(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  /**
   * Con el ida y vuelta del ping se estima el desfase de relojes.
   * Nos quedamos con la muestra de menor latencia, que es la más fiable.
   */
  private applyClockSample(serverNow: number): void {
    const received = Date.now();
    const rtt = received - this.pingSentAt;
    if (rtt > this.bestRtt) return;
    this.bestRtt = rtt;
    this.clockOffset = serverNow + rtt / 2 - received;
  }
}
