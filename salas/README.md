# Salas

Salas generadas para el hotel. Se cargan con:

```
hotel.cmd sala <nombre> [usuario]
```

| Archivo | Qué es |
| --- | --- |
| `muestrario.sql` | Sala con todas las baldosas del catálogo, para elegir a ojo |
| `generar-muestrario.py` | La genera a partir del catálogo |
| `publicas.sql` | Las 17 salas públicas del hotel |
| `generar-publicas.py` | Las genera, verificando que cada modelo exista |
| `guerra-vip.sql` | La sala Guerra VIP, lista para cargar |
| `guerra-vip.plantilla.sql` | Plantilla del SQL, con huecos que rellena el generador |
| `generar.py` | Genera el SQL: diseña el mapa, lo comprueba y lo escribe |
| `lib_items.py` | Lectura del catálogo de muebles de Arcturus |

El SQL **no se edita a mano**: se regenera con `python3 salas/generar.py`, que
lee los identificadores de mueble del volcado de Arcturus en `stack/`, así que
no hay números inventados.

Antes de escribir nada, el generador comprueba tres cosas:

- que desde la puerta se llega a la zona de combate **sin pisar una sola
  trampa**, recorriendo solo las baldosas seguras: si el camino en S se
  rompe, la sala no tendría solución;
- que el camino es de verdad peligroso, contando cuántas baldosas seguras
  tienen una trampa pegada al norte o al sur;
- que la sala mide exactamente 104 baldosas, como la original.

Si alguna falla, aborta sin tocar el SQL.

Los comentarios al final de las líneas de un `VALUES` no pueden llevar el
punto y coma pegado: quedaría comentado y la sentencia se fundiría con la
siguiente. El validador de `guerra-vip.sql` pilló exactamente eso.

`lib_items.py` lee el catálogo de muebles del volcado. Tiene su propio
analizador porque los nombres traen comillas escapadas que descuadran
cualquier separación ingenua por comas.
