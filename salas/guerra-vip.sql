-- =====================================================================
--  Sala "Guerra VIP" para Arcturus Morningstar
--
--  Crea el mapa, la sala y las 23 piezas de trampa ya colocadas.
--  Los dos muebles wired quedan puestos pero SIN configurar: ese paso se
--  hace desde el cliente, en dos dialogos. Ver el README.
--
--  Generado por salas/generar.py -- no lo edites a mano.
--  Se puede ejecutar varias veces: borra su version anterior primero.
-- =====================================================================

-- Pon aqui tu nombre de usuario dentro del hotel.
SET @usuario := 'Alejo';

-- Si el usuario no existe, @propietario queda a NULL y no se inserta nada.
SET @propietario := (SELECT id FROM users WHERE username = @usuario);
SELECT IFNULL(@propietario, 'AVISO: ese usuario no existe. Revisa @usuario.') AS propietario;

-- --- Borrar una ejecucion anterior ------------------------------------
SET @vieja := (SELECT id FROM rooms
               WHERE name = 'Guerra VIP' AND owner_id <=> @propietario
               ORDER BY id DESC LIMIT 1);
DELETE FROM items WHERE room_id <=> @vieja;
DELETE FROM rooms WHERE id <=> @vieja;
DELETE FROM room_models WHERE name = 'model_guerravip';

-- --- Mapa de la sala --------------------------------------------------
--  x = sin suelo    0 = suelo    1 = plataforma o rampa
INSERT INTO room_models (name, door_x, door_y, door_dir, heightmap, public_items, club_only)
VALUES ('model_guerravip', 0, 37, 2, 'xxxxxxxxxxxxxxxxxxxxxx\r\nx00000000000000000000x\r\nx00000000000000000000x\r\nx00000000000000000000x\r\nx00000000000000000000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00001111111111110000x\r\nx00000000111100000000x\r\nx00000000111100000000x\r\nx00000000111100000000x\r\nx00000000111100000000x\r\nxxxxxxxxxxx11xxxxxxxxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000111111110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxx0000000011110000xxx\r\nxxxxxxxxxxx11xxxxxxxxx\r\nxxxxxxxxxxx11xxxxxxxxx\r\nxxxxxx0000000000xxxxxx\r\n0000000000000000xxxxxx\r\nxxxxxx0000000000xxxxxx\r\nxxxxxxxxxxxxxxxxxxxxxx', '', '0');

-- --- La sala ----------------------------------------------------------
--  allow_walkthrough = 0 es imprescindible: si los jugadores se atraviesan,
--  no hay empujones que valgan.
INSERT INTO rooms (owner_id, owner_name, name, description, model, state,
                   users_max, category, allow_walkthrough, move_diagonally)
SELECT id, username, 'Guerra VIP',
       'Empuja y tira. Quien pise las baldosas, vuelve al principio.',
       'model_guerravip', 'open', 25, 1, '0', '1'
FROM users WHERE username = @usuario;

SET @sala := (SELECT id FROM rooms
              WHERE name = 'Guerra VIP' AND owner_id <=> @propietario
              ORDER BY id DESC LIMIT 1);

-- --- Baldosas trampa: 23 piezas de 4x4 que cubren 368 casillas --------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
       (@propietario, @sala, 180, 1, 1, 0, 0, ''),
       (@propietario, @sala, 180, 5, 1, 0, 0, ''),
       (@propietario, @sala, 180, 9, 1, 0, 0, ''),
       (@propietario, @sala, 180, 13, 1, 0, 0, ''),
       (@propietario, @sala, 180, 17, 1, 0, 0, ''),
       (@propietario, @sala, 180, 1, 5, 0, 0, ''),
       (@propietario, @sala, 180, 17, 5, 0, 0, ''),
       (@propietario, @sala, 180, 1, 9, 0, 0, ''),
       (@propietario, @sala, 180, 17, 9, 0, 0, ''),
       (@propietario, @sala, 180, 1, 13, 0, 0, ''),
       (@propietario, @sala, 180, 5, 13, 0, 0, ''),
       (@propietario, @sala, 180, 13, 13, 0, 0, ''),
       (@propietario, @sala, 180, 17, 13, 0, 0, ''),
       (@propietario, @sala, 180, 3, 18, 0, 0, ''),
       (@propietario, @sala, 180, 7, 18, 0, 0, ''),
       (@propietario, @sala, 180, 15, 18, 0, 0, ''),
       (@propietario, @sala, 180, 3, 22, 0, 0, ''),
       (@propietario, @sala, 180, 15, 22, 0, 0, ''),
       (@propietario, @sala, 180, 3, 26, 0, 0, ''),
       (@propietario, @sala, 180, 15, 26, 0, 0, ''),
       (@propietario, @sala, 180, 3, 30, 0, 0, ''),
       (@propietario, @sala, 180, 7, 30, 0, 0, ''),
       (@propietario, @sala, 180, 15, 30, 0, 0, '');

-- --- Destino del teletransporte, en la zona segura --------------------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, 5103, 11, 37, 0, 0, '');

-- --- Muebles wired, apilados en la misma casilla ----------------------
--  Comparten casilla a proposito: es lo que los enlaza como un circuito.
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, 3703, 8, 37, 0, 0, ''),
       (@propietario, @sala, 3674, 8, 37, 0.65, 0, '');

SELECT @sala AS sala_creada,
       (SELECT COUNT(*) FROM items WHERE room_id <=> @sala) AS muebles_colocados;
