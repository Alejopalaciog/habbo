import './style.css';

import { boot } from './game';
import { Net } from './net';

/** En desarrollo Vite hace de proxy de /ws hacia el servidor de juego. */
function websocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

boot(new Net(websocketUrl()));
