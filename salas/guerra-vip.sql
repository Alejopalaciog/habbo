-- =====================================================================
--  Sala "Guerra VIP" para Arcturus Morningstar
--
--  Sala plana de 13x8 (104 baldosas) con un camino en S: 36 baldosas
--  trampa, 4 sofas y los dos muebles wired, ya colocados.
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
VALUES ('model_guerravip', 8, 1, 2, 'xxxxxxxxxx\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nx00000000x\r\nxxxxxxxxxx', '', '0');

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

-- --- Baldosas trampa: los 36 carriles rojos ---------------------------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
       (@propietario, @sala, 132, 7, 1, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 2, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 3, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 4, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 5, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 6, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 7, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 8, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 9, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 10, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 11, 0, 0, '0'),
       (@propietario, @sala, 132, 7, 12, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 2, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 3, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 4, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 5, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 6, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 7, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 8, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 9, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 10, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 11, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 12, 0, 0, '0'),
       (@propietario, @sala, 132, 5, 13, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 1, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 2, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 3, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 4, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 5, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 6, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 7, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 8, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 9, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 10, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 11, 0, 0, '0'),
       (@propietario, @sala, 132, 3, 12, 0, 0, '0');

-- --- Sofas de la zona de descanso, al fondo ---------------------------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
       (@propietario, @sala, 36, 1, 10, 0, 2, ''),
       (@propietario, @sala, 36, 1, 11, 0, 2, ''),
       (@propietario, @sala, 36, 1, 12, 0, 2, ''),
       (@propietario, @sala, 36, 1, 13, 0, 2, '');

-- --- Destino del teletransporte: la alfombra de la entrada -------------
--  Es una alfombra, distinta a simple vista de las baldosas trampa, para
--  no confundirlas al seleccionarlas en el wired.
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, 9901, 8, 2, 0, 0, '');

-- --- Muebles wired, apilados en la misma casilla ----------------------
--  Comparten casilla a proposito: es lo que los enlaza como un circuito.
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, 3703, 1, 1, 0, 0, ''),
       (@propietario, @sala, 3674, 1, 1, 0.65, 0, '');

SELECT @sala AS sala_creada,
       (SELECT COUNT(*) FROM items WHERE room_id <=> @sala) AS muebles_colocados;
