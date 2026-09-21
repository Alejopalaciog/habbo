import { SERVER_PORT } from '../shared/constants';
import { GameServer } from './GameServer';

const port = Number(process.env.PORT ?? SERVER_PORT);
const server = new GameServer({ port });

console.log(`🏨 Servidor de juego escuchando en ws://localhost:${port}/ws`);
console.log('   Abre el cliente con: npm run dev:client');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log('\nCerrando el hotel...');
    server.close();
    process.exit(0);
  });
}
