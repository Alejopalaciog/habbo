import { DIR_VECTORS } from '../shared/iso';
import type { ServerMessage } from '../shared/protocol';
import type { Direction, FurniKind, Point } from '../shared/types';
import { Renderer } from './render/Renderer';
import { mountMarkup } from './markup';
import { GameState } from './state';
import type { Transport } from './transport';
import {
  appendChat,
  el,
  renderFurniList,
  renderRoomList,
  renderUserList,
  setStatus,
  setupLogin,
} from './ui';

const state = new GameState();

/** Canal con el servidor; lo fija `boot`. */
let net: Transport;

let buildKind: FurniKind | null = null;
let hover: Point | null = null;
let currentRoomId: string | null = null;
let renderer: Renderer | null = null;

/* ------------------------------------------------------------------ */
/* Entrada al juego                                                    */
/* ------------------------------------------------------------------ */

/**
 * Pone en marcha el cliente sobre el canal que se le pase.
 * Muestra la pantalla de entrada y, al aceptar, conecta y arranca el juego.
 */
export function boot(transport: Transport): void {
  net = transport;
  mountMarkup();
  setupLogin((name, look) => {
    el<HTMLDivElement>('login').hidden = true;
    el<HTMLElement>('game').hidden = false;

    startGame();
    net.remember({ t: 'hello', name, look });
    net.onStatus((status) => setStatus(status));
    net.onMessage(handleMessage);
    net.connect();
  });
}

