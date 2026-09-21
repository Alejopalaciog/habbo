# -*- coding: utf-8 -*-
"""Genera salas/guerra-vip.sql: la sala clásica de Guerra VIP.

Una sala plana de 104 baldosas con un camino en S. Los tramos seguros
alternan con carriles de baldosas que teletransportan al inicio, así que
desde cualquier punto del camino un solo empujón elimina. Al final, la zona
de combate y unos sofás para quien no quiera pelear.

Los identificadores de mueble se leen del volcado de Arcturus, no se
inventan. Antes de escribir nada comprueba que el laberinto tiene sentido.

Uso:  python3 salas/generar.py
"""
import os
import sys
from collections import deque

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

import lib_items  # noqa: E402  (necesita AQUI en sys.path)

VOLCADO = os.path.join(AQUI, '..', 'stack', 'mysql', 'dumps',
                       'arcturus_3.0.0-stable_base_database--compact.sql')
SALIDA = os.path.join(AQUI, 'guerra-vip.sql')

NECESARIOS = ('tile_stackmagic', 'sofachair_silo',
              'wf_trg_walks_on_furni', 'wf_act_teleport_to')

# Hacia dónde corren los carriles, en coordenadas de PANTALLA.
#
#   En isométrico, aumentar X se ve hacia abajo-derecha y aumentar Y hacia
#   abajo-izquierda. Los carriles de la sala original corren en diagonal
#   hacia arriba-derecha, que es el eje Y. Con 'x' salen girados 90 grados.
EJE_CARRILES = 'y'

# Sala plana: 13 x 8 = 104 baldosas, más un borde para las paredes.
LARGO, ANCHO_SALA = 13, 8


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
    """Diseña la sala con los carriles a lo largo de X, y la transpone si
    hace falta. Devuelve el mapa y un diccionario de zonas."""
    ancho, alto = LARGO + 2, ANCHO_SALA + 2
    x0, y0 = 1, 1
    x1, y1 = LARGO, ANCHO_SALA

    mapa = [['x'] * ancho for _ in range(alto)]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            mapa[y][x] = '0'

    puerta = (0, y1)                 # se entra por la esquina de delante
    inicio = (x0, y1)                # adonde devuelve el teletransporte
    esquina = (x0, y0)               # donde van los muebles wired
    combate = [(x, y0) for x in range(x0, x1 + 1)]
    sofas = [(x, y0) for x in range(x1 - 3, x1 + 1)]
    mapa[puerta[1]][puerta[0]] = '0'

    # Carriles trampa, con el codo de la S alternando de lado.
    trampas = []
    for fila, codo in ((y1 - 1, x1), (y1 - 3, x0), (y1 - 5, x1)):
        trampas += [(x, fila) for x in range(x0, x1 + 1) if x != codo]

    zonas = {'puerta': puerta, 'inicio': inicio, 'esquina': esquina,
             'combate': combate, 'sofas': sofas}

    if EJE_CARRILES == 'y':
        girado = [['x'] * alto for _ in range(ancho)]
        for y in range(alto):
            for x in range(ancho):
                girado[x][y] = mapa[y][x]
        mapa = girado
        ancho, alto = alto, ancho
        trampas = [(y, x) for x, y in trampas]
        for k, v in zonas.items():
            zonas[k] = (v[1], v[0]) if isinstance(v, tuple) else [(b, a) for a, b in v]

    return mapa, trampas, zonas, (ancho, alto)


