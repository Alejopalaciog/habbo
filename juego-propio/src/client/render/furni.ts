import { TILE_H, TILE_W } from '../../shared/constants';
import { FURNI, type Direction, type FurniKind } from '../../shared/types';
import { shade, withAlpha } from './colors';
import { diamondPath, drawBox } from './shapes';

/**
 * Cada mueble se dibuja a mano con primitivas isométricas.
 * (cx, cy) es el centro del rombo de su baldosa.
 */
export function drawFurni(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: FurniKind,
  dir: Direction,
  time: number,
  highlighted: boolean,
): void {
  const def = FURNI[kind];

  ctx.save();
  if (!def.walkable) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, TILE_W * 0.27, TILE_H * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  switch (kind) {
    case 'alfombra':
      drawAlfombra(ctx, cx, cy, def.color);
      break;
    case 'caja':
      drawBox(ctx, cx, cy, 0.8, 0.8, def.height, def.color);
      strapsOnCrate(ctx, cx, cy, def.height);
      break;
    case 'mesa':
      drawMesa(ctx, cx, cy, def.color, def.height);
      break;
    case 'silla':
      drawSilla(ctx, cx, cy, def.color, dir);
      break;
    case 'sofa':
      drawSofa(ctx, cx, cy, def.color, dir);
      break;
    case 'planta':
      drawPlanta(ctx, cx, cy);
      break;
    case 'lampara':
      drawLampara(ctx, cx, cy, def.color);
      break;
    case 'tocadiscos':
      drawTocadiscos(ctx, cx, cy, def.color, time);
      break;
    case 'valla':
      drawValla(ctx, cx, cy, def.color, dir);
      break;
  }

  if (highlighted) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    diamondPath(ctx, cx, cy - TILE_H / 2, TILE_W * 0.82, TILE_H * 0.82);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */

function drawAlfombra(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  diamondPath(ctx, cx, cy - TILE_H / 2, TILE_W * 0.92, TILE_H * 0.92);
  ctx.fillStyle = color;
  ctx.fill();
  diamondPath(ctx, cx, cy - TILE_H / 2 + 3, TILE_W * 0.62, TILE_H * 0.62);
  ctx.fillStyle = shade(color, 0.22);
  ctx.fill();
  diamondPath(ctx, cx, cy - TILE_H / 2 + 6, TILE_W * 0.3, TILE_H * 0.3);
  ctx.fillStyle = shade(color, -0.2);
  ctx.fill();
}

function strapsOnCrate(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number): void {
  ctx.strokeStyle = 'rgba(90, 70, 45, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - TILE_W * 0.2, cy + TILE_H * 0.1 - h / 2);
  ctx.lineTo(cx + TILE_W * 0.2, cy - TILE_H * 0.1 - h / 2);
  ctx.stroke();
}

function drawMesa(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  h: number,
): void {
  const legColor = shade(color, -0.35);
  for (const [dx, dy] of [
    [-13, 3],
    [13, 3],
    [0, 9],
    [0, -3],
  ] as const) {
    ctx.fillStyle = legColor;
    ctx.fillRect(cx + dx - 1.5, cy + dy - h, 3, h);
  }
  diamondPath(ctx, cx, cy - h - TILE_H / 2, TILE_W * 0.86, TILE_H * 0.86);
  ctx.fillStyle = shade(color, 0.12);
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSilla(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  dir: Direction,
): void {
  const seatH = 16;
  drawBox(ctx, cx, cy, 0.62, 0.62, seatH, shade(color, -0.1));
  drawBackrest(ctx, cx, cy - seatH, color, dir, 0.62, 20);
}

function drawSofa(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  dir: Direction,
): void {
  const seatH = 15;
  drawBox(ctx, cx, cy, 0.9, 0.9, seatH, shade(color, -0.08));
  // Cojín.
  diamondPath(ctx, cx, cy - seatH - TILE_H / 2 + 2, TILE_W * 0.66, TILE_H * 0.66);
  ctx.fillStyle = shade(color, 0.2);
  ctx.fill();
  drawBackrest(ctx, cx, cy - seatH, color, dir, 0.92, 18);
}

/** Respaldo colocado en el lado contrario a donde mira el mueble. */
function drawBackrest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  dir: Direction,
  width: number,
  height: number,
): void {
  // El respaldo va detrás: dirección opuesta a `dir`.
  const back = (dir + 4) % 8;
  const dx = back === 2 || back === 1 || back === 3 ? 1 : back === 6 || back === 5 || back === 7 ? -1 : 0;
  const dy = back === 4 || back === 3 || back === 5 ? 1 : back === 0 || back === 1 || back === 7 ? -1 : 0;
  // Se separa lo justo del centro para apoyarse en el borde trasero del asiento.
  const ox = (dx - dy) * (TILE_W / 2) * 0.26;
  const oy = (dx + dy) * (TILE_H / 2) * 0.26;
  drawBox(ctx, cx + ox, cy + oy, width * 0.95, 0.26, height, color);
}

function drawPlanta(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  drawBox(ctx, cx, cy, 0.46, 0.46, 14, '#a8613c');
  const baseY = cy - 14;
  const leafColor = '#2f8f4e';
  for (const [dx, dy, r] of [
    [0, -18, 11],
    [-8, -11, 8],
    [8, -11, 8],
    [-4, -24, 7],
    [5, -23, 7],
  ] as const) {
    ctx.fillStyle = shade(leafColor, dy < -20 ? 0.16 : dx === 0 ? 0 : -0.12);
    ctx.beginPath();
    ctx.ellipse(cx + dx, baseY + dy, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1f6b39';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(cx, baseY - 12);
  ctx.stroke();
}

function drawLampara(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
): void {
  drawBox(ctx, cx, cy, 0.4, 0.4, 5, '#4a4a55');
  ctx.strokeStyle = '#6b6b78';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx, cy - 44);
  ctx.stroke();

  // Halo de luz.
  const glow = ctx.createRadialGradient(cx, cy - 44, 2, cx, cy - 44, 46);
  glow.addColorStop(0, withAlpha(color, 0.5));
  glow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy - 44, 46, 0, Math.PI * 2);
  ctx.fill();

  // Pantalla.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - 44);
  ctx.lineTo(cx + 13, cy - 44);
  ctx.lineTo(cx + 8, cy - 58);
  ctx.lineTo(cx - 8, cy - 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.3);
  ctx.beginPath();
  ctx.ellipse(cx, cy - 44, 13, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTocadiscos(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  time: number,
): void {
  drawBox(ctx, cx, cy, 0.8, 0.8, 18, color);
  const topY = cy - 18 - TILE_H / 2;
  // Disco girando.
  ctx.save();
  ctx.translate(cx, topY + TILE_H / 2);
  ctx.scale(1, TILE_H / TILE_W);
  ctx.rotate((time / 700) % (Math.PI * 2));
  ctx.fillStyle = '#20232b';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8d3c8';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b4150';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
  ctx.restore();

  // Notas musicales flotando.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '12px system-ui, sans-serif';
  for (let i = 0; i < 2; i++) {
    const t = ((time / 1200 + i * 0.5) % 1);
    ctx.globalAlpha = 0.8 * (1 - t);
    ctx.fillText(i === 0 ? '♪' : '♫', cx + 12 + i * 8 + Math.sin(t * 6) * 3, cy - 26 - t * 28);
  }
  ctx.globalAlpha = 1;
}

function drawValla(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  dir: Direction,
): void {
  const along = dir === 2 || dir === 6 ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const ox = (along.x - along.y) * (TILE_W / 2) * 0.4;
  const oy = (along.x + along.y) * (TILE_H / 2) * 0.4;
  const h = 30;

  for (const sign of [-1, 1]) {
    ctx.fillStyle = shade(color, sign < 0 ? -0.1 : -0.2);
    ctx.fillRect(cx + ox * sign - 2, cy + oy * sign - h, 4, h);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (const level of [10, 22]) {
    ctx.beginPath();
    ctx.moveTo(cx - ox, cy - oy - level);
    ctx.lineTo(cx + ox, cy + oy - level);
    ctx.stroke();
  }
}
