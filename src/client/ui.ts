import { FURNI, type AvatarLook, type FurniKind, type RoomSummary } from '../shared/types';
import { drawAvatar } from './render/avatar';
import { colorFromString } from './render/colors';
import type { ClientAvatar } from './state';
import type { ConnectionStatus } from './transport';

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el elemento #${id} en el HTML.`);
  return node as T;
}

const LOOK_PARTS: (keyof AvatarLook)[] = ['skin', 'hair', 'shirt', 'pants', 'shoes'];

const SKINS = ['#f7d9bd', '#f2c9a0', '#d9a072', '#b07a4f', '#8a5a36', '#5f3d24'];
const HAIRS = ['#2a1e16', '#4a3524', '#8c5a2b', '#c98a3c', '#e0d5c0', '#7a3b52', '#2f4b7c'];
const CLOTHES = [
  '#3f7fd6', '#d65b4a', '#3fb27f', '#e0a83c', '#8b5fd6',
  '#e07aa8', '#2f3a4a', '#4ab5c9', '#c9483f', '#5f7a3c',
];

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

export function randomLook(): AvatarLook {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    shirt: pick(CLOTHES),
    pants: pick(CLOTHES),
    shoes: pick(['#1d2330', '#3a2a20', '#f0f0f0', '#7a2b2b']),
  };
}

/* ------------------------------------------------------------------ */
/* Pantalla de entrada                                                 */
/* ------------------------------------------------------------------ */

export function setupLogin(onSubmit: (name: string, look: AvatarLook) => void): void {
  const form = el<HTMLFormElement>('login-form');
  const nameInput = el<HTMLInputElement>('name-input');
  const errorNode = el<HTMLParagraphElement>('login-error');
  const preview = el<HTMLCanvasElement>('look-preview');
  const ctx = preview.getContext('2d');

  // Se recuerda el último aspecto usado para no tener que repetirlo.
  const saved = loadProfile();
  let look: AvatarLook = saved?.look ?? randomLook();
  nameInput.value = saved?.name ?? '';

  const inputs = new Map<keyof AvatarLook, HTMLInputElement>();
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-part]')) {
    const part = input.dataset.part as keyof AvatarLook;
    inputs.set(part, input);
    input.addEventListener('input', () => {
      look = { ...look, [part]: input.value };
      redraw();
    });
  }

  let frame = 0;
  function redraw(): void {
    for (const part of LOOK_PARTS) {
      const input = inputs.get(part);
      if (input) input.value = look[part];
    }
    if (!ctx) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.save();
    ctx.translate(preview.width / 2, preview.height - 26);
    ctx.scale(1.5, 1.5);
    // El avatar de la vista previa gira despacio para verlo por todos los lados.
    const dir = (Math.floor(frame / 60) % 8) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    drawAvatar(ctx, 0, 0, {
      look,
      dir,
      walkPhase: null,
      sitting: false,
      gesture: null,
      time: performance.now(),
    });
    ctx.restore();
  }

  function loop(): void {
    frame++;
    redraw();
    if (!el<HTMLDivElement>('login').hidden) requestAnimationFrame(loop);
  }
  loop();

  el<HTMLButtonElement>('randomize').addEventListener('click', () => {
    look = randomLook();
    redraw();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) {
      errorNode.hidden = false;
      errorNode.textContent = 'El nombre necesita al menos 2 caracteres.';
      return;
    }
    errorNode.hidden = true;
    saveProfile(name, look);
    onSubmit(name, look);
  });
}

interface Profile {
  name: string;
  look: AvatarLook;
}

const STORAGE_KEY = 'hotel:perfil';

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (typeof parsed?.name !== 'string' || typeof parsed?.look !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProfile(name: string, look: AvatarLook): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, look }));
  } catch {
    // Navegar en privado o sin almacenamiento no debe romper el juego.
  }
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

export function setStatus(status: ConnectionStatus): void {
  const badge = el<HTMLSpanElement>('status');
  badge.textContent = status;
  badge.classList.toggle('ok', status === 'conectado');
  badge.classList.toggle('warn', status === 'reconectando' || status === 'conectando');
}

export function renderRoomList(
  rooms: readonly RoomSummary[],
  currentId: string | null,
  onJoin: (id: string) => void,
): void {
  const list = el<HTMLUListElement>('room-list');
  list.replaceChildren(
    ...rooms.map((room) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = room.id === currentId ? 'current' : '';
      const name = document.createElement('span');
      name.textContent = room.name;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `${room.users}/${room.capacity}`;
      button.append(name, count);
      button.addEventListener('click', () => onJoin(room.id));
      const item = document.createElement('li');
      item.append(button);
      return item;
    }),
  );
}

export function renderUserList(avatars: Iterable<ClientAvatar>, youId: string): void {
  const list = el<HTMLUListElement>('user-list');
  const sorted = [...avatars].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  list.replaceChildren(
    ...sorted.map((avatar) => {
      const item = document.createElement('li');
      item.className = 'user';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = avatar.look.shirt;
      const name = document.createElement('span');
      name.textContent = avatar.id === youId ? `${avatar.name} (tú)` : avatar.name;
      item.append(dot, name);
      return item;
    }),
  );
}

export function renderFurniList(
  selected: FurniKind | null,
  onSelect: (kind: FurniKind) => void,
): void {
  const list = el<HTMLUListElement>('furni-list');
  list.replaceChildren(
    ...Object.values(FURNI).map((def) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = def.kind === selected ? 'current' : '';
      const name = document.createElement('span');
      name.textContent = def.label;
      const tag = document.createElement('span');
      tag.className = 'count';
      tag.textContent = def.sittable ? 'para sentarse' : def.walkable ? 'se pisa' : '';
      button.append(name, tag);
      button.addEventListener('click', () => onSelect(def.kind));
      const item = document.createElement('li');
      item.append(button);
      return item;
    }),
  );
}

export type ChatKind = 'said' | 'system' | 'notice';

export function appendChat(kind: ChatKind, who: string, text: string): void {
  const log = el<HTMLDivElement>('chat-log');
  const line = document.createElement('div');
  line.className = `line ${kind === 'said' ? '' : kind}`.trim();

  if (kind === 'said') {
    const name = document.createElement('span');
    name.className = 'who';
    name.style.color = colorFromString(who, 60, 72);
    name.textContent = `${who}:`;
    line.append(name, document.createTextNode(text));
  } else {
    line.textContent = text;
  }

  log.append(line);
  while (log.childElementCount > 80) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
}
