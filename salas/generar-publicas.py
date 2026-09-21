# -*- coding: utf-8 -*-
"""Genera salas/publicas.sql: las salas públicas del hotel.

Arcturus trae los 60 modelos de las salas públicas clásicas, pero ninguna
sala creada con ellos y la tabla `navigator_publics` vacía. Por eso el
navegador aparece sin salas oficiales. Esto las crea.

Cada modelo se verifica contra el volcado antes de generar nada.

Uso:  python3 salas/generar-publicas.py
"""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
VOLCADO = os.path.join(AQUI, '..', 'stack', 'mysql', 'dumps',
                       'arcturus_3.0.0-stable_base_database--compact.sql')
SALIDA = os.path.join(AQUI, 'publicas.sql')

# Dueño de las salas públicas: la cuenta de sistema que trae Arcturus.
DUENNO = 'Systemaccount'

# Categorías que ya existen en navigator_publiccats.
STAFF, JUEGOS = 1, 2

# (modelo, nombre, descripción, categoría)
SALAS = [
    ('newbie_lobby', 'Vestíbulo',        'La entrada del hotel. Por aquí empieza todo.', STAFF),
    ('the_den',      'La Guarida',       'El sitio de siempre para quedar.',             STAFF),
    ('pub_a',        'El Pub',           'Una caña y a charlar.',                        STAFF),
    ('netcafe',      'Cibercafé',        'Ordenadores, café y ruido de teclas.',         STAFF),
    ('rooftop',      'La Azotea',        'Vistas del hotel desde arriba.',               STAFF),
    ('rooftop_2',    'Azotea Norte',     'La otra azotea, más tranquila.',               STAFF),
    ('star_lounge',  'Star Lounge',      'Sofás, luces y música.',                       STAFF),
    ('tearoom',      'Salón de Té',      'Para conversaciones largas.',                  STAFF),
    ('pizza',        'Pizzería',         'Huele bien desde la puerta.',                  STAFF),
    ('old_skool',    'Discoteca',        'La pista no para.',                            STAFF),
    ('dusty_lounge', 'Salón Polvoriento','Nadie ha pasado la escoba en años.',           STAFF),
    ('orient',       'Jardín Oriental',  'Silencio y agua corriendo.',                   STAFF),
    ('park_a',       'El Parque',        'Aire libre dentro del hotel.',                 STAFF),
    ('picnic',       'Zona de Picnic',   'Manta, cesta y sitio de sobra.',               STAFF),
    ('cinema_a',     'Cine',             'La sesión está a punto de empezar.',           JUEGOS),
    ('theater',      'Teatro',           'Escenario libre: sube y actúa.',               JUEGOS),
    ('infobus_bus',  'Infobús',          'El autobús de siempre.',                       JUEGOS),
]


def modelos_disponibles():
    if not os.path.exists(VOLCADO):
        sys.exit('No encuentro el volcado de Arcturus en:\n  %s\n'
                 'Ejecuta antes:  hotel.cmd instalar' % VOLCADO)
    sql = open(VOLCADO, encoding='utf8', errors='replace').read()
    ins = "".join(re.findall(r"INSERT INTO `room_models` VALUES (.*?);\n", sql, re.S))
    return set(re.findall(r"\('([a-z_0-9]+)'", ins))


def escapar(texto):
    return texto.replace("\\", "\\\\").replace("'", "\\'")


def main():
    disponibles = modelos_disponibles()
    print('Modelos en el volcado: %d' % len(disponibles))
    faltan = [m for m, _, _, _ in SALAS if m not in disponibles]
    if faltan:
        sys.exit('Estos modelos no existen: %s' % ', '.join(faltan))
    print('Los %d modelos elegidos existen todos' % len(SALAS))

    selects = "\nUNION ALL\n".join(
        "SELECT id, username, '%s', '%s', '%s', 'open', 50, '1'\n"
        "  FROM users WHERE username = '%s'" % (escapar(n), escapar(d), m, DUENNO)
        for m, n, d, _ in SALAS)

    casos = "\n".join("           WHEN '%s' THEN %d" % (m, c)
                      for m, _, _, c in SALAS)

    sql = """-- =====================================================================
--  Salas publicas del hotel
--
--  Arcturus trae los 60 modelos de las salas publicas clasicas, pero
--  ninguna sala creada con ellos y `navigator_publics` vacia: por eso el
--  navegador aparece sin salas oficiales.
--
--  Generado por salas/generar-publicas.py -- no lo edites a mano.
--  Se puede ejecutar varias veces: borra su version anterior primero.
-- =====================================================================

SELECT COUNT(*) AS cuenta_de_sistema_encontrada FROM users WHERE username = '{duenno}';

-- --- Borrar las salas publicas creadas por este script -----------------
--  Solo las suyas: se reconocen por ser publicas y de la cuenta de
--  sistema. Las salas que hayas creado tu no se tocan.
DELETE np FROM navigator_publics np
  JOIN rooms r ON r.id = np.room_id
 WHERE r.is_public = '1' AND r.owner_name = '{duenno}';
DELETE i FROM items i
  JOIN rooms r ON r.id = i.room_id
 WHERE r.is_public = '1' AND r.owner_name = '{duenno}';
DELETE FROM rooms WHERE is_public = '1' AND owner_name = '{duenno}';

-- --- Crear las {n} salas ------------------------------------------------
--  Si la cuenta de sistema no existiera, no se insertaria ninguna.
INSERT INTO rooms (owner_id, owner_name, name, description, model, state,
                   users_max, is_public)
{selects};

-- --- Publicarlas en el navegador ---------------------------------------
INSERT INTO navigator_publics (public_cat_id, room_id, visible)
SELECT CASE model
{casos}
           ELSE {staff} END,
       id, '1'
  FROM rooms
 WHERE is_public = '1' AND owner_name = '{duenno}';

SELECT COUNT(*) AS salas_publicas_creadas
  FROM rooms WHERE is_public = '1' AND owner_name = '{duenno}';
""".format(duenno=DUENNO, n=len(SALAS), selects=selects, casos=casos, staff=STAFF)

    open(SALIDA, 'w', encoding='utf8').write(sql)
    print('\nSalas:')
    for m, n, _, c in SALAS:
        print('  %-24s %-18s %s' % (n, m, 'Official Games' if c == JUEGOS else 'Staff Picks'))
    print('\nEscrito: %s' % SALIDA)


if __name__ == '__main__':
    main()
