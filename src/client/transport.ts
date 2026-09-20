import type { ClientMessage, ServerMessage } from '../shared/protocol';

export type ConnectionStatus = 'conectando' | 'conectado' | 'reconectando' | 'cerrado';

/**
 * Canal por el que el cliente habla con el servidor.
 *
 * El juego no sabe si al otro lado hay un WebSocket (src/client/net.ts) o un
 * hotel corriendo en la propia pestaña (src/demo/LocalTransport.ts).
 */
export interface Transport {
  /** Reloj del servidor estimado, en milisegundos. */
  now(): number;
  connect(): void;
  send(message: ClientMessage): void;
  /** Mensajes que definen la sesión y hay que reenviar si se reconecta. */
  remember(message: ClientMessage): void;
  onMessage(handler: (message: ServerMessage) => void): void;
  onStatus(handler: (status: ConnectionStatus, detail?: string) => void): void;
}
