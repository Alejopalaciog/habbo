# Salas

Salas generadas para el hotel. Se cargan con:

```
hotel.cmd sala <nombre> [usuario]
```

| Archivo | Qué es |
| --- | --- |
| `guerra-vip.sql` | La sala Guerra VIP, lista para cargar |
| `guerra-vip.plantilla.sql` | Plantilla del SQL, con huecos que rellena el generador |
| `generar.py` | Genera el SQL: diseña el mapa, lo comprueba y lo escribe |

El SQL **no se edita a mano**: se regenera con `python3 salas/generar.py`, que
lee los identificadores de mueble del volcado de Arcturus en `stack/`, así que
no hay números inventados.

Antes de escribir nada, el generador comprueba dos cosas:

- que cada baldosa de 4x4 se apoya en suelo de altura uniforme, porque si no
  no se puede colocar;
- que desde la puerta se llega a las dos arenas y al punto de reaparición,
  recorriendo el mapa y respetando que solo se sube un nivel de golpe.

Si alguna falla, aborta sin tocar el SQL.
