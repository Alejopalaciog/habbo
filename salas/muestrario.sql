-- =====================================================================
--  Muestrario de baldosas
--
--  Una sala con las 30 baldosas 1x1 planas y pisables del catalogo,
--  separadas para poder distinguirlas. Haz clic en cada una para ver su
--  nombre, y dime cuales quieres para el camino y para los carriles.
--
--  Generado por salas/generar-muestrario.py -- no lo edites a mano.
-- =====================================================================

SET @usuario := 'Alejo';
SET @propietario := (SELECT id FROM users WHERE username = @usuario);
SELECT IFNULL(@propietario, 'AVISO: ese usuario no existe. Revisa @usuario.') AS propietario;

SET @vieja := (SELECT id FROM rooms
               WHERE name = 'Muestrario de baldosas' AND owner_id <=> @propietario
               ORDER BY id DESC LIMIT 1);
DELETE FROM items WHERE room_id <=> @vieja;
DELETE FROM rooms WHERE id <=> @vieja;
DELETE FROM room_models WHERE name = 'model_muestrario';

INSERT INTO room_models (name, door_x, door_y, door_dir, heightmap, public_items, club_only)
VALUES ('model_muestrario', 1, 11, 2, 'xxxxxxxxxxxxxxx\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nx0000000000000x\r\nxxxxxxxxxxxxxxx', '', '0');

INSERT INTO rooms (owner_id, owner_name, name, description, model, state, users_max)
SELECT id, username, 'Muestrario de baldosas',
       'Cada baldosa del catalogo, para elegir colores a ojo.',
       'model_muestrario', 'open', 10
FROM users WHERE username = @usuario;

SET @sala := (SELECT id FROM rooms
              WHERE name = 'Muestrario de baldosas' AND owner_id <=> @propietario
              ORDER BY id DESC LIMIT 1);

INSERT INTO items (user_id, room_id, item_id, x, y, z, rot, extra_data)
VALUES
       (@propietario, @sala, 132, 1, 1, 0, 0, '0')  -- floortile,
       (@propietario, @sala, 2609, 3, 1, 0, 0, '0')  -- carpet_soft_tut,
       (@propietario, @sala, 3713, 5, 1, 0, 0, '0')  -- es_icestar,
       (@propietario, @sala, 3731, 7, 1, 0, 0, '0')  -- es_icestar_g,
       (@propietario, @sala, 3745, 9, 1, 0, 0, '0')  -- es_icestar_r,
       (@propietario, @sala, 3749, 11, 1, 0, 0, '0')  -- es_icestar_y,
       (@propietario, @sala, 4493, 1, 3, 0, 0, '0')  -- theatre_carpet,
       (@propietario, @sala, 4495, 3, 3, 0, 0, '0')  -- theatre_rug,
       (@propietario, @sala, 4501, 5, 3, 0, 0, '0')  -- theatre_floor,
       (@propietario, @sala, 4530, 7, 3, 0, 0, '0')  -- wl_floor,
       (@propietario, @sala, 4535, 9, 3, 0, 0, '0')  -- pcnc_tilegrass,
       (@propietario, @sala, 4540, 11, 3, 0, 0, '0')  -- pcnc_tiledirt,
       (@propietario, @sala, 4550, 1, 5, 0, 0, '0')  -- pcnc_tilestone,
       (@propietario, @sala, 4819, 3, 5, 0, 0, '0')  -- xmas12_cfloor,
       (@propietario, @sala, 5287, 5, 5, 0, 0, '0')  -- hween13_gutsfloor,
       (@propietario, @sala, 5745, 7, 5, 0, 0, '0')  -- ads_nick_faketile,
       (@propietario, @sala, 5766, 9, 5, 0, 0, '0')  -- effect_faketile,
       (@propietario, @sala, 6328, 11, 5, 0, 0, '0')  -- ny2015_floor2,
       (@propietario, @sala, 6336, 1, 7, 0, 0, '0')  -- ny2015_floor1,
       (@propietario, @sala, 8250, 3, 7, 0, 0, '0')  -- greek_c15_tile,
       (@propietario, @sala, 8930, 5, 7, 0, 0, '0')  -- jungle_c16_tallgrass,
       (@propietario, @sala, 9057, 7, 7, 0, 0, '0')  -- garden_stonesteps,
       (@propietario, @sala, 9172, 9, 7, 0, 0, '0')  -- hween_c16_floor2,
       (@propietario, @sala, 9176, 11, 7, 0, 0, '0')  -- hween_c16_floor,
       (@propietario, @sala, 9538, 1, 9, 0, 0, '0')  -- modern_c17_floorlamp,
       (@propietario, @sala, 9901, 3, 9, 0, 0, '0')  -- classic8_rug,
       (@propietario, @sala, 9916, 5, 9, 0, 0, '0')  -- classic8_floor,
       (@propietario, @sala, 10263, 7, 9, 0, 0, '0')  -- hween_c18_floormould,
       (@propietario, @sala, 10379, 9, 9, 0, 0, '0')  -- xmas_c18_rainlightfloor,
       (@propietario, @sala, 10935, 11, 9, 0, 0, '0')  -- xmas_c19_iceshards
;

SELECT @sala AS sala_creada,
       (SELECT COUNT(*) FROM items WHERE room_id <=> @sala) AS baldosas_colocadas;
