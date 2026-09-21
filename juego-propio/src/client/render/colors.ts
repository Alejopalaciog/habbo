/** Utilidades de color: todo el arte del juego se dibuja a mano, sin sprites. */

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Lee un color en formato `#rgb`, `#rrggbb` o `rgb(r, g, b)`.
 *
 * Acepta la salida de `shade` para poder encadenar sombreados: los muebles
 * pasan colores ya oscurecidos a otros ayudantes de dibujo.
 */
function parse(color: string): [number, number, number] {
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgb) {
    const parts = rgb[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    return [clamp(parts[0] ?? 0), clamp(parts[1] ?? 0), clamp(parts[2] ?? 0)];
  }
  const clean = color.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color. amount en [-1, 1]. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number) => clamp(channel + (target - channel) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Color estable a partir de un texto: se usa para los colores por defecto. */
export function colorFromString(text: string, saturation = 65, lightness = 55): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, ${saturation}%, ${lightness}%)`;
}
