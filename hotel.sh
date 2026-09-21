#!/usr/bin/env bash
#
# Monta y maneja un hotel local completo: emulador Arcturus Morningstar +
# cliente Nitro (HTML5) + MariaDB, todo en Docker.
#
# Uso:  ./hotel.sh <orden>          (Linux, macOS, WSL, Git Bash)
#       hotel.cmd <orden>          (cmd.exe o PowerShell en Windows)
# Ver:  ./hotel.sh ayuda
#
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK="$AQUI/stack"
ORIGEN="https://github.com/Holo5/nitro-docker.git"

# Cómo se invoca este script en la consola de quien lo ejecuta, para que los
# mensajes no manden a nadie a la sintaxis equivocada.
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) YO="hotel.cmd" ;;
  *)                    YO="./hotel.sh" ;;
esac

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
info()  { printf '\033[36m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

# docker compose (v2) o docker-compose (v1), lo que haya.
detectar_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    rojo "No encuentro Docker Compose."
    gris "Instala Docker Desktop: https://www.docker.com/get-started/"
    exit 1
  fi
}

comprobar_requisitos() {
  local faltan=0
  for herramienta in git docker; do
    if ! command -v "$herramienta" >/dev/null 2>&1; then
      rojo "Falta: $herramienta"
      faltan=1
    fi
  done
  [ "$faltan" -eq 0 ] || exit 1

  # Se sondea con `docker ps`, no con `docker info`: este último consulta
  # plugins y contextos, tarda más y en Docker Desktop llega a devolver error
  # con el demonio perfectamente vivo. Y se enseña lo que responde Docker en
  # vez de tragárselo, que si no es imposible saber qué pasa.
  local salida
  if ! salida="$(docker ps --format '{{.ID}}' 2>&1)"; then
    rojo "No consigo hablar con Docker."
    echo
    gris "Docker respondió:"
    printf '%s\n' "$salida" | sed 's/^/    /'
    echo
    gris "Si Docker Desktop está abierto y 'docker ps' te funciona en otra"
    gris "consola, el problema está aquí y no en tu equipo: cuéntamelo."
    exit 1
  fi
  detectar_compose
}

compose() {
  "${COMPOSE[@]}" -f "$STACK/docker-compose.yaml" --project-directory "$STACK" "$@"
}

# Git Bash no da una terminal real a los programas de Windows: sin winpty,
# `docker exec -it` falla con "the input device is not a TTY".
interactivo() {
  if command -v winpty >/dev/null 2>&1; then
    winpty "$@"
  else
    "$@"
  fi
}

# ------------------------------------------------------------------ #

orden_instalar() {
  comprobar_requisitos

  if [ -d "$STACK/.git" ]; then
    info "El stack ya está clonado en retro/stack; actualizo los submódulos."
  else
    info "Clonando el stack (emulador, cliente y assets)..."
    # core.autocrlf=false evita que Git convierta a CRLF en Windows.
    git -c core.autocrlf=false -c core.eol=lf clone "$ORIGEN" "$STACK"
  fi

  git -C "$STACK" submodule init

  cat <<'AVISO'

  Ahora vienen los submódulos. Dos de ellos son paquetes de assets de
  VARIOS GIGAS, así que esto puede tardar de media hora a varias horas
  según tu conexión. Verás el progreso de cada uno.

  Puedes cortar con Ctrl+C: al volver a ejecutar "instalar" continúa por
  donde iba, sin repetir lo ya descargado.

AVISO

  local rutas ruta
  rutas="$(git -C "$STACK" config --file .gitmodules --get-regexp '^submodule\..*\.path$' | awk '{print $2}')"

  for ruta in $rutas; do
    if [ -n "$(ls -A "$STACK/$ruta" 2>/dev/null)" ]; then
      gris "  ya descargado: $ruta"
      continue
    fi
    info "  descargando $ruta ..."
    # Con --depth 1 se evita descargar todo el historial, que en los
    # paquetes de assets multiplica el tamaño. Si el submódulo apunta a un
    # commit que no es la punta de su rama, el atajo falla y vamos a por
    # el historial completo.
    if ! git -C "$STACK" -c core.autocrlf=false -c core.eol=lf \
           submodule update --init --depth 1 --progress "$ruta"; then
      gris "  sin atajo posible; descargando el historial completo de $ruta"
      git -C "$STACK" -c core.autocrlf=false -c core.eol=lf \
        submodule update --init --progress "$ruta"
    fi
  done

  normalizar_finales_de_linea
  verde "Listo. Ahora:  $YO arrancar"
}

