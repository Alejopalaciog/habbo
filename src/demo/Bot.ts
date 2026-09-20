import { getRoomModel, mapHeightAt, mapSize } from '../shared/rooms';
import type { AvatarLook, Point } from '../shared/types';
import type { Hotel, Session } from '../server/Hotel';

/**
 * Un vecino del hotel controlado por el ordenador.
 *
 * No hace trampas: habla con el mismo `Hotel` y los mismos mensajes que un
 * jugador de carne y hueso, así que si el servidor le dice que no puede pasar,
 * no pasa.
 */
export class Bot {
  private readonly session: Session;
  private readonly tiles: Point[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lineIndex = 0;

  constructor(
    private readonly hotel: Hotel,
    private readonly options: {
      name: string;
      look: AvatarLook;
      roomId: string;
      /** Frases que va soltando, en orden. */
      lines: readonly string[];
    },
  ) {
    // Un bot no necesita escuchar nada: le basta con actuar.
    this.session = hotel.openSession(() => {});
    this.tiles = walkableTiles(options.roomId);

    hotel.handle(this.session, { t: 'hello', name: options.name, look: options.look });
    hotel.handle(this.session, { t: 'join', roomId: options.roomId });
  }

  /** Empieza a moverse tras un retardo, para que no arranquen todos a la vez. */
  start(delayMs: number): void {
    this.timer = setTimeout(() => this.act(), delayMs);
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.hotel.closeSession(this.session);
  }

  private act(): void {
    const roll = Math.random();
    if (roll < 0.62) {
      const tile = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      if (tile) this.hotel.handle(this.session, { t: 'walk', x: tile.x, y: tile.y });
    } else if (roll < 0.87 && this.options.lines.length > 0) {
      const line = this.options.lines[this.lineIndex % this.options.lines.length]!;
      this.lineIndex++;
      this.hotel.handle(this.session, { t: 'chat', text: line });
    } else {
      this.hotel.handle(this.session, {
        t: 'gesture',
        kind: Math.random() < 0.5 ? 'wave' : 'dance',
      });
    }
    this.timer = setTimeout(() => this.act(), 2200 + Math.random() * 4200);
  }
}

/** Todas las baldosas pisables de una sala. */
function walkableTiles(roomId: string): Point[] {
  const model = getRoomModel(roomId);
  if (!model) return [];
  const { width, height } = mapSize(model.map);
  const tiles: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mapHeightAt(model.map, x, y) !== null) tiles.push({ x, y });
    }
  }
  return tiles;
}
