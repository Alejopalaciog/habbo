/**
 * Puerto por defecto del servidor de juego (WebSocket).
 * Ojo: este archivo también lo carga el navegador, así que aquí no se puede
 * leer `process.env`; la variable PORT se resuelve en src/server/index.ts.
 */
export const SERVER_PORT = 2096;

/** Ancho de una baldosa en pantalla (el rombo isométrico mide 64x32). */
export const TILE_W = 64;
/** Alto de una baldosa en pantalla. */
export const TILE_H = 32;
/** Píxeles que sube el suelo por cada nivel de altura del mapa. */
export const HEIGHT_STEP = 14;

/** Milisegundos que tarda un avatar en recorrer una baldosa. */
export const STEP_MS = 420;
/** Frecuencia del bucle de simulación del servidor. */
export const TICK_MS = 50;

/** Cuánto vive un bocadillo de chat en pantalla. */
export const CHAT_BUBBLE_MS = 6500;
/** Cuántos mensajes conserva el historial de la sala. */
export const CHAT_HISTORY = 40;

export const MAX_CHAT_LEN = 140;
export const MAX_NAME_LEN = 16;
export const ROOM_CAPACITY = 25;

/** Ritmo máximo de mensajes de chat por jugador (anti-spam). */
export const CHAT_MIN_INTERVAL_MS = 500;
