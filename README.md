# Hotel — réplica local de Habbo con Arcturus + Nitro

Monta en tu PC un hotel idéntico al original, para uso **privado y local**,
con el ecosistema open source que la comunidad mantiene desde hace más de una
década.

> En [`juego-propio/`](juego-propio/README.md) está guardado, como referencia, el
> juego isométrico con arte original que construimos antes de tomar este camino.
> Es un proyecto independiente: no interviene en nada de lo que hay aquí.

> **Sobre los assets.** El emulador y el cliente son software libre, pero los
> sprites, muebles, sonidos y fuentes son propiedad de Sulake. Se descargan en
> tu máquina al instalar y están excluidos del control de versiones
> (`.gitignore`). No los subas a ningún sitio ni publiques el servidor.

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
- Unos **10 GB** libres y paciencia: dos de los submódulos son paquetes de
  assets de **varios gigas**, así que `instalar` puede tardar de media hora a
  varias horas según tu conexión. Es descarga, no un cuelgue: `hotel.cmd
  diagnostico` te dice en otra ventana cuánto lleva bajado. Puedes cortar con
  Ctrl+C y reanudar: no repite lo ya descargado.

## Puesta en marcha

### Windows (cmd.exe o PowerShell)

Usa `hotel.cmd`, que localiza Git Bash por ti. **Lanza las órdenes de una en
una**: `instalar` descarga cientos de megas y `arrancar` tarda varios minutos.

```bat
hotel.cmd instalar
hotel.cmd arrancar
hotel.cmd logs
```

Desde **Git Bash** o **WSL** puedes usar directamente `./hotel.sh instalar`.

### Linux y macOS

```bash
./hotel.sh instalar    # clona el stack y baja los submódulos
./hotel.sh arrancar    # levanta base de datos, emulador y cliente
./hotel.sh logs        # mira cómo va (5-10 min la primera vez)
```

En las órdenes que siguen, si estás en cmd.exe cambia `./hotel.sh` por
`hotel.cmd`; hacen exactamente lo mismo.

Cuando los registros se calmen, abre:

**<http://127.0.0.1:1080?sso=123>**

Si el cliente se atasca alrededor del **20 %**, faltan los assets convertidos.
Es lo normal en el primer arranque:

```bash
./hotel.sh assets      # convierte los SWF; tarda un buen rato
```

Y recarga la página.

## Órdenes

```
./hotel.sh instalar    Clona el stack y descarga los submódulos
./hotel.sh arrancar    Levanta todo
./hotel.sh assets      Convierte los SWF a .nitro
./hotel.sh logs [qué]  Registros del contenedor: todo | arcturus | nitro | mysql
                       o del proceso ya en marcha: emulador | cliente
./hotel.sh estado      Contenedores en marcha
./hotel.sh diagnostico Qué submódulos faltan y cuánto ocupan
./hotel.sh sql         Consola de MariaDB
./hotel.sh reiniciar   Reinicia solo el emulador
./hotel.sh parar       Para todo, conservando datos
./hotel.sh borrar      Borra datos y volúmenes (pide confirmación)
```

## Cómo entras

El `?sso=123` no es una contraseña: es un **ticket de autenticación**. La base
de datos trae un usuario ya creado, `Systemaccount`, con el ticket `123` en la
columna `auth_ticket`. El cliente lo canjea al cargar.

En un hotel de verdad ese ticket lo genera el CMS al iniciar sesión. Aquí, como
es local, lo pones a mano.

### Crear tu propio usuario

