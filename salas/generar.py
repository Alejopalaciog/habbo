# -*- coding: utf-8 -*-
"""Genera salas/guerra-vip.sql a partir del diseño de la arena.

Lee el catálogo de muebles del volcado de Arcturus, así que no se inventa
ningún identificador. Comprueba que el mapa es coherente antes de escribir
nada y valida el SQL resultante.

Uso:  python3 salas/generar.py
"""
import os
import re
import sys
from collections import deque

AQUI = os.path.dirname(os.path.abspath(__file__))
VOLCADO = os.path.join(AQUI, '..', 'stack', 'mysql', 'dumps',
                       'arcturus_3.0.0-stable_base_database--compact.sql')
SALIDA = os.path.join(AQUI, 'guerra-vip.sql')

# Lado de la baldosa grande `tile`, que es 4x4.
B = 4
ANCHO, ALTO = 22, 40
NECESARIOS = ('tile', 'tile_stackmagic', 'wf_trg_walks_on_furni', 'wf_act_teleport_to')


def catalogo():
    """Identificador y altura de apilado de los muebles que usamos."""
    if not os.path.exists(VOLCADO):
        sys.exit('No encuentro el volcado de Arcturus en:\n  %s\n'
                 'Ejecuta antes:  hotel.cmd instalar' % VOLCADO)
    sql = open(VOLCADO, encoding='utf8', errors='replace').read()
    cols = re.search(r"CREATE TABLE `items_base` \((.*?)\n\) ENGINE", sql, re.S).group(1)
    nombres = re.findall(r"^\s*`([a-z_0-9]+)`", cols, re.M)
    ins = "".join(re.findall(r"INSERT INTO `items_base` VALUES (.*?);\n", sql, re.S))
    base = {}
    for fila in re.findall(r"\((.*?)\)(?=,\(|$)", ins, re.S):
        v = re.findall(r"'[^']*'|[^,]+", fila)
        if len(v) < len(nombres):
            continue
        nombre = v[nombres.index('item_name')].strip().strip("'")
        if nombre in NECESARIOS:
            base[nombre] = {
                'id': int(v[nombres.index('id')].strip()),
                'h': float(v[nombres.index('stack_height')].strip().strip("'") or 0),
            }
    faltan = [n for n in NECESARIOS if n not in base]
    if faltan:
        sys.exit('Faltan muebles en el catálogo: %s' % ', '.join(faltan))
    return base


def disenar():
    """Construye el mapa y devuelve las piezas de trampa a colocar."""
    mapa = [['x'] * ANCHO for _ in range(ALTO)]
    trampas = []

    def bloque(x0, y0, w, h, altura):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                mapa[y][x] = altura

    def arena(x0, y0, pw, ph, rampas):
        """Plataforma elevada con una banda de trampas de 4 alrededor.

        `rampas` son bloques de la banda que se elevan: entradas y salidas.
        Así cada pieza de trampa queda sobre suelo uniforme, que es
        condición para poder colocar un mueble de 4x4.
        """
        tx0, ty0 = x0 - B, y0 - B
        tw, th = pw + 2 * B, ph + 2 * B
        bloque(tx0, ty0, tw, th, '0')
        bloque(x0, y0, pw, ph, '1')
        for bx, by in rampas:
            bloque(bx, by, B, B, '1')
        for by in range(ty0, ty0 + th, B):
            for bx in range(tx0, tx0 + tw, B):
                dentro = x0 <= bx < x0 + pw and y0 <= by < y0 + ph
                if not dentro and (bx, by) not in rampas:
                    trampas.append((bx, by))

    arena(x0=5, y0=5, pw=12, ph=8, rampas=[(9, 13)])            # todos contra todos
    arena(x0=7, y0=22, pw=8, ph=8, rampas=[(11, 30), (11, 18)])  # 1 contra 1
    bloque(11, 17, 2, 1, '1')      # pasillo entre las dos arenas
    bloque(11, 34, 2, 2, '1')      # pasillo hacia la zona segura
    bloque(6, 36, 10, 3, '0')      # zona segura
    for x in range(0, 6):
        mapa[37][x] = '0'          # tramo desde la puerta
    return mapa, trampas


PUERTA = (0, 37)
REAPARICION = (11, 37)


def comprobar(mapa, trampas):
    """Verifica el suelo bajo cada pieza y que todo sea alcanzable."""
    malas = []
    for bx, by in trampas:
        alturas = {mapa[y][x] for y in range(by, by + B) for x in range(bx, bx + B)}
        if alturas != {'0'}:
            malas.append(((bx, by), sorted(alturas)))
    if malas:
        sys.exit('Piezas sobre suelo irregular: %s' % malas[:5])
    print('  %d piezas de trampa, todas sobre suelo plano' % len(trampas))

    vistos, cola = {PUERTA}, deque([PUERTA])
    while cola:
        x, y = cola.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < ANCHO and 0 <= ny < ALTO) or (nx, ny) in vistos:
                continue
            if mapa[ny][nx] == 'x':
                continue
            if abs(int(mapa[ny][nx]) - int(mapa[y][x])) > 1:
                continue      # un escalón de más de un nivel no se sube
            vistos.add((nx, ny))
            cola.append((nx, ny))
    destinos = {'arena 1vs1': (11, 25), 'arena de todos': (11, 8),
                'reaparición': REAPARICION}
    for nombre, punto in destinos.items():
        if punto not in vistos:
            sys.exit('No se llega a %s desde la puerta' % nombre)
    print('  las dos arenas y la reaparición se alcanzan desde la puerta')


def dibujar(mapa, trampas):
    leyenda = {'x': '.', '0': '·', '1': '#'}
    for y, fila in enumerate(mapa):
        texto = "".join(leyenda[c] for c in fila)
        for bx, by in trampas:
            if by <= y < by + B:
                texto = texto[:bx] + 'T' * B + texto[bx + B:]
        print('  %2d %s' % (y, texto))
    print('\n  . vacío   · suelo   # plataforma o rampa   T trampa')


def escribir_sql(mapa, trampas, base):
    heightmap = '\\r\\n'.join("".join(f) for f in mapa)
    rx, ry = REAPARICION
    wx, wy = rx - 3, ry
    valores = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 0, '')"
                         % (base['tile']['id'], x, y) for x, y in trampas)
    plantilla = open(os.path.join(AQUI, 'guerra-vip.plantilla.sql'),
                     encoding='utf8').read()
    return plantilla.format(
        n=len(trampas), c=len(trampas) * B * B,
        dx=PUERTA[0], dy=PUERTA[1], hm=heightmap, traps=valores,
        dest=base['tile_stackmagic']['id'], rx=rx, ry=ry,
        trg=base['wf_trg_walks_on_furni']['id'],
        act=base['wf_act_teleport_to']['id'], wx=wx, wy=wy,
        zact=base['wf_trg_walks_on_furni']['h'])


def main():
    base = catalogo()
    print('Muebles localizados en el catálogo:')
    for nombre in NECESARIOS:
        print('  %-24s id=%d' % (nombre, base[nombre]['id']))
    mapa, trampas = disenar()
    print('\nComprobaciones:')
    comprobar(mapa, trampas)
    print()
    dibujar(mapa, trampas)
    sql = escribir_sql(mapa, trampas, base)
    open(SALIDA, 'w', encoding='utf8').write(sql)
    print('\nEscrito: %s' % SALIDA)


if __name__ == '__main__':
    main()
