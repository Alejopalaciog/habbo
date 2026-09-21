import type { AvatarLook, Direction, GestureKind } from '../../shared/types';
import { shade } from './colors';

export interface AvatarDrawState {
  look: AvatarLook;
  dir: Direction;
  /** Progreso del paso actual (0..1) si está caminando, o null si está quieto. */
  walkPhase: number | null;
  sitting: boolean;
  gesture: GestureKind | null;
  /** Reloj en milisegundos, para las animaciones cíclicas. */
  time: number;
}

/** Alto total del avatar en píxeles: sirve para colocar bocadillos y nombres. */
export const AVATAR_HEIGHT = 62;

/** ¿Vemos la cara del avatar o su espalda? */
function facesCamera(dir: Direction): boolean {
  return dir >= 2 && dir <= 5;
}

/** -1 mira hacia la izquierda de la pantalla, +1 a la derecha, 0 de frente. */
function lateral(dir: Direction): number {
  if (dir === 1 || dir === 2 || dir === 3) return 1;
  if (dir === 5 || dir === 6 || dir === 7) return -1;
  return 0;
}

/** En las direcciones puras de lado el cuerpo se ve más estrecho. */
function bodyWidth(dir: Direction): number {
  return dir === 2 || dir === 6 ? 0.72 : 1;
}