orden_arrancar() {
  comprobar_requisitos
  [ -d "$STACK" ] || { rojo "Primero ejecuta: ./hotel.sh instalar"; exit 1; }

  normalizar_finales_de_linea

  info "Levantando MariaDB, Arcturus y Nitro..."
  compose up -d

  cat <<FIN

  El primer arranque descarga las imágenes de Docker, compila el emulador
  con Maven e instala las dependencias del cliente. Tarda entre 5 y 10
  minutos, o más la primera vez: es normal.

  Sigue el progreso con:   $YO logs
  Cuando termine, abre:    http://127.0.0.1:1080?sso=123

  Si el cliente se queda cargando en torno al 20 %, es que faltan los
  assets convertidos. Ejecuta entonces:

      $YO assets

FIN
}

orden_assets() {
  comprobar_requisitos
  if ! docker ps --format '{{.Names}}' | grep -qx nitro; then
    rojo "El contenedor 'nitro' no está en marcha."
    gris "Arranca primero con: $YO arrancar"
    exit 1
  fi

  info "Convirtiendo los SWF a paquetes .nitro. Esto tarda bastante."
  docker exec -i nitro bash -c \
    "cp /app/configuration/nitro-converter/configuration.json /app/nitro-converter/configuration.json"
  docker exec -i nitro bash -c \
    "cd /app/nitro-converter && yarn ts-node-dev --transpile-only src/Main.ts"

  info "Publicando los assets en el servidor de archivos..."
  docker exec -i nitro bash -c "rsync -r /app/nitro-converter/assets/* /app/nitro-assets/"

  verde "Assets listos. Recarga http://127.0.0.1:1080?sso=123"
}

# Los contenedores son Linux, pero el clon se hace en el sistema de quien
# instala. Si es Windows, Git suele convertir los scripts a CRLF y dentro del
# contenedor ese \r invisible se pega al final de cada línea: rompe rutas
# ("no existe /app/supervisor/supervisord.conf\r"), URLs (wget devuelve 400) y
# cualquier orden. Aquí se devuelven a LF los archivos que ejecuta el contenedor.
normalizar_finales_de_linea() {
  local archivo arreglados=0
  while IFS= read -r archivo; do
    # Solo se reescribe si de verdad lleva CR, para no tocar por tocar.
    if grep -qU $'\r' "$archivo" 2>/dev/null; then
      # Se quitan TODOS los CR, no solo los del final de línea: algunos de
      # estos archivos ya vienen con CRLF desde su repositorio de origen, y
      # dejar uno suelto rompía igual y hacía que la reparación no fuese
      # idempotente.
      sed -i 's/\r//g' "$archivo"
      arreglados=$((arreglados + 1))
    fi
  done < <(find "$STACK" -name .git -prune -o -type f \
             \( -name '*.sh' -o -name '*.conf' -o -name '*.ini' -o -name '*.cnf' \) -print)

  if [ "$arreglados" -gt 0 ]; then
    info "Finales de línea corregidos en $arreglados archivo(s) del stack."
  fi
}

# ¿Está supervisor en marcha dentro de un contenedor? Durante el primer
# arranque todavía no, porque el script de construcción va por delante.
supervisor_listo() {
  docker exec "$1" supervisorctl status >/dev/null 2>&1
}