def comprobar(mapa, trampas, zonas, medidas):
    ancho, alto = medidas
    peligro = set(trampas)
    seguras = {(x, y) for y in range(alto) for x in range(ancho)
               if mapa[y][x] != 'x' and (x, y) not in peligro}

    # 1) Se llega a la zona de combate sin pisar una sola trampa.
    puerta = zonas['puerta']
    vistos, cola = {puerta}, deque([puerta])
    while cola:
        x, y = cola.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p in seguras and p not in vistos:
                vistos.add(p)
                cola.append(p)
    if not all(p in vistos for p in zonas['combate']):
        sys.exit('No se llega a la zona de combate sin pisar trampas')
    print('  se llega al final por el camino seguro, sin pisar ninguna trampa')

    # 2) El camino está expuesto: cada tramo tiene trampa a ambos lados.
    lados = ((0, 1), (0, -1)) if EJE_CARRILES == 'x' else ((1, 0), (-1, 0))
    expuestas = sum(1 for p in seguras if p != puerta
                    and any((p[0] + dx, p[1] + dy) in peligro for dx, dy in lados))
    total = LARGO * ANCHO_SALA - len(trampas)
    print('  %d de %d baldosas seguras tienen una trampa pegada' % (expuestas, total))
    if expuestas < total * 0.5:
        sys.exit('El camino no está lo bastante expuesto')

    # 3) Exactamente 104 baldosas, sin contar el hueco de la puerta.
    suelo = sum(1 for y in range(alto) for x in range(ancho) if mapa[y][x] != 'x') - 1
    print('  la sala mide %d baldosas' % suelo)
    if suelo != LARGO * ANCHO_SALA:
        sys.exit('La sala debería medir %d baldosas' % (LARGO * ANCHO_SALA))


def dibujar(mapa, trampas, zonas, medidas):
    ancho, alto = medidas
    peligro, sofas = set(trampas), set(zonas['sofas'])
    combate = set(zonas['combate'])
    for y in range(alto):
        fila = ''
        for x in range(ancho):
            p = (x, y)
            if mapa[y][x] == 'x':
                fila += '.'
            elif p in peligro:
                fila += 'R'
            elif p in sofas:
                fila += 'A'
            elif p == zonas['inicio']:
                fila += 'I'
            elif p == zonas['esquina']:
                fila += 'W'
            elif p in combate:
                fila += 'P'
            else:
                fila += 'V'
        print('  %2d %s' % (y, fila))
    print('\n  . pared   V camino   R trampa   P combate   A sofá'
          '   I inicio   W wired')
    print('  en pantalla: X baja hacia la derecha, Y baja hacia la izquierda')


def escribir_sql(mapa, trampas, zonas, base):
    heightmap = '\\r\\n'.join(''.join(f) for f in mapa)
    rx, ry = zonas['inicio']
    wx, wy = zonas['esquina']
    filas = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 0, '')"
                       % (base['tile_stackmagic']['id'], x, y) for x, y in trampas)
    sofas = ",\n".join("       (@propietario, @sala, %d, %d, %d, 0, 2, '')"
                       % (base['sofachair_silo']['id'], x, y) for x, y in zonas['sofas'])
    plantilla = open(os.path.join(AQUI, 'guerra-vip.plantilla.sql'),
                     encoding='utf8').read()
    return plantilla.format(
        n=len(trampas), dx=zonas['puerta'][0], dy=zonas['puerta'][1],
        hm=heightmap, traps=filas, sofas=sofas, nsofas=len(zonas['sofas']),
        dest=base['tile_stackmagic']['id'], rx=rx, ry=ry,
        trg=base['wf_trg_walks_on_furni']['id'],
        act=base['wf_act_teleport_to']['id'], wx=wx, wy=wy,
        zact=base['wf_trg_walks_on_furni']['h'])


def main():
    base = catalogo()
    print('Muebles localizados en el catálogo:')
    for nombre in NECESARIOS:
        print('  %-24s id=%d' % (nombre, base[nombre]['id']))
    mapa, trampas, zonas, medidas = disenar()
    print('\nCarriles a lo largo del eje %s' % EJE_CARRILES.upper())
    print('\nComprobaciones:')
    comprobar(mapa, trampas, zonas, medidas)
    print('\n  %d baldosas trampa\n' % len(trampas))
    dibujar(mapa, trampas, zonas, medidas)
    open(SALIDA, 'w', encoding='utf8').write(escribir_sql(mapa, trampas, zonas, base))
    print('\nEscrito: %s' % SALIDA)


if __name__ == '__main__':
    main()
