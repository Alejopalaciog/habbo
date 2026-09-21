# Hotel local — réplica con Arcturus + Nitro

Monta en tu PC un hotel idéntico al original, para uso **privado y local**.
No usa nada de este repositorio: es el ecosistema open source que la comunidad
mantiene desde hace más de una década.

> **Sobre los assets.** El emulador y el cliente son software libre, pero los
> sprites, muebles, sonidos y fuentes son propiedad de Sulake. Se descargan en
> tu máquina al instalar y están excluidos del control de versiones
> (`retro/.gitignore`). No los subas a ningún sitio ni publiques el servidor.

## Qué se instala

| Pieza | Función |
| --- | --- |
| **Arcturus Morningstar** | El emulador del servidor, en Java. Habla el protocolo real |
| **NitroWebsockets** | Plugin que le añade WebSockets para clientes de navegador |
| **Nitro (nitro-react)** | El cliente HTML5, reescritura del Flash original |
| **nitro-converter** | Convierte los SWF a paquetes `.nitro` que el cliente entiende |
| **MariaDB** | Base de datos: usuarios, salas, muebles, catálogo |

Todo corre en Docker, aislado de tu sistema.

## Requisitos

- **Docker Desktop** arrancado (en Windows, con WSL2 activado)
- **Git**
- Unos **10 GB** libres y una conexión decente: la primera vez descarga mucho
- En Windows, ejecuta el script desde **WSL** o **Git Bash**

## Puesta en marcha

```bash
./retro/hotel.sh instalar    # clona el stack y baja los submódulos
./retro/hotel.sh arrancar    # levanta base de datos, emulador y cliente
./retro/hotel.sh logs        # mira cómo va (5-10 min la primera vez)
```

Cuando los registros se calmen, abre:

**<http://127.0.0.1:1080?sso=123>**

Si el cliente se atasca alrededor del **20 %**, faltan los assets convertidos.
Es lo normal en el primer arranque:

```bash
./retro/hotel.sh assets      # convierte los SWF; tarda un buen rato
```

Y recarga la página.

## Órdenes

```
./retro/hotel.sh instalar    Clona el stack y descarga los submódulos
./retro/hotel.sh arrancar    Levanta todo
./retro/hotel.sh assets      Convierte los SWF a .nitro
./retro/hotel.sh logs [qué]  Registros: todo | arcturus | nitro
./retro/hotel.sh estado      Contenedores en marcha
./retro/hotel.sh sql         Consola de MariaDB
./retro/hotel.sh reiniciar   Reinicia solo el emulador
./retro/hotel.sh parar       Para todo, conservando datos
./retro/hotel.sh borrar      Borra datos y volúmenes (pide confirmación)
```

## Cómo entras

El `?sso=123` no es una contraseña: es un **ticket de autenticación**. La base
de datos trae un usuario ya creado, `Systemaccount`, con el ticket `123` en la
columna `auth_ticket`. El cliente lo canjea al cargar.

En un hotel de verdad ese ticket lo genera el CMS al iniciar sesión. Aquí, como
es local, lo pones a mano.

### Crear tu propio usuario

```bash
./retro/hotel.sh sql
```

```sql
INSERT INTO users (username, password, mail, account_created, auth_ticket, rank,
                   credits, ip_register, ip_current, look, motto)
VALUES ('Alejo', '', 'alejo@local', UNIX_TIMESTAMP(), 'miticket', 7,
        99999, '127.0.0.1', '127.0.0.1',
        'hd-180-1.ch-210-66.lg-270-82.sh-290-80', 'Mi hotel');
```

Y entras con **<http://127.0.0.1:1080?sso=miticket>**.

El `rank` 7 es **Administrator**, que te da los comandos de moderación
(`:ha`, `:roomkick`, `:teleport`…). Los rangos son: 1 Member, 2 VIP, 4 Support,
5 Moderator, 6 Super Mod, 7 Administrator.

### Darte créditos

```sql
UPDATE users SET credits = 999999, pixels = 999999 WHERE username = 'Alejo';
```

Reinicia el emulador después (`./retro/hotel.sh reiniciar`) o vuelve a entrar.

## Puertos

| Puerto | Qué es |
| --- | --- |
| 1080 | El cliente Nitro — **es el que abres en el navegador** |
| 2096 | WebSocket del emulador (por donde habla el cliente) |
| 3000 | Puerto del juego (clientes Flash antiguos) |
| 3001 | RCON, para que el CMS hable con el emulador |
| 8080 | Servidor de assets `.nitro` |
| 8081 | Servidor de SWF |
| 13306 | MariaDB, si te quieres conectar con un cliente de escritorio |

⚠️ **El puerto 2096 choca con el servidor del juego propio de este repositorio.**
No ejecutes `npm run dev` y el hotel a la vez, o arranca el nuestro en otro
puerto: `PORT=2098 npm run dev:server`.

## Configuración

Después de `instalar`, los archivos están en `retro/stack/`:

| Archivo | Para qué |
| --- | --- |
| `emulator/config.ini` | Base de datos, puertos, ajustes del emulador |
| `nitro/configuration/nitro-react/public/renderer-config.json` | URLs del cliente, FPS, opciones de render |
| `nitro/configuration/nitro-react/public/ui-config.json` | Qué muestra la interfaz |
| `mysql/dumps/` | La base de datos inicial |

Tras tocar la configuración de Nitro, reinicia ese contenedor. Tras tocar
`config.ini`, usa `./retro/hotel.sh reiniciar`.

## Si algo falla

**Se queda en el 20 %.** Faltan assets. `./retro/hotel.sh assets`. Si persiste,
mira los registros del cliente: suele faltar `ExternalText`.

**«port is already allocated».** Tienes algo ocupando 1080, 2096, 3000 o 13306.
Mira con `lsof -i :2096` (o `netstat -ano | findstr 2096` en Windows). Recuerda
que nuestro juego usa el 2096.

**El emulador no conecta con la base de datos.** MariaDB tarda más en arrancar
la primera vez. `./retro/hotel.sh reiniciar` suele bastar.

**Parece colgado en el primer arranque.** Compila el emulador con Maven y hace
`yarn install` del cliente. 5-10 minutos es lo esperado; míralo con `logs`.

**Quiero empezar de cero.** `./retro/hotel.sh borrar` y luego `arrancar`.

## Créditos

Este directorio solo automatiza el arranque. El trabajo real es de:

- [Arcturus Morningstar](https://git.krews.org/morningstar/Arcturus-Community) — el emulador
- [nitro-react](https://github.com/billsonnn/nitro-react) y [nitro-converter](https://github.com/billsonnn/nitro-converter) — el cliente HTML5
- [nitro-docker](https://github.com/Holo5/nitro-docker) — el entorno Docker que este script maneja