orden_logs() {
  comprobar_requisitos
  gris "Ctrl+C para dejar de mirar. El hotel sigue funcionando."
  echo
  case "${1:-todo}" in
    todo)
      compose logs -f
      ;;
    arcturus | nitro | mysql)
      # La salida del contenedor: siempre disponible, y es donde se ve la
      # compilación de Maven y la instalación de dependencias.
      docker logs -f --tail 100 "$1"
      ;;
    emulador)
      if supervisor_listo arcturus; then
        docker exec arcturus supervisorctl tail -f arcturus-emulator
      else
        rojo "El emulador todavía no está en marcha."
        gris "Se está compilando. Míralo con:  $YO logs arcturus"
        exit 1
      fi
      ;;
    cliente)
      if supervisor_listo nitro; then
        docker exec nitro supervisorctl tail -f nitro-dev-server
      else
        rojo "El servidor del cliente todavía no está en marcha."
        gris "Se están instalando las dependencias. Míralo con:  $YO logs nitro"
        exit 1
      fi
      ;;
    *)
      rojo "No sé de qué quieres los registros: '$1'."
      gris "Opciones: todo, arcturus, nitro, mysql, emulador, cliente"
      exit 1
      ;;
  esac
}

orden_sql() {
  comprobar_requisitos
  interactivo docker exec -it mysql mysql -u arcturus_user -parcturus_pw arcturus
}

orden_reiniciar() {
  comprobar_requisitos
  if supervisor_listo arcturus; then
    info "Reiniciando el emulador..."
    docker exec arcturus supervisorctl restart arcturus-emulator
  else
    gris "Supervisor aún no responde; reinicio el contenedor entero."
    compose restart arcturus
  fi
  verde "Hecho."
}

orden_parar() {
  comprobar_requisitos
  compose down
  verde "Hotel parado. Los datos y los assets se conservan."
}

orden_estado() {
  comprobar_requisitos
  compose ps
}

orden_borrar() {
  comprobar_requisitos
  rojo "Esto borra la base de datos, los assets convertidos y las imágenes."
  read -r -p "¿Seguro? Escribe 'si' para continuar: " respuesta
  [ "$respuesta" = "si" ] || { gris "Cancelado."; exit 0; }
  compose down -v --rmi local
  verde "Todo limpio. El código sigue en retro/stack."
}

orden_reparar() {
  comprobar_requisitos
  [ -d "$STACK" ] || { rojo "Primero ejecuta: $YO instalar"; exit 1; }
  info "Revisando los finales de línea del stack..."
  normalizar_finales_de_linea
  info "Recreando los contenedores para que vuelvan a ejecutar los scripts..."
  compose down
  compose up -d
  verde "Hecho. Sigue el progreso con:  $YO logs arcturus"
}

