# -*- coding: utf-8 -*-
"""Genera salas/guerra-vip.sql: la sala clásica de Guerra VIP.

Una sala plana de 13x8 (104 baldosas) con un camino en S. Los carriles
seguros alternan con carriles de baldosas que teletransportan al inicio, así
que desde cualquier punto del camino un solo empujón te elimina. Arriba, la
zona de combate y unos sofás para quien no quiera pelear.

Los identificadores de mueble se leen del volcado de Arcturus, no se inventan.
Antes de escribir nada comprueba que el laberinto tiene sentido.

Uso:  python3 salas/generar.py
"""
import os
import sys
from collections import deque

import lib_items

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
VOLCADO = os.path.join(AQUI, '..', 'stack', 'mysql', 'dumps',
                       'arcturus_3.0.0-stable_base_database--compact.sql')
SALIDA = os.path.join(AQUI, 'guerra-vip.sql')

NECESARIOS = ('tile_stackmagic', 'sofachair_silo',
              'wf_trg_walks_on_furni', 'wf_act_teleport_to')

# Sala plana: 13 de ancho por 8 de fondo = 104 baldosas, con borde de pared.
ANCHO_INT, FONDO_INT = 13, 8
ANCHO, ALTO = ANCHO_INT + 2, FONDO_INT + 2
X0, Y0 = 1, 1
X1, Y1 = X0 + ANCHO_INT - 1, Y0 + FONDO_INT - 1      # (13, 8)

PUERTA = (0, Y1)              # se entra por la esquina delantera izquierda
INICIO = (X0, Y1)             # adonde devuelve el teletransporte
SOFAS = [(x, Y0) for x in range(X1 - 3, X1 + 1)]     # zona azul, al fondo

# Carriles trampa y por qué lado los esquiva el camino.
#   fila -> columna que queda libre (el codo de la S)
CARRILES = {Y1 - 1: X1, Y1 - 3: X0, Y1 - 5: X1}      # filas 7, 5 y 3


def catalogo():
    if not os.path.exists(VOLCADO):
        sys.exit('No encuentro el volcado de Arcturus en:\n  %s\n'
                 'Ejecuta antes:  hotel.cmd instalar' % VOLCADO)
    base = {}
    for m in lib_items.leer(VOLCADO):
        if m['item_name'] in NECESARIOS:
            base[m['item_name']] = {'id': int(m['id']),
                                    'h': float(m['stack_height'] or 0)}
    faltan = [n for n in NECESARIOS if n not in base]
    if faltan:
        sys.exit('Faltan muebles en el catálogo: %s' % ', '.join(faltan))
    return base


def disenar():
    """Devuelve el mapa y las baldosas trampa."""
    mapa = [['x'] * ANCHO for _ in range(ALTO)]
    for y in range(Y0, Y1 + 1):
        for x in range(X0, X1 + 1):
            mapa[y][x] = '0'
    mapa[PUERTA[1]][PUERTA[0]] = '0'          # el hueco de la puerta

    trampas = []
    for fila, codo in CARRILES.items():
        for x in range(X0, X1 + 1):
            if x != codo:
                trampas.append((x, fila))
    return mapa, trampas


def comprobar(mapa, trampas):
    """El laberinto tiene que ser resoluble, y peligroso."""
    peligro = set(trampas)
    seguras = {(x, y) for y in range(ALTO) for x in range(ANCHO)
               if mapa[y][x] != 'x' and (x, y) not in peligro}

    # 1) Se llega arriba sin pisar una sola trampa.
    vistos, cola = {PUERTA}, deque([PUERTA])
    while cola:
        x, y = cola.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p in seguras and p not in vistos:
                vistos.add(p)
                cola.append(p)
    arriba = [(x, Y0) for x in range(X0, X1 + 1)]
    if not all(p in vistos for p in arriba):
        sys.exit('No se llega a la zona de combate sin pisar trampas')
    print('  se llega arriba por el camino seguro, sin pisar ninguna trampa')

    # 2) El camino es realmente estrecho: cada carril seguro entre trampas
    #    tiene trampa al norte y al sur, así que un empujón basta.
    expuestas = 0
    for (x, y) in seguras:
        if not (X0 <= x <= X1 and Y0 <= y <= Y1):
            continue
        if any((x + dx, y + dy) in peligro for dx, dy in ((0, 1), (0, -1))):
            expuestas += 1
    total = ANCHO_INT * FONDO_INT - len(trampas)
    print('  %d de %d baldosas seguras están pegadas a una trampa' % (expuestas, total))
    if expuestas < total * 0.5:
        sys.exit('El camino no es lo bastante expuesto: revisa los carriles')

    # 3) Exactamente 104 baldosas de suelo, como la sala original.
    suelo = sum(1 for y in range(Y0, Y1 + 1) for x in range(X0, X1 + 1)
                if mapa[y][x] != 'x')
    print('  la sala mide %d baldosas' % suelo)
    if suelo != 104:
        sys.exit('La sala deberia tener 104 baldosas')


def dibujar(mapa, trampas):
    peligro = set(trampas)
    sofas = set(SOFAS)
    for y in range(ALTO):
        fila = ''
        for x in range(ANCHO):
            if mapa[y][x] == 'x':
                fila += '.'
            elif (x, y) in peligro:
                fila += 'R'
            elif (x, y) in sofas:
                fila += 'A'
            elif (x, y) == INICIO:
                fila += 'I'
            elif y == Y0:
                fila += 'P'
            else:
                fila += 'V'
        print('  %2d %s' % (y, fila))
    print('\n  . pared   V camino seguro   R trampa   P combate   A sofá   I inicio')


def escribir_sql(mapa, trampas, base):
    heightmap = '\\r\\n'.join(''.join(f) for f in mapa)
    wx, wy = X0, Y0            # los wired, en la esquina del fondo
    filas = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 0, '')"
                       % (base['tile_stackmagic']['id'], x, y) for x, y in trampas)
    sofas = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 2, '')"
                       % (base['sofachair_silo']['id'], x, y) for x, y in SOFAS)
    plantilla = open(os.path.join(AQUI, 'guerra-vip.plantilla.sql'),
                     encoding='utf8').read()
    return plantilla.format(
        n=len(trampas), dx=PUERTA[0], dy=PUERTA[1], hm=heightmap,
        traps=filas, sofas=sofas, nsofas=len(SOFAS),
        dest=base['tile_stackmagic']['id'], rx=INICIO[0], ry=INICIO[1],
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
    print('\n  %d baldosas trampa\n' % len(trampas))
    dibujar(mapa, trampas)
    open(SALIDA, 'w', encoding='utf8').write(escribir_sql(mapa, trampas, base))
    print('\nEscrito: %s' % SALIDA)


if __name__ == '__main__':
    main()
