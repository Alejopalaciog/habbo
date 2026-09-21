import { HEIGHT_STEP, TILE_H, TILE_W } from '../../shared/constants';
import { shade } from './colors';

/** Dibuja un rombo isométrico con su esquina norte en (x, y). */
export function diamondPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w = TILE_W,
  h = TILE_H,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.closePath();
}

export function quad(
  ctx: CanvasRenderingContext2D,
  points: readonly [number, number][],
): void {
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]![0], points[i]![1]);
  ctx.closePath();
}

/**
 * Dibuja un prisma isométrico (una "caja") apoyado en el centro de una baldosa.
 *
 * @param cx,cy  centro del rombo donde se apoya la caja
 * @param w      anchura en fracción de baldosa (1 = ocupa la baldosa entera)
 * @param d      profundidad en fracción de baldosa
 * @param h      altura en píxeles
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  d: number,
  h: number,
  color: string,
  options: { topColor?: string; alpha?: number } = {},
): void {
  // Semiejes de la base en pantalla. Un desplazamiento de (dx, dy) baldosas
  // equivale a ((dx - dy) * TILE_W/2, (dx + dy) * TILE_H/2) píxeles, así que
  // media anchura y media profundidad aportan a las dos coordenadas.
  const hw = (TILE_W / 2) * (w / 2);
  const hd = (TILE_W / 2) * (d / 2);
  const vw = (TILE_H / 2) * (w / 2);
  const vd = (TILE_H / 2) * (d / 2);

  // Esquinas de la base, en el orden norte, este, sur, oeste.
  const north: [number, number] = [cx - hw + hd, cy - vw - vd];
  const east: [number, number] = [cx + hw + hd, cy + vw - vd];
  const south: [number, number] = [cx + hw - hd, cy + vw + vd];
  const west: [number, number] = [cx - hw - hd, cy - vw + vd];

  const lift = (p: [number, number]): [number, number] => [p[0], p[1] - h];

  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;

  // Cara frontal derecha (mira al este).
  ctx.fillStyle = shade(color, -0.22);
  quad(ctx, [lift(east), lift(south), south, east]);
  ctx.fill();

  // Cara frontal izquierda (mira al oeste).
  ctx.fillStyle = shade(color, -0.4);
  quad(ctx, [lift(west), lift(south), south, west]);
  ctx.fill();

  // Tapa.
  ctx.fillStyle = options.topColor ?? shade(color, 0.08);
  quad(ctx, [lift(north), lift(east), lift(south), lift(west)]);
  ctx.fill();

  if (options.alpha !== undefined) ctx.globalAlpha = 1;
}

/** Altura en píxeles de un nivel del mapa. */
export const LEVEL_PX = HEIGHT_STEP;
