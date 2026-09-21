-- =====================================================================
--  Sala "Guerra VIP" para Arcturus Morningstar
--
--  Sala plana de 13x8 (104 baldosas) con un camino en S: {n} baldosas
--  trampa, {nsofas} sofas y los dos muebles wired, ya colocados.
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
VALUES ('model_guerravip', {dx}, {dy}, 2, '{hm}', '', '0');

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

-- --- Baldosas trampa: los {n} carriles rojos ---------------------------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
{traps};

-- --- Sofas de la zona de descanso, al fondo ---------------------------
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
{sofas};

-- --- Destino del teletransporte: la baldosa de entrada -----------------
--  OJO: es una baldosa magica igual que las trampas, pero esta suelta en
--  la esquina de entrada. No la selecciones como trampa en el wired.
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, {dest}, {rx}, {ry}, 0, 0, '');

-- --- Muebles wired, apilados en la misma casilla ----------------------
--  Comparten casilla a proposito: es lo que los enlaza como un circuito.
INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES (@propietario, @sala, {trg}, {wx}, {wy}, 0, 0, ''),
       (@propietario, @sala, {act}, {wx}, {wy}, {zact}, 0, '');

SELECT @sala AS sala_creada,
       (SELECT COUNT(*) FROM items WHERE room_id <=> @sala) AS muebles_colocados;