/**
 * Dibuja un avatar con los pies apoyados en (cx, cy).
 * Todo es geometría: no hay imágenes ni sprites de ningún tipo.
 */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  state: AvatarDrawState,
): void {
  const { look, dir } = state;
  const front = facesCamera(dir);
  const side = lateral(dir);
  const narrow = bodyWidth(dir);

  const walking = state.walkPhase !== null;
  const phase = state.walkPhase ?? 0;
  // Un ciclo completo de piernas cada dos baldosas.
  const swing = walking ? Math.sin(phase * Math.PI * 2) : 0;
  const bob = walking ? Math.abs(Math.sin(phase * Math.PI * 2)) * -1.5 : 0;

  const dancing = state.gesture === 'dance';
  const danceBeat = dancing ? Math.sin(state.time / 130) : 0;
  const danceBob = dancing ? Math.abs(Math.sin(state.time / 130)) * -3 : 0;

  const sit = state.sitting ? 12 : 0;
  const baseY = cy + sit + bob + danceBob;

  ctx.save();

  // Sombra en el suelo.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 13, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  /* --- Piernas ------------------------------------------------------ */
  const legW = 6.5 * narrow;
  const hipY = baseY - 22;
  const legColor = look.pants;

  if (state.sitting) {
    // Sentado: muslos hacia delante y espinillas hacia abajo.
    const knee = side === 0 ? 7 : 8 * (side || 1);
    drawLimb(ctx, cx - 4, hipY, cx - 4 + knee, hipY + 3, legW, legColor);
    drawLimb(ctx, cx + 4, hipY, cx + 4 + knee, hipY + 3, legW, legColor);
    drawLimb(ctx, cx - 4 + knee, hipY + 3, cx - 4 + knee, baseY - 2, legW - 1, legColor);
    drawLimb(ctx, cx + 4 + knee, hipY + 3, cx + 4 + knee, baseY - 2, legW - 1, legColor);
    drawShoe(ctx, cx - 4 + knee, baseY - 1, look.shoes, side);
    drawShoe(ctx, cx + 4 + knee, baseY - 1, look.shoes, side);
  } else {
    const spread = walking ? swing * 5 : 2.2;
    const lift = walking ? Math.max(0, swing) * 2 : 0;
    drawLimb(ctx, cx - 2, hipY, cx - spread - 1, baseY - 3 - lift, legW, legColor);
    drawLimb(ctx, cx + 2, hipY, cx + spread + 1, baseY - 3, legW, legColor);
    drawShoe(ctx, cx - spread - 1, baseY - 2 - lift, look.shoes, side);
    drawShoe(ctx, cx + spread + 1, baseY - 2, look.shoes, side);
  }

  /* --- Torso -------------------------------------------------------- */
  const torsoTop = baseY - 40;
  const torsoBottom = hipY + 1;
  const torsoW = 19 * narrow;
  ctx.fillStyle = look.shirt;
  roundRect(ctx, cx - torsoW / 2, torsoTop, torsoW, torsoBottom - torsoTop, 5);
  ctx.fill();
  // Un sombreado lateral da volumen sin necesidad de degradados.
  ctx.fillStyle = shade(look.shirt, -0.18);
  roundRect(ctx, cx + torsoW / 2 - 4, torsoTop, 4, torsoBottom - torsoTop, 3);
  ctx.fill();
  if (front) {
    // Cuello de la camiseta.
    ctx.fillStyle = shade(look.shirt, -0.28);
    ctx.beginPath();
    ctx.ellipse(cx, torsoTop + 1.5, 4.5 * narrow, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --- Brazos ------------------------------------------------------- */
  const shoulderY = torsoTop + 4;
  const armW = 5 * narrow;
  const waving = state.gesture === 'wave';
  const waveArm = waving ? Math.sin(state.time / 90) * 5 : 0;

  const armSpread = torsoW / 2 + 1;
  const leftHandY = baseY - 20 + (walking ? -swing * 3 : 0) + (dancing ? danceBeat * -5 : 0);
  const rightHandY = baseY - 20 + (walking ? swing * 3 : 0) + (dancing ? -danceBeat * -5 : 0);

  ctx.fillStyle = look.shirt;
  if (waving) {
    // Brazo derecho en alto, saludando.
    drawLimb(ctx, cx - armSpread, shoulderY, cx - armSpread - 2, leftHandY, armW, look.shirt);
    drawLimb(ctx, cx + armSpread, shoulderY, cx + armSpread + 5 + waveArm, torsoTop - 12, armW, look.shirt);
    drawHand(ctx, cx + armSpread + 5 + waveArm, torsoTop - 13, look.skin);
    drawHand(ctx, cx - armSpread - 2, leftHandY, look.skin);
  } else {
    drawLimb(ctx, cx - armSpread, shoulderY, cx - armSpread - 1, leftHandY, armW, look.shirt);
    drawLimb(ctx, cx + armSpread, shoulderY, cx + armSpread + 1, rightHandY, armW, look.shirt);
    drawHand(ctx, cx - armSpread - 1, leftHandY, look.skin);
    drawHand(ctx, cx + armSpread + 1, rightHandY, look.skin);
  }

  /* --- Cabeza ------------------------------------------------------- */
  const headR = 10.5;
  const headY = torsoTop - headR + 1;
  const headX = cx + side * 1.5;

  // Cuello.
  ctx.fillStyle = shade(look.skin, -0.2);
  ctx.fillRect(cx - 3, torsoTop - 4, 6, 5);

  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.ellipse(headX, headY, headR, headR * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pelo: una capucha que tapa más por detrás que por delante.
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (front) {
    ctx.ellipse(headX, headY - 2.5, headR + 0.5, headR * 0.92, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Flequillo.
    ctx.beginPath();
    ctx.ellipse(headX - side * 2, headY - 3, headR * 0.85, 4.5, 0, 0, Math.PI);
    ctx.fill();
  } else {
    ctx.ellipse(headX, headY - 1, headR + 0.8, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cara, solo si nos mira.
  if (front) {
    const eyeY = headY + 1.5;
    const eyeDx = dir === 2 || dir === 6 ? 2.5 : 3.6;
    ctx.fillStyle = '#26303d';
    for (const sign of dir === 2 ? [1] : dir === 6 ? [-1] : [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(headX + sign * eyeDx + side * 1.2, eyeY, 1.4, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = shade(look.skin, -0.45);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(headX + side * 1.2, eyeY + 4.2, 2.6, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

/** Segmento redondeado: la base de brazos y piernas. */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, skin: string): void {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawShoe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  side: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + side * 1.5, y, 4.6, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
