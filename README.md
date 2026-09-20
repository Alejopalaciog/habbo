# Hotel — juego social isométrico multijugador

Un juego social al estilo Habbo Hotel: salas isométricas, avatares que caminan
con búsqueda de caminos, chat con bocadillos y muebles que puedes colocar.
Servidor autoritativo en Node + WebSockets, cliente en TypeScript sobre Canvas 2D.

Todo el arte es **procedural y original**: los avatares, los muebles y las salas
se dibujan con geometría en tiempo de ejecución. No se usa ningún recurso de
Habbo Hotel, que es una marca y un juego propiedad de Sulake.

## Cómo jugarlo

```bash
npm install
npm run dev
```

Abre <http://localhost:5173> y elige un nombre. Para probar el multijugador,
abre una segunda pestaña (o una ventana de incógnito) con otro nombre.

### Probarlo sin montar nada

```bash
npm run build:demo     # genera dist-single/hotel.html
```

Ese archivo se abre con doble clic en cualquier navegador, sin servidor ni
instalación. Dentro corre el mismo hotel del servidor, pero en la propia
pestaña, acompañado de tres vecinos controlados por el ordenador que caminan y
charlan. Es la manera rápida de enseñar el juego o de trastear con el
renderizador.

## Controles

| Acción | Cómo |
| --- | --- |
| Caminar | Clic en una baldosa |
| Caminar un paso | Flechas o `WASD` |
| Sentarse | Camina hasta una silla o un sofá |
| Hablar | Escribe abajo y pulsa Intro (`Intro` con el foco fuera enfoca el chat) |
| Mover la cámara | Arrastrar con el botón central, o `Mayús` + arrastrar |
| Zoom | Rueda del ratón |
| Construir | Botón «Construir»: clic coloca, clic en un mueble lo gira, clic derecho lo quita |

Comandos de chat: `/ayuda`, `/saludo`, `/baile`, `/sala <id>`, `/salas`,
`/centrar`, `/limpiar`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de juego + cliente con recarga en caliente |
| `npm run dev:server` | Solo el servidor (puerto 2096) |
| `npm run dev:client` | Solo el cliente (puerto 5173) |
| `npm run typecheck` | Comprobación de tipos |
| `npm test` | Prueba de humo de extremo a extremo contra el servidor |
| `npm run build` | Compila el cliente a `dist/` |
| `npm run build:demo` | Empaqueta la demo en un único `dist-single/hotel.html` |
| `npm start` | Arranca solo el servidor (producción) |

## Cómo está organizado

```
src/
├── shared/      Código que comparten cliente y servidor
│   ├── constants.ts    Medidas de la baldosa, ritmo del paso, límites
│   ├── types.ts        Avatares, muebles y su catálogo
│   ├── iso.ts          Matemática isométrica (baldosa ⇄ pantalla, direcciones)
│   ├── pathfinding.ts  A* sobre la rejilla, con alturas y sin recortar esquinas
│   ├── rooms.ts        Definición de las salas como mapas de texto
│   └── protocol.ts     Todos los mensajes de red, tipados
├── server/
│   ├── index.ts        Arranque
│   ├── Hotel.ts        Las reglas del juego, sin saber nada de red
│   ├── GameServer.ts   Adaptador de WebSockets sobre el Hotel
│   └── Room.ts         Simulación autoritativa de una sala
├── client/
│   ├── main.ts         Entrada del cliente normal
│   ├── game.ts         Interacción y bucle de dibujado
│   ├── transport.ts    El canal con el servidor, como interfaz
│   ├── net.ts          WebSocket, reconexión y sincronía de relojes
│   ├── state.ts        Estado local e interpolación del movimiento
│   ├── markup.ts       La interfaz en HTML, compartida por las dos entradas
│   ├── ui.ts           Login, HUD, listas y chat
│   └── render/         Renderizador isométrico y arte procedural
└── demo/               La versión sin servidor: hotel en la pestaña + bots
```

## Cómo funciona por dentro

**Las reglas no saben de red.** `Hotel` contiene el juego entero —salas,
jugadores, validación— y solo habla mediante mensajes. `GameServer` le enchufa
WebSockets y la demo le enchufa llamadas directas dentro del navegador. Por eso
la demo no es una maqueta: es el mismo servidor, sin cable de por medio.

**El servidor manda.** El cliente nunca decide dónde está su avatar: pide
«quiero ir a la baldosa (x, y)» y el servidor calcula el camino, comprueba que
sea posible y lo difunde a toda la sala. Así nadie puede atravesar paredes ni
teletransportarse tocando el código del navegador.

**El movimiento se envía una sola vez.** En lugar de mandar posiciones cada
fotograma, el servidor envía el camino completo con la marca de tiempo de
salida. Cada cliente reproduce esa animación gastando `STEP_MS` por baldosa.
Como el cliente mide el desfase de relojes con el ida y vuelta del *ping*, todos
los jugadores ven el mismo movimiento aunque tengan latencias distintas.

**Las salas son texto.** Cada sala es una lista de cadenas donde `x` es vacío,
`D` es la puerta y los dígitos son la altura del suelo. Añadir una sala nueva es
escribir un mapa en `src/shared/rooms.ts`:

```ts
map: [
  'xxxxxx',
  'x0000x',
  'x0110x',   // 1 = un nivel más alto
  'D0000x',   // D = puerta
  'xxxxxx',
],
```

El buscador de caminos deja subir o bajar un nivel entre baldosas contiguas,
pero no en diagonal, que es lo que hace que las escaleras se vean bien.

**El dibujo va por niveles.** El suelo se pinta agrupado por altura y, dentro de
cada altura, de atrás hacia delante. Pintar los niveles altos al final es lo que
hace que el escalón de una plataforma tape correctamente el suelo que tiene
delante. Los avatares y los muebles se ordenan después por profundidad (`x + y`).

## Ideas para seguir

- Persistir los muebles y los perfiles (ahora todo vive en memoria).
- Salas creadas por los jugadores, con permisos de quién puede construir.
- Inventario y catálogo con monedas, en vez de muebles infinitos.
- Susurros, amigos y lista de ignorados.
- Más gestos y animaciones (sentarse en el suelo, tumbarse, dormir).

## Licencia

Código propio, sin recursos de terceros. Úsalo como quieras.