function startGame(): void {
  const canvas = el<HTMLCanvasElement>('stage');
  renderer = new Renderer(canvas, state);
  bindCanvas(canvas, renderer);
  bindHud();
  window.addEventListener('resize', () => renderer?.resize());
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ */
/* Mensajes del servidor                                               */
/* ------------------------------------------------------------------ */

function handleMessage(message: ServerMessage): void {
  switch (message.t) {
    case 'welcome': {
      state.youId = message.youId;
      state.yourName = message.name;
      state.rooms = message.rooms;
      refreshRoomList();
      // Al conectar (o reconectar) entramos en la última sala visitada.
      const target = currentRoomId ?? message.rooms[0]?.id;
      if (target) joinRoom(target);
      break;
    }

    case 'room': {
      currentRoomId = message.room.id;
      state.setRoom(message.room, message.avatars, message.furni);
      el<HTMLElement>('room-name').textContent = message.room.name;
      el<HTMLElement>('room-desc').textContent = message.room.description;
      el<HTMLDivElement>('chat-log').replaceChildren();
      for (const line of message.history) {
        appendChat(line.id === 'sistema' ? 'system' : 'said', line.name, line.text);
      }
      renderer?.centerOnRoom();
      refreshRoomList();
      renderUserList(state.avatars.values(), state.youId);
      break;
    }

    case 'rooms':
      state.rooms = message.rooms;
      refreshRoomList();
      break;

    case 'avatar_enter':
      state.addAvatar(message.avatar);
      renderUserList(state.avatars.values(), state.youId);
      break;

    case 'avatar_leave': {
      const leaving = state.avatars.get(message.id);
      state.avatars.delete(message.id);
      if (leaving) appendChat('system', 'Hotel', `${leaving.name} se ha ido.`);
      renderUserList(state.avatars.values(), state.youId);
      break;
    }

    case 'avatar_walk': {
      const avatar = state.avatars.get(message.id);
      if (avatar) {
        avatar.walk = { from: message.from, path: message.path, startedAt: message.startedAt };
        avatar.sitting = false;
      }
      break;
    }

    case 'avatar_update': {
      const avatar = state.avatars.get(message.id);
      if (!avatar) break;
      if (message.x !== undefined) avatar.x = message.x;
      if (message.y !== undefined) avatar.y = message.y;
      if (message.h !== undefined) avatar.h = message.h;
      if (message.dir !== undefined) avatar.dir = message.dir;
      if (message.sitting !== undefined) avatar.sitting = message.sitting;
      // Una posición fijada cierra la animación de camino en curso.
      if (message.x !== undefined && message.y !== undefined) avatar.walk = null;
      break;
    }

    case 'chat':
      state.pushChat(message.line);
      appendChat(message.line.id === 'sistema' ? 'system' : 'said', message.line.name, message.line.text);
      break;

    case 'gesture': {
      const avatar = state.avatars.get(message.id);
      if (avatar) {
        avatar.gestureKind = message.kind;
        avatar.gestureUntil = net.now() + (message.kind === 'wave' ? 2200 : 6000);
      }
      break;
    }

    case 'furni_add':
      state.furni.push(message.furni);
      break;

    case 'furni_update':
      state.furni = state.furni.map((f) => (f.id === message.furni.id ? message.furni : f));
      break;

    case 'furni_remove':
      state.furni = state.furni.filter((f) => f.id !== message.id);
      break;

    case 'notice':
      appendChat('notice', 'Hotel', message.text);
      break;

    default:
      break;
  }
}

function joinRoom(roomId: string): void {
  net.remember({ t: 'join', roomId });
  net.send({ t: 'join', roomId });
}

function refreshRoomList(): void {
  renderRoomList(state.rooms, currentRoomId, joinRoom);
}

/* ------------------------------------------------------------------ */
/* Interacción con el escenario                                        */
/* ------------------------------------------------------------------ */

function bindCanvas(canvas: HTMLCanvasElement, view: Renderer): void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    if (dragging) {
      view.pan(px - lastX, py - lastY);
      lastX = px;
      lastY = py;
      return;
    }
    hover = view.pickTile(px, py);
  });

  canvas.addEventListener('mouseleave', () => {
    hover = null;
    dragging = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    // Botón central o Mayúsculas: arrastrar la cámara.
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      dragging = true;
      lastX = px;
      lastY = py;
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (event.button !== 0) return;

    const tile = view.pickTile(px, py);
    if (!tile) return;
    onTileClick(tile);
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'pointer';
  });

  // Clic derecho: quitar el mueble de la baldosa (solo en modo construcción).
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (!buildKind) return;
    const rect = canvas.getBoundingClientRect();
    const tile = view.pickTile(event.clientX - rect.left, event.clientY - rect.top);
    if (!tile) return;
    const furni = state.furniAt(tile.x, tile.y);
    if (furni) net.send({ t: 'furni_remove', id: furni.id });
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      view.zoomBy(
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    { passive: false },
  );

  // Táctil: un toque camina, arrastrar mueve la cámara.
  let touchMoved = false;
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    touchMoved = false;
  });
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    if (Math.abs(px - lastX) + Math.abs(py - lastY) > 6) touchMoved = true;
    view.pan(px - lastX, py - lastY);
    lastX = px;
    lastY = py;
  });
  canvas.addEventListener('touchend', () => {
    if (touchMoved) return;
    const tile = view.pickTile(lastX, lastY);
    if (tile) onTileClick(tile);
  });
}

function onTileClick(tile: Point): void {
  if (buildKind) {
    const existing = state.furniAt(tile.x, tile.y);
    if (existing) {
      net.send({ t: 'furni_rotate', id: existing.id });
    } else {
      net.send({ t: 'furni_place', kind: buildKind, x: tile.x, y: tile.y, dir: 4 });
    }
    return;
  }
  net.send({ t: 'walk', x: tile.x, y: tile.y });
}

/* ------------------------------------------------------------------ */
/* HUD y teclado                                                       */
/* ------------------------------------------------------------------ */

