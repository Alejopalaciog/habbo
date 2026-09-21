import { HEIGHT_STEP, TILE_H, TILE_W } from '../../shared/constants';
import { tileCenter, tileToScreen } from '../../shared/iso';
import { DOOR } from '../../shared/rooms';
import { FURNI, type FurniKind, type Point } from '../../shared/types';
import { bubbleAlpha, poseOf, type ClientAvatar, type GameState } from '../state';
import { AVATAR_HEIGHT, drawAvatar, roundRect } from './avatar';
import { shade } from './colors';
import { drawFurni } from './furni';
import { diamondPath, quad } from './shapes';

/** Altura de las paredes del fondo, en píxeles. */
const WALL_H = 96;
/** Grosor visible del remate superior de la pared. */
const WALL_CAP = 8;
/** Alto del zócalo pintado al pie de la pared. */
const WALL_SKIRT = 7;

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Lo que el renderizador necesita saber de la interfaz en cada fotograma. */
export interface Frame {
  /** Reloj del servidor ya corregido. */
  serverNow: number;
  /** Baldosa bajo el ratón, o null. */
  hover: Point | null;
  /** Estamos en modo construcción: se previsualiza el mueble seleccionado. */
  buildKind: FurniKind | null;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera: Camera = { x: 0, y: 0, zoom: 1 };
  private dpr = 1;
  private viewW = 0;
  private viewH = 0;
  private centeredRoomId: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: GameState,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no soporta canvas 2D.');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.state.room) this.centerOnRoom();
  }

  /** Coloca la cámara para que la sala quede centrada en pantalla. */
  centerOnRoom(): void {
    const room = this.state.room;
    if (!room) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < this.state.roomHeight; y++) {
      for (let x = 0; x < this.state.roomWidth; x++) {
        const h = this.state.heightAt(x, y);
        if (h === null) continue;
        const north = tileToScreen(x, y, h);
        minX = Math.min(minX, north.x - TILE_W / 2);
        maxX = Math.max(maxX, north.x + TILE_W / 2);
        minY = Math.min(minY, north.y - WALL_H);
        maxY = Math.max(maxY, north.y + TILE_H);
      }
    }
    if (minX === Infinity) return;
    this.camera.x = this.viewW / 2 - (minX + maxX) / 2 * this.camera.zoom;
    this.camera.y = this.viewH / 2 - (minY + maxY) / 2 * this.camera.zoom;
    this.centeredRoomId = room.id;
  }

  pan(dx: number, dy: number): void {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  zoomBy(factor: number, anchorX: number, anchorY: number): void {
    const next = Math.max(0.6, Math.min(2, this.camera.zoom * factor));
    const ratio = next / this.camera.zoom;
    // Se mantiene fijo el punto bajo el cursor.
    this.camera.x = anchorX - (anchorX - this.camera.x) * ratio;
    this.camera.y = anchorY - (anchorY - this.camera.y) * ratio;
    this.camera.zoom = next;
  }

  /** Pasa coordenadas de pantalla (CSS px) al espacio del mundo. */
  private toWorld(sx: number, sy: number): Point {
    return {
      x: (sx - this.camera.x) / this.camera.zoom,
      y: (sy - this.camera.y) / this.camera.zoom,
    };
  }

  /**
   * Baldosa que hay bajo un punto de la pantalla.
   * Recorre las baldosas en el mismo orden en que se pintan y devuelve la
   * última que contiene el punto, así que siempre acierta con la que se ve.
   */
  pickTile(sx: number, sy: number): Point | null {
    const world = this.toWorld(sx, sy);
    let found: Point | null = null;
    for (const tile of this.tilesInDrawOrder()) {
      const center = tileCenter(tile.x, tile.y, tile.h);
      const dx = Math.abs(world.x - center.x) / (TILE_W / 2);
      const dy = Math.abs(world.y - center.y) / (TILE_H / 2);
      if (dx + dy <= 1) found = { x: tile.x, y: tile.y };
    }
    return found;
  }

  /** Baldosas pisables ordenadas por nivel de altura y luego por profundidad. */
  private tilesInDrawOrder(): { x: number; y: number; h: number }[] {
    const tiles: { x: number; y: number; h: number }[] = [];
    for (let y = 0; y < this.state.roomHeight; y++) {
      for (let x = 0; x < this.state.roomWidth; x++) {
        const h = this.state.heightAt(x, y);
        if (h !== null) tiles.push({ x, y, h });
      }
    }
    // Los niveles altos se pintan después para que sus escalones tapen
    // correctamente el suelo que tienen delante.
    tiles.sort((a, b) => a.h - b.h || a.x + a.y - (b.x + b.y));
    return tiles;
  }

  /* ---------------------------------------------------------------- */

  draw(frame: Frame): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    const room = this.state.room;
    if (!room) return;
    if (this.centeredRoomId !== room.id) this.centerOnRoom();

    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const tiles = this.tilesInDrawOrder();
    this.drawWalls(tiles, room.wallColor);
    this.drawFloor(tiles, room.floorColor, frame);
    this.drawEntities(frame);

    ctx.restore();
  }

  /* --- Paredes ------------------------------------------------------ */

  private drawWalls(tiles: { x: number; y: number; h: number }[], color: string): void {
    const ctx = this.ctx;
    // Vector de "grosor" de la pared, hacia el fondo de la escena.
    const capDx = WALL_CAP * 2;
    const capDy = -WALL_CAP;

    for (const tile of tiles) {
      const north = tileToScreen(tile.x, tile.y, tile.h);
      const east = tileToScreen(tile.x + 1, tile.y, tile.h);
      const west = tileToScreen(tile.x, tile.y + 1, tile.h);

      // Pared del lado norte (no hay suelo detrás).
      if (this.state.heightAt(tile.x, tile.y - 1) === null) {
        ctx.fillStyle = shade(color, 0.05);
        quad(ctx, [
          [north.x, north.y - WALL_H],
          [east.x, east.y - WALL_H],
          [east.x, east.y],
          [north.x, north.y],
        ]);
        ctx.fill();
        ctx.fillStyle = shade(color, 0.3);
        quad(ctx, [
          [north.x, north.y - WALL_H],
          [east.x, east.y - WALL_H],
          [east.x + capDx, east.y - WALL_H + capDy],
          [north.x + capDx, north.y - WALL_H + capDy],
        ]);
        ctx.fill();
        // Zócalo.
        ctx.fillStyle = shade(color, -0.3);
        quad(ctx, [
          [north.x, north.y - WALL_SKIRT],
          [east.x, east.y - WALL_SKIRT],
          [east.x, east.y],
          [north.x, north.y],
        ]);
        ctx.fill();
      }

      // Pared del lado oeste.
      if (this.state.heightAt(tile.x - 1, tile.y) === null) {
        ctx.fillStyle = shade(color, -0.16);
        quad(ctx, [
          [north.x, north.y - WALL_H],
          [west.x, west.y - WALL_H],
          [west.x, west.y],
          [north.x, north.y],
        ]);
        ctx.fill();
        ctx.fillStyle = shade(color, 0.2);
        quad(ctx, [
          [north.x, north.y - WALL_H],
          [west.x, west.y - WALL_H],
          [west.x - capDx, west.y - WALL_H + capDy],
          [north.x - capDx, north.y - WALL_H + capDy],
        ]);
        ctx.fill();
        ctx.fillStyle = shade(color, -0.42);
        quad(ctx, [
          [north.x, north.y - WALL_SKIRT],
          [west.x, west.y - WALL_SKIRT],
          [west.x, west.y],
          [north.x, north.y],
        ]);
        ctx.fill();
      }
    }
  }

  /* --- Suelo -------------------------------------------------------- */

  private drawFloor(
    tiles: { x: number; y: number; h: number }[],
    color: string,
    frame: Frame,
  ): void {
    const ctx = this.ctx;
    const map = this.state.room!.map;

    for (const tile of tiles) {
      const north = tileToScreen(tile.x, tile.y, tile.h);
      const east = tileToScreen(tile.x + 1, tile.y, tile.h);
      const south = tileToScreen(tile.x + 1, tile.y + 1, tile.h);
      const west = tileToScreen(tile.x, tile.y + 1, tile.h);

      // Escalón del lado este.
      const hEast = this.state.heightAt(tile.x + 1, tile.y);
      const dropEast = (hEast === null ? tile.h : tile.h - hEast) * HEIGHT_STEP;
      if (dropEast > 0) {
        ctx.fillStyle = shade(color, -0.24);
        quad(ctx, [
          [east.x, east.y],
          [south.x, south.y],
          [south.x, south.y + dropEast],
          [east.x, east.y + dropEast],
        ]);
        ctx.fill();
      }

      // Escalón del lado sur.
      const hSouth = this.state.heightAt(tile.x, tile.y + 1);
      const dropSouth = (hSouth === null ? tile.h : tile.h - hSouth) * HEIGHT_STEP;
      if (dropSouth > 0) {
        ctx.fillStyle = shade(color, -0.4);
        quad(ctx, [
          [west.x, west.y],
          [south.x, south.y],
          [south.x, south.y + dropSouth],
          [west.x, west.y + dropSouth],
        ]);
        ctx.fill();
      }

      // Cara superior, con damero suave para leer la rejilla.
      const isDoor = map[tile.y]?.[tile.x] === DOOR;
      const checker = (tile.x + tile.y) % 2 === 0 ? 0.06 : -0.02;
      ctx.fillStyle = isDoor ? shade(color, 0.3) : shade(color, checker + tile.h * 0.05);
      diamondPath(ctx, north.x, north.y);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isDoor) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        diamondPath(ctx, north.x, north.y + 6, TILE_W * 0.6, TILE_H * 0.6);
        ctx.fill();
      }
    }

    // Baldosa bajo el ratón.
    if (frame.hover) {
      const h = this.state.heightAt(frame.hover.x, frame.hover.y);
      if (h !== null) {
        const north = tileToScreen(frame.hover.x, frame.hover.y, h);
        const buildable =
          frame.buildKind === null || this.state.furniAt(frame.hover.x, frame.hover.y) === undefined;
        ctx.fillStyle = buildable ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 90, 90, 0.3)';
        diamondPath(ctx, north.x, north.y);
        ctx.fill();
        ctx.strokeStyle = buildable ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 120, 120, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  /* --- Muebles y avatares ------------------------------------------ */

  private drawEntities(frame: Frame): void {
    const ctx = this.ctx;

    interface Entry {
      depth: number;
      layer: number;
      draw(): void;
    }
    const entries: Entry[] = [];

    for (const furni of this.state.furni) {
      const h = this.state.heightAt(furni.x, furni.y);
      if (h === null) continue;
      const center = tileCenter(furni.x, furni.y, h);
      const hovered =
        frame.buildKind !== null &&
        frame.hover?.x === furni.x &&
        frame.hover?.y === furni.y;
      entries.push({
        depth: furni.x + furni.y,
        layer: FURNI[furni.kind].walkable ? 0 : 1,
        draw: () =>
          drawFurni(ctx, center.x, center.y, furni.kind, furni.dir, frame.serverNow, hovered),
      });
    }

    for (const avatar of this.state.avatars.values()) {
      const pose = poseOf(avatar, frame.serverNow);
      const center = tileCenter(pose.x, pose.y, pose.h);
      entries.push({
        depth: pose.x + pose.y,
        layer: 2,
        draw: () => {
          drawAvatar(ctx, center.x, center.y, {
            look: avatar.look,
            dir: pose.dir,
            walkPhase: pose.walkPhase,
            sitting: avatar.sitting,
            gesture: frame.serverNow < avatar.gestureUntil ? avatar.gestureKind : null,
            time: frame.serverNow,
          });
          this.drawNameTag(avatar, center.x, center.y, avatar.id === this.state.youId);
        },
      });
    }

    // Vista previa translúcida del mueble que se va a colocar.
    if (frame.buildKind && frame.hover) {
      const h = this.state.heightAt(frame.hover.x, frame.hover.y);
      if (h !== null && !this.state.furniAt(frame.hover.x, frame.hover.y)) {
        const center = tileCenter(frame.hover.x, frame.hover.y, h);
        const kind = frame.buildKind;
        entries.push({
          depth: frame.hover.x + frame.hover.y,
          layer: 3,
          draw: () => {
            ctx.globalAlpha = 0.55;
            drawFurni(ctx, center.x, center.y, kind, 4, frame.serverNow, false);
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    entries.sort((a, b) => a.depth - b.depth || a.layer - b.layer);
    for (const entry of entries) entry.draw();

    // Los bocadillos van por encima de todo lo demás.
    for (const avatar of this.state.avatars.values()) {
      const alpha = bubbleAlpha(avatar, frame.serverNow);
      if (alpha <= 0) continue;
      const pose = poseOf(avatar, frame.serverNow);
      const center = tileCenter(pose.x, pose.y, pose.h);
      this.drawBubble(avatar, center.x, center.y, alpha);
    }
  }

  private drawNameTag(
    avatar: ClientAvatar,
    cx: number,
    cy: number,
    isYou: boolean,
  ): void {
    const ctx = this.ctx;
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = avatar.name;
    const width = ctx.measureText(text).width + 12;
    const y = cy - AVATAR_HEIGHT - 8;

    ctx.fillStyle = isYou ? 'rgba(60, 130, 230, 0.92)' : 'rgba(20, 24, 34, 0.7)';
    roundRect(ctx, cx - width / 2, y - 8, width, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, y);
  }

  private drawBubble(avatar: ClientAvatar, cx: number, cy: number, alpha: number): void {
    const bubble = avatar.bubble;
    if (!bubble) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const lines = wrapText(ctx, bubble.text, 190);
    const lineH = 15;
    const padding = 9;
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2;
    const height = lines.length * lineH + padding * 2 - 4;
    const x = cx - width / 2;
    const y = cy - AVATAR_HEIGHT - 26 - height;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = 'rgba(30, 40, 60, 0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, height, 9);
    ctx.fill();
    ctx.stroke();
    // Pico del bocadillo.
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + height - 1);
    ctx.lineTo(cx, y + height + 7);
    ctx.lineTo(cx + 6, y + height - 1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fill();

    ctx.fillStyle = '#1b2433';
    lines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + index * lineH + 4);
    });
    ctx.restore();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}
