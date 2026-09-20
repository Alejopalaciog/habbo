/** Prueba de humo: dos clientes entran, caminan, se sientan y chatean. */
import WebSocket from 'ws';
import { GameServer } from '../src/server/GameServer';

const PORT = 2199;
const server = new GameServer({ port: PORT });

interface Log { name: string; messages: any[] }

function client(name: string): Promise<{ ws: WebSocket; log: Log }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const log: Log = { name, messages: [] };
    ws.on('message', (d) => log.messages.push(JSON.parse(String(d))));
    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'hello', name, look: { skin: '#f2c9a0', hair: '#3b2a20', shirt: '#3f7fd6', pants: '#2f3a4a', shoes: '#1d2330' } }));
      ws.send(JSON.stringify({ t: 'join', roomId: 'lobby' }));
      resolve({ ws, log });
    });
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const types = (log: Log) => log.messages.map((m) => m.t);

(async () => {
  const a = await client('Ana');
  await wait(120);
  const b = await client('Bruno');
  await wait(180);

  console.log('A recibe tras entrar:', types(a.log).join(', '));
  const roomMsg = a.log.messages.find((m) => m.t === 'room');
  console.log('Sala:', roomMsg.room.name, '| muebles:', roomMsg.furni.length, '| avatares iniciales:', roomMsg.avatars.length);
  console.log('A ve entrar a alguien:', a.log.messages.some((m) => m.t === 'avatar_enter'));

  // Caminar a una baldosa lejana y esperar la llegada.
  a.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'walk', x: 9, y: 2 }));
  await wait(200);
  const walk = a.log.messages.find((m) => m.t === 'avatar_walk');
  console.log('Camino calculado:', walk ? `${walk.path.length} baldosas hacia (${walk.path.at(-1).x},${walk.path.at(-1).y})` : 'NINGUNO');

  await wait(walk ? walk.path.length * 430 + 400 : 100);
  const arrival = a.log.messages.filter((m) => m.t === 'avatar_update').at(-1);
  console.log('Llegada:', arrival ? `(${arrival.x},${arrival.y}) h=${arrival.h} sentado=${arrival.sitting}` : 'SIN AVISO');

  // Subir al escenario elevado (altura 1) para probar el cambio de nivel.
  a.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'walk', x: 4, y: 4 }));
  await wait(200);
  const climb = a.log.messages.find((m) => m.t === 'avatar_walk');
  console.log('Subida al escenario:', climb ? `alturas ${climb.path.map((p: any) => p.h).join('')}` : 'NINGUNA');
  await wait(climb ? climb.path.length * 430 + 400 : 100);
  const onStage = a.log.messages.filter((m) => m.t === 'avatar_update').at(-1);
  console.log('En el escenario:', onStage ? `(${onStage.x},${onStage.y}) h=${onStage.h}` : 'NO');

  // Sentarse en un sofá.
  a.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'walk', x: 5, y: 8 }));
  await wait(3600);
  const seated = a.log.messages.filter((m) => m.t === 'avatar_update').at(-1);
  console.log('Sofá:', seated ? `(${seated.x},${seated.y}) sentado=${seated.sitting} dir=${seated.dir}` : 'NO');

  // Chat visible para el otro jugador.
  b.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'chat', text: '  hola   a   todos  ' }));
  await wait(150);
  const heard = b.log.messages.find((m) => m.t === 'chat');
  console.log('Bruno oye:', heard ? `"${heard.line.text}" de ${heard.line.name}` : 'NADA');

  // Anti-spam.
  a.ws.send(JSON.stringify({ t: 'chat', text: 'spam' }));
  await wait(150);
  console.log('Anti-spam actúa:', a.log.messages.some((m) => m.t === 'notice'));

  // Colocar, girar y quitar un mueble.
  b.log.messages.length = 0;
  b.ws.send(JSON.stringify({ t: 'furni_place', kind: 'caja', x: 8, y: 6, dir: 4 }));
  await wait(120);
  const added = b.log.messages.find((m) => m.t === 'furni_add');
  console.log('Mueble colocado:', added ? added.furni.id : 'NO');
  b.ws.send(JSON.stringify({ t: 'furni_place', kind: 'caja', x: 8, y: 6, dir: 4 }));
  await wait(120);
  console.log('Rechaza baldosa ocupada:', b.log.messages.some((m) => m.t === 'notice'));
  if (added) {
    b.ws.send(JSON.stringify({ t: 'furni_rotate', id: added.furni.id }));
    await wait(100);
    console.log('Girado a dir:', b.log.messages.find((m) => m.t === 'furni_update')?.furni.dir);
    b.ws.send(JSON.stringify({ t: 'furni_remove', id: added.furni.id }));
    await wait(100);
    console.log('Quitado:', b.log.messages.some((m) => m.t === 'furni_remove'));
  }

  // Camino imposible (baldosa inexistente).
  a.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'walk', x: 0, y: 0 }));
  await wait(150);
  console.log('Baldosa inexistente ignorada:', !a.log.messages.some((m) => m.t === 'avatar_walk'));

  // Cambio de sala.
  a.log.messages.length = 0;
  b.log.messages.length = 0;
  a.ws.send(JSON.stringify({ t: 'join', roomId: 'terraza' }));
  await wait(200);
  console.log('Nueva sala:', a.log.messages.find((m) => m.t === 'room')?.room.name);
  console.log('Bruno ve que se va:', b.log.messages.some((m) => m.t === 'avatar_leave'));

  // Nombre no válido y sala inexistente.
  const c = await client('Z');
  await wait(150);
  console.log('Nombre corto sustituido por:', c.log.messages.find((m) => m.t === 'welcome')?.name.startsWith('Invitado'));
  c.ws.send(JSON.stringify({ t: 'join', roomId: 'no-existe' }));
  await wait(120);
  console.log('Sala inexistente avisa:', c.log.messages.some((m) => m.t === 'notice' && m.text.includes('no existe')));

  // Desconexión.
  b.log.messages.length = 0;
  c.ws.close();
  await wait(200);

  a.ws.close();
  b.ws.close();
  server.close();
  await wait(100);
  process.exit(0);
})();