function bindHud(): void {
  const roomsPanel = el<HTMLElement>('rooms-panel');
  const buildPanel = el<HTMLElement>('build-panel');
  const roomsButton = el<HTMLButtonElement>('toggle-rooms');
  const buildButton = el<HTMLButtonElement>('toggle-build');

  roomsButton.addEventListener('click', () => {
    roomsPanel.hidden = !roomsPanel.hidden;
    roomsButton.classList.toggle('active', !roomsPanel.hidden);
    if (!roomsPanel.hidden) buildPanel.hidden = true;
  });

  const setBuildMode = (on: boolean) => {
    buildPanel.hidden = !on;
    buildButton.classList.toggle('active', on);
    buildKind = on ? buildKind ?? 'silla' : null;
    if (on) {
      roomsPanel.hidden = true;
      renderFurniList(buildKind, selectFurni);
    }
  };
  buildButton.addEventListener('click', () => setBuildMode(buildPanel.hidden));
  el<HTMLButtonElement>('build-off').addEventListener('click', () => setBuildMode(false));

  const chatForm = el<HTMLFormElement>('chat-form');
  const chatInput = el<HTMLInputElement>('chat-input');
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    chatInput.value = '';
    if (text) runChat(text);
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-gesture]')) {
    button.addEventListener('click', () => {
      const kind = button.dataset.gesture === 'dance' ? 'dance' : 'wave';
      net.send({ t: 'gesture', kind });
    });
  }

  window.addEventListener('keydown', (event) => {
    const typing = document.activeElement === chatInput;
    if (event.key === 'Enter' && !typing) {
      chatInput.focus();
      return;
    }
    if (event.key === 'Escape') {
      chatInput.blur();
      return;
    }
    if (typing) return;

    const step = ARROW_DIRS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      walkRelative(step);
    }
  });
}

function selectFurni(kind: FurniKind): void {
  buildKind = kind;
  renderFurniList(kind, selectFurni);
}

/** Caminar una baldosa en una dirección, con las flechas del teclado. */
const ARROW_DIRS: Record<string, Direction | undefined> = {
  ArrowUp: 0,
  ArrowRight: 2,
  ArrowDown: 4,
  ArrowLeft: 6,
  w: 0,
  d: 2,
  s: 4,
  a: 6,
  W: 0,
  D: 2,
  S: 4,
  A: 6,
};

function walkRelative(dir: Direction): void {
  const you = state.you;
  if (!you) return;
  // Se parte de la baldosa a la que ya se dirige, para poder encadenar pasos.
  const base = you.walk && you.walk.path.length > 0 ? you.walk.path[you.walk.path.length - 1]! : you;
  const vector = DIR_VECTORS[dir]!;
  net.send({ t: 'walk', x: base.x + vector.x, y: base.y + vector.y });
}

/* ------------------------------------------------------------------ */
/* Comandos de chat                                                    */
/* ------------------------------------------------------------------ */

function runChat(text: string): void {
  if (!text.startsWith('/')) {
    net.send({ t: 'chat', text });
    return;
  }

  const [command, ...rest] = text.slice(1).split(' ');
  const argument = rest.join(' ').trim();

  switch ((command ?? '').toLowerCase()) {
    case 'ayuda':
      appendChat('notice', 'Hotel', 'Comandos: /saludo · /baile · /sala <id> · /salas · /centrar · /limpiar');
      break;
    case 'saludo':
      net.send({ t: 'gesture', kind: 'wave' });
      break;
    case 'baile':
      net.send({ t: 'gesture', kind: 'dance' });
      break;
    case 'sala':
      if (argument) joinRoom(argument);
      else appendChat('notice', 'Hotel', 'Uso: /sala <id>');
      break;
    case 'salas':
      appendChat('notice', 'Hotel', `Salas: ${state.rooms.map((r) => r.id).join(', ')}`);
      break;
    case 'centrar':
      renderer?.centerOnRoom();
      break;
    case 'limpiar':
      el<HTMLDivElement>('chat-log').replaceChildren();
      break;
    default:
      appendChat('notice', 'Hotel', `No conozco el comando "/${command}". Prueba /ayuda.`);
  }
}

/* ------------------------------------------------------------------ */
/* Bucle de dibujado                                                   */
/* ------------------------------------------------------------------ */

let lastUserListUpdate = 0;

function loop(): void {
  const serverNow = net.now();
  renderer?.draw({ serverNow, hover, buildKind });

  // La lista de usuarios solo cambia de vez en cuando: no hace falta
  // reconstruirla en cada fotograma.
  if (serverNow - lastUserListUpdate > 1000) {
    lastUserListUpdate = serverNow;
    renderUserList(state.avatars.values(), state.youId);
  }

  requestAnimationFrame(loop);
}
