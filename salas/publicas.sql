-- =====================================================================
--  Salas publicas del hotel
--
--  Arcturus trae los 60 modelos de las salas publicas clasicas, pero
--  ninguna sala creada con ellos y `navigator_publics` vacia: por eso el
--  navegador aparece sin salas oficiales.
--
--  Generado por salas/generar-publicas.py -- no lo edites a mano.
--  Se puede ejecutar varias veces: borra su version anterior primero.
-- =====================================================================

SELECT COUNT(*) AS cuenta_de_sistema_encontrada FROM users WHERE username = 'Systemaccount';

-- --- Borrar las salas publicas creadas por este script -----------------
--  Solo las suyas: se reconocen por ser publicas y de la cuenta de
--  sistema. Las salas que hayas creado tu no se tocan.
DELETE np FROM navigator_publics np
  JOIN rooms r ON r.id = np.room_id
 WHERE r.is_public = '1' AND r.owner_name = 'Systemaccount';
DELETE i FROM items i
  JOIN rooms r ON r.id = i.room_id
 WHERE r.is_public = '1' AND r.owner_name = 'Systemaccount';
DELETE FROM rooms WHERE is_public = '1' AND owner_name = 'Systemaccount';

-- --- Crear las 17 salas ------------------------------------------------
--  Si la cuenta de sistema no existiera, no se insertaria ninguna.
INSERT INTO rooms (owner_id, owner_name, name, description, model, state,
                   users_max, is_public)
SELECT id, username, 'Vestíbulo', 'La entrada del hotel. Por aquí empieza todo.', 'newbie_lobby', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'La Guarida', 'El sitio de siempre para quedar.', 'the_den', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'El Pub', 'Una caña y a charlar.', 'pub_a', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Cibercafé', 'Ordenadores, café y ruido de teclas.', 'netcafe', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'La Azotea', 'Vistas del hotel desde arriba.', 'rooftop', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Azotea Norte', 'La otra azotea, más tranquila.', 'rooftop_2', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Star Lounge', 'Sofás, luces y música.', 'star_lounge', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Salón de Té', 'Para conversaciones largas.', 'tearoom', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Pizzería', 'Huele bien desde la puerta.', 'pizza', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Discoteca', 'La pista no para.', 'old_skool', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Salón Polvoriento', 'Nadie ha pasado la escoba en años.', 'dusty_lounge', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Jardín Oriental', 'Silencio y agua corriendo.', 'orient', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'El Parque', 'Aire libre dentro del hotel.', 'park_a', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Zona de Picnic', 'Manta, cesta y sitio de sobra.', 'picnic', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Cine', 'La sesión está a punto de empezar.', 'cinema_a', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Teatro', 'Escenario libre: sube y actúa.', 'theater', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount'
UNION ALL
SELECT id, username, 'Infobús', 'El autobús de siempre.', 'infobus_bus', 'open', 50, '1'
  FROM users WHERE username = 'Systemaccount';

-- --- Publicarlas en el navegador ---------------------------------------
INSERT INTO navigator_publics (public_cat_id, room_id, visible)
SELECT CASE model
           WHEN 'newbie_lobby' THEN 1
           WHEN 'the_den' THEN 1
           WHEN 'pub_a' THEN 1
           WHEN 'netcafe' THEN 1
           WHEN 'rooftop' THEN 1
           WHEN 'rooftop_2' THEN 1
           WHEN 'star_lounge' THEN 1
           WHEN 'tearoom' THEN 1
           WHEN 'pizza' THEN 1
           WHEN 'old_skool' THEN 1
           WHEN 'dusty_lounge' THEN 1
           WHEN 'orient' THEN 1
           WHEN 'park_a' THEN 1
           WHEN 'picnic' THEN 1
           WHEN 'cinema_a' THEN 2
           WHEN 'theater' THEN 2
           WHEN 'infobus_bus' THEN 2
           ELSE 1 END,
       id, '1'
  FROM rooms
 WHERE is_public = '1' AND owner_name = 'Systemaccount';

SELECT COUNT(*) AS salas_publicas_creadas
  FROM rooms WHERE is_public = '1' AND owner_name = 'Systemaccount';