orden_sala() {
  # Los argumentos se validan antes de tocar Docker: un nombre mal escrito
  # debe decirlo, no soltar un error de conexión que despista.
  local nombre="${1:-}" usuario="${2:-}"

  if [ -z "$nombre" ]; then
    rojo "Dime qué sala cargar."
    gris "Disponibles:"
    for archivo in "$AQUI"/salas/*.sql; do
      [ -e "$archivo" ] || continue
      case "$archivo" in *.plantilla.sql) continue ;; esac
      gris "    $(basename "$archivo" .sql)"
    done
    exit 1
  fi

  local archivo="$AQUI/salas/$nombre.sql"
  [ -f "$archivo" ] || { rojo "No existe salas/$nombre.sql"; exit 1; }

  if [ -n "$usuario" ]; then
    # Nombre acotado a caracteres inofensivos: esto acaba dentro de una
    # consulta, y no queremos sorpresas ni en tu propia base de datos.
    case "$usuario" in
      *[!A-Za-z0-9._-]*) rojo "Nombre de usuario no válido: '$usuario'"; exit 1 ;;
    esac
  fi

  comprobar_requisitos
  if ! docker ps --format '{{.Names}}' | grep -qx mysql; then
    rojo "La base de datos no está en marcha."
    gris "Arranca primero con: $YO arrancar"
    exit 1
  fi

  info "Cargando salas/$nombre.sql..."
  if [ -n "$usuario" ]; then
    sed "s/SET @usuario := '[^']*'/SET @usuario := '$usuario'/" "$archivo" \
      | docker exec -i mysql mysql -u arcturus_user -parcturus_pw arcturus
  else
    docker exec -i mysql mysql -u arcturus_user -parcturus_pw arcturus < "$archivo"
  fi

  info "Reiniciando el emulador para que cargue la sala nueva..."
  if supervisor_listo arcturus; then
    docker exec arcturus supervisorctl restart arcturus-emulator >/dev/null
  else
    compose restart arcturus >/dev/null
  fi
  verde "Listo. Entra al hotel y búscala en el navegador de salas."
}

orden_diagnostico() {
  echo "Carpeta del stack: $STACK"
  if [ ! -d "$STACK" ]; then
    rojo "Todavía no existe: ejecuta 'instalar'."
    return
  fi
  echo
  echo "Submódulos:"
  local rutas ruta tam
  rutas="$(git -C "$STACK" config --file .gitmodules --get-regexp '^submodule\..*\.path$' | awk '{print $2}')"
  for ruta in $rutas; do
    if [ -n "$(ls -A "$STACK/$ruta" 2>/dev/null)" ]; then
      tam="$(du -sh "$STACK/$ruta" 2>/dev/null | cut -f1)"
      printf '  %-24s descargado (%s)\n' "$ruta" "${tam:-?}"
    else
      printf '  %-24s PENDIENTE\n' "$ruta"
    fi
  done
  echo
  echo "Total en disco: $(du -sh "$STACK" 2>/dev/null | cut -f1)"
  echo
  gris "Si algo sigue PENDIENTE, vuelve a ejecutar '$YO instalar': continúa donde iba."
}

orden_ayuda() {
  cat <<'FIN'
Hotel local — emulador Arcturus + cliente Nitro

  ./hotel.sh instalar    Clona el stack y descarga los submódulos
  ./hotel.sh arrancar    Levanta base de datos, emulador y cliente
  ./hotel.sh assets      Convierte los SWF a .nitro (tras el 1.er arranque)
  ./hotel.sh logs [qué]  Registros del contenedor: todo | arcturus | nitro | mysql
                         o del proceso ya en marcha: emulador | cliente
  ./hotel.sh estado      Qué contenedores hay en marcha
  ./hotel.sh diagnostico Qué submódulos faltan y cuánto ocupan
  ./hotel.sh reparar     Arregla finales de línea y recrea los contenedores
  ./hotel.sh sala <n> [usuario]
                         Carga una sala de salas/ (p. ej. guerra-vip)
  ./hotel.sh sql         Abre la consola de MariaDB
  ./hotel.sh reiniciar   Reinicia solo el emulador
  ./hotel.sh parar       Para todo, conservando los datos
  ./hotel.sh borrar      Borra datos y volúmenes (pide confirmación)

Primera vez:   instalar -> arrancar -> (esperar) -> assets
Para jugar:    http://127.0.0.1:1080?sso=123

En Windows, desde cmd.exe o PowerShell, usa  hotel.cmd <orden>
FIN
}

case "${1:-ayuda}" in
  instalar)   orden_instalar ;;
  arrancar)   orden_arrancar ;;
  assets)     orden_assets ;;
  logs)       shift; orden_logs "${1:-todo}" ;;
  estado)     orden_estado ;;
  diagnostico|diagnóstico) orden_diagnostico ;;
  reparar)    orden_reparar ;;
  sala)       shift; orden_sala "${1:-}" "${2:-}" ;;
  sql)        orden_sql ;;
  reiniciar)  orden_reiniciar ;;
  parar)      orden_parar ;;
  borrar)     orden_borrar ;;
  ayuda|-h|--help) orden_ayuda ;;
  *) rojo "No conozco la orden '$1'."; echo; orden_ayuda; exit 1 ;;
esac
