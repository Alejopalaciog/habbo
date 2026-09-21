# -*- coding: utf-8 -*-
"""Genera salas/muestrario.sql: una sala con todas las baldosas candidatas.

Sirve para elegir a ojo los colores de una sala, sin adivinar: coloca cada
baldosa 1x1 plana y pisable del catálogo, separadas, para poder recorrerlas
y hacer clic y ver cómo se llama cada una.

Uso:  python3 salas/generar-muestrario.py
"""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

import lib_items  # noqa: E402

VOLCADO = os.path.join(AQUI, '..', 'stack', 'mysql', 'dumps',
                       'arcturus_3.0.0-stable_base_database--compact.sql')
SALIDA = os.path.join(AQUI, 'muestrario.sql')

PATRON = re.compile(r'(tile|floor|carpet|rug|parquet|marble|stone|grass|sand|ice)', re.I)
SEPARACION = 2      # una baldosa de hueco entre muestras, para distinguirlas
COLUMNAS = 6


def candidatas():
    if not os.path.exists(VOLCADO):
        sys.exit('No encuentro el volcado de Arcturus en:\n  %s' % VOLCADO)
    fuera = []
    for m in lib_items.leer(VOLCADO):
        if m.get('type') != 's' or m['allow_walk'] != '1':
            continue
        if (m.get('interaction_type') or '').lower() not in ('default', '', 'none'):
            continue
        try:
            if (int(m['width']), int(m['length']), float(m['stack_height'])) != (1, 1, 0.0):
                continue
        except (ValueError, TypeError):
            continue
        if PATRON.search(m['item_name']):
            fuera.append((int(m['id']), m['item_name'], m['public_name']))
    return sorted(fuera)


def main():
    muestras = candidatas()
    filas = (len(muestras) + COLUMNAS - 1) // COLUMNAS
    ancho_int = COLUMNAS * SEPARACION + 1
    fondo_int = filas * SEPARACION + 1
    ancho, alto = ancho_int + 2, fondo_int + 2

    mapa = [['x'] * ancho for _ in range(alto)]
    for y in range(1, fondo_int + 1):
        for x in range(1, ancho_int + 1):
            mapa[y][x] = '0'
    heightmap = '\\r\\n'.join(''.join(f) for f in mapa)

    colocadas = []
    for i, (ident, nombre, _) in enumerate(muestras):
        cx = 1 + (i % COLUMNAS) * SEPARACION
        cy = 1 + (i // COLUMNAS) * SEPARACION
        colocadas.append((ident, cx, cy, nombre))

    # El comentario va al final de cada linea, asi que el punto y coma de
    # cierre NO puede ir pegado a la ultima: quedaria comentado y la
    # sentencia se fundiria con la siguiente.
    valores = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 0, '0')  -- %s"
                         % (ident, x, y, nombre) for ident, x, y, nombre in colocadas)

    sql = """-- =====================================================================
--  Muestrario de baldosas
--
--  Una sala con las {n} baldosas 1x1 planas y pisables del catalogo,
--  separadas para poder distinguirlas. Haz clic en cada una para ver su
--  nombre, y dime cuales quieres para el camino y para los carriles.
--
--  Generado por salas/generar-muestrario.py -- no lo edites a mano.
-- =====================================================================

SET @usuario := 'Alejo';
SET @propietario := (SELECT id FROM users WHERE username = @usuario);
SELECT IFNULL(@propietario, 'AVISO: ese usuario no existe. Revisa @usuario.') AS propietario;

SET @vieja := (SELECT id FROM rooms
               WHERE name = 'Muestrario de baldosas' AND owner_id <=> @propietario
               ORDER BY id DESC LIMIT 1);
DELETE FROM items WHERE room_id <=> @vieja;
DELETE FROM rooms WHERE id <=> @vieja;
DELETE FROM room_models WHERE name = 'model_muestrario';

INSERT INTO room_models (name, door_x, door_y, door_dir, heightmap, public_items, club_only)
VALUES ('model_muestrario', 1, {puerta_y}, 2, '{hm}', '', '0');

INSERT INTO rooms (owner_id, owner_name, name, description, model, state, users_max)
SELECT id, username, 'Muestrario de baldosas',
       'Cada baldosa del catalogo, para elegir colores a ojo.',
       'model_muestrario', 'open', 10
FROM users WHERE username = @usuario;

SET @sala := (SELECT id FROM rooms
              WHERE name = 'Muestrario de baldosas' AND owner_id <=> @propietario
              ORDER BY id DESC LIMIT 1);

INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
{valores}
;

SELECT @sala AS sala_creada,
       (SELECT COUNT(*) FROM items WHERE room_id <=> @sala) AS baldosas_colocadas;
""".format(n=len(muestras), hm=heightmap, valores=valores, puerta_y=fondo_int)

    open(SALIDA, 'w', encoding='utf8').write(sql)
    print('%d baldosas, en una rejilla de %d x %d' % (len(muestras), COLUMNAS, filas))
    print('sala de %dx%d\n' % (ancho_int, fondo_int))
    for ident, x, y, nombre in colocadas:
        print('  (%2d,%2d)  id=%-6d %s' % (x, y, ident, nombre))
    print('\nEscrito: %s' % SALIDA)


if __name__ == '__main__':
    main()
