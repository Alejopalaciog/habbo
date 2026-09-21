# -*- coding: utf-8 -*-
"""Lectura robusta de INSERT INTO items_base, con comillas escapadas."""
import re


def _tuplas(texto):
    """Devuelve las tuplas de un VALUES respetando comillas y escapes."""
    fuera, i, n = [], 0, len(texto)
    while i < n:
        if texto[i] != '(':
            i += 1
            continue
        i += 1
        campos, actual, en_cadena = [], '', False
        while i < n:
            c = texto[i]
            if en_cadena:
                if c == '\\':
                    actual += texto[i:i + 2]
                    i += 2
                    continue
                if c == "'":
                    en_cadena = False
                actual += c
            elif c == "'":
                en_cadena = True
                actual += c
            elif c == ',':
                campos.append(actual)
                actual = ''
            elif c == ')':
                campos.append(actual)
                i += 1
                break
            else:
                actual += c
            i += 1
        fuera.append(campos)
    return fuera


def leer(ruta):
    sql = open(ruta, encoding='utf8', errors='replace').read()
    cols = re.search(r"CREATE TABLE `items_base` \((.*?)\n\) ENGINE", sql, re.S).group(1)
    nombres = re.findall(r"^\s*`([a-z_0-9]+)`", cols, re.M)
    ins = "".join(re.findall(r"INSERT INTO `items_base` VALUES (.*?);\n", sql, re.S))
    muebles = []
    for campos in _tuplas(ins):
        if len(campos) != len(nombres):
            continue
        d = {}
        for k, v in zip(nombres, campos):
            v = v.strip()
            d[k] = v[1:-1] if v.startswith("'") and v.endswith("'") else v
        muebles.append(d)
    return muebles
