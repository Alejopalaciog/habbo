import '../client/style.css';

import { boot } from '../client/game';
import { Hotel } from '../server/Hotel';
import type { AvatarLook } from '../shared/types';
import { Bot } from './Bot';
import { LocalTransport } from './LocalTransport';

/**
 * Demo sin servidor.
 *
 * Arranca un `Hotel` completo dentro de la pestaña y lo puebla con vecinos
 * controlados por el ordenador, para poder probar el juego con un solo archivo
 * y sin instalar nada. El código del juego es exactamente el mismo que usa el
 * servidor de verdad; lo único que cambia es el canal.
 */
const hotel = new Hotel();
hotel.start();

const look = (
  skin: string,
  hair: string,
  shirt: string,
  pants: string,
  shoes: string,
): AvatarLook => ({ skin, hair, shirt, pants, shoes });

const VECINOS = [
  {
    name: 'Rita',
    roomId: 'lobby',
    look: look('#d9a072', '#2f4b7c', '#d65b4a', '#2f3a4a', '#1d2330'),
    lines: [
      '¿Alguien sabe si el escenario es para bailar?',
      'Me pido el sofá de la izquierda',
      'Buenas 👋',
      'El tocadiscos lleva puesta la misma canción desde ayer',
    ],
  },
  {
    name: 'Nico',
    roomId: 'lobby',
    look: look('#8a5a36', '#2a1e16', '#3fb27f', '#5f7a3c', '#3a2a20'),
    lines: [
      'Voy a la terraza, que hay vistas',
      '¿Habéis probado a girar los muebles?',
      'Esta planta la puse yo',
      'Hoy el lobby está tranquilo',
    ],
  },
  {
    name: 'Téo',
    roomId: 'lobby',
    look: look('#f7d9bd', '#c98a3c', '#8b5fd6', '#2f3a4a', '#f0f0f0'),
    lines: [
      'Bienvenido al hotel 🎉',
      'Pulsa "Construir" y monta tu propia sala',
      'Yo me siento, que llevo todo el día andando',
      '¿Echamos un baile?',
    ],
  },
] as const;

const bots = VECINOS.map((vecino) => new Bot(hotel, vecino));
bots.forEach((bot, index) => bot.start(900 + index * 700));

boot(new LocalTransport(hotel));
