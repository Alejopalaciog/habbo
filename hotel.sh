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

  if ! docker info >/dev/null 2>&1; then
    rojo "Docker está instalado pero no está arrancado."
    gris "Abre Docker Desktop (o arranca el servicio) y vuelve a intentarlo."
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
    git clone "$ORIGEN" "$STACK"
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
    if ! git -C "$STACK" submodule update --init --depth 1 --progress "$ruta"; then
      gris "  sin atajo posible; descargando el historial completo de $ruta"
      git -C "$STACK" submodule update --init --progress "$ruta"
    fi
  done

  verde "Listo. Ahora:  $YO arrancar"
}

orden_arrancar() {
  comprobar_requisitos
  [ -d "$STACK" ] || { rojo "Primero ejecuta: ./hotel.sh instalar"; exit 1; }

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

orden_logs() {
  comprobar_requisitos
  case "${1:-todo}" in
    arcturus) docker exec arcturus supervisorctl tail -f arcturus-emulator ;;
    nitro)    docker exec nitro supervisorctl tail -f nitro-dev-server ;;
    *)        compose logs -f ;;
  esac
}

orden_sql() {
  comprobar_requisitos
  interactivo docker exec -it mysql mysql -u arcturus_user -parcturus_pw arcturus
}

orden_reiniciar() {
  comprobar_requisitos
  info "Reiniciando el emulador..."
  docker exec arcturus supervisorctl restart arcturus-emulator
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
  ./hotel.sh logs [qué]  Sigue los registros: todo | arcturus | nitro
  ./hotel.sh estado      Qué contenedores hay en marcha
  ./hotel.sh diagnostico Qué submódulos faltan y cuánto ocupan
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
  sql)        orden_sql ;;
  reiniciar)  orden_reiniciar ;;
  parar)      orden_parar ;;
  borrar)     orden_borrar ;;
  ayuda|-h|--help) orden_ayuda ;;
  *) rojo "No conozco la orden '$1'."; echo; orden_ayuda; exit 1 ;;
esac