```bash
./hotel.sh sql
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

Reinicia el emulador después (`./hotel.sh reiniciar`) o vuelve a entrar.

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

⚠️ **El puerto 2096 choca con el servidor de `juego-propio/`.** No ejecutes los
dos a la vez, o arranca aquel en otro puerto:
`cd juego-propio && PORT=2098 npm run dev:server`.

## Configuración

Después de `instalar`, los archivos están en `stack/`:

| Archivo | Para qué |
| --- | --- |
| `emulator/config.ini` | Base de datos, puertos, ajustes del emulador |
| `nitro/configuration/nitro-react/public/renderer-config.json` | URLs del cliente, FPS, opciones de render |
| `nitro/configuration/nitro-react/public/ui-config.json` | Qué muestra la interfaz |
| `mysql/dumps/` | La base de datos inicial |

Tras tocar la configuración de Nitro, reinicia ese contenedor. Tras tocar
`config.ini`, usa `./hotel.sh reiniciar`.

## Si algo falla

**Se queda en el 20 %.** Faltan assets. `./hotel.sh assets`. Si persiste,
mira los registros del cliente: suele faltar `ExternalText`.

**«port is already allocated».** Tienes algo ocupando 1080, 2096, 3000 o 13306.
Mira con `lsof -i :2096` (o `netstat -ano | findstr 2096` en Windows). Recuerda
que nuestro juego usa el 2096.

**«No consigo hablar con Docker» pero `docker ps` te funciona.** No debería
pasar: el script sondea con `docker ps` y te enseña la respuesta literal de
Docker. Pásame ese texto.

**`unix:///run/supervisord.sock no such file`.** Supervisor aún no ha arrancado
dentro del contenedor: el emulador se está compilando todavía. Usa
`hotel.cmd logs arcturus`, que lee la salida del contenedor y funciona siempre.

**El emulador no conecta con la base de datos.** MariaDB tarda más en arrancar
la primera vez. `./hotel.sh reiniciar` suele bastar.

**¿Cómo salgo de `logs`?** Con Ctrl+C (y `Y` si cmd pregunta *Terminate batch
job*). Solo deja de mostrar los registros: los contenedores siguen en marcha.
Para pararlos de verdad, `hotel.cmd parar`.

**`instalar` lleva horas.** Lo normal si tu conexión no es rápida: el paquete
de SWF y el de assets por defecto pesan varios gigas cada uno. Abre otra
ventana y ejecuta `hotel.cmd diagnostico` para ver qué falta y cuánto lleva.
Si el total no crece en varios minutos, entonces sí está atascado: corta con
Ctrl+C y relanza `instalar`, que continúa donde iba.

**Parece colgado en el primer arranque.** Compila el emulador con Maven y hace
`yarn install` del cliente. 5-10 minutos es lo esperado; míralo con `logs`.

**Quiero empezar de cero.** `./hotel.sh borrar` y luego `arrancar`.

**En cmd.exe: «'.' no se reconoce como un comando interno o externo».** Estás
usando sintaxis de bash en la consola de Windows. Usa `hotel.cmd instalar`, o
abre Git Bash.

**`/bin/bash: C:\...\hotel.sh: No such file or directory`.** Se está usando el
bash de WSL, que no entiende rutas de Windows. `hotel.cmd` busca Git Bash
expresamente para evitarlo; si ves este error, actualiza el repositorio.

**En Git Bash: «$'\r': command not found».** El script se descargó con finales
de línea de Windows. El `.gitattributes` del repositorio lo evita, pero si
clonaste antes de que existiera, arréglalo con:

```bash
git rm --cached -r . && git reset --hard
```

**En Git Bash: «the input device is not a TTY».** Ya está contemplado: el script
usa `winpty` cuando está disponible. Si aun así falla, usa esa orden desde
PowerShell o cmd con `hotel.cmd sql`.

## Créditos

`hotel.sh` solo automatiza el arranque. El trabajo real es de:

- [Arcturus Morningstar](https://git.krews.org/morningstar/Arcturus-Community) — el emulador
- [nitro-react](https://github.com/billsonnn/nitro-react) y [nitro-converter](https://github.com/billsonnn/nitro-converter) — el cliente HTML5
- [nitro-docker](https://github.com/Holo5/nitro-docker) — el entorno Docker que este script maneja
