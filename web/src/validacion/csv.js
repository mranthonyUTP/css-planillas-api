// Lector de CSV simple para el modo simulado.
// Soporta comillas dobles, comas dentro de comillas y saltos de línea \n o \r\n.
// La API real usará csv-parse y exceljs (ver CLAUDE.md).

export function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;

  const limpio = texto.replace(/^﻿/, '');

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        enComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  const noVacias = filas.filter((f) => f.some((v) => v.trim() !== ''));
  if (noVacias.length === 0) return { encabezados: [], registros: [] };

  const encabezados = noVacias[0].map((h) => normalizarEncabezado(h));
  const registros = noVacias.slice(1).map((valores) => {
    const registro = {};
    encabezados.forEach((h, idx) => {
      registro[h] = (valores[idx] ?? '').trim();
    });
    return registro;
  });
  return { encabezados, registros };
}

function normalizarEncabezado(h) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}
