// Lector de CSV simple para el modo simulado.
// Soporta comillas dobles, comas dentro de comillas y saltos de línea \n o \r\n.
// La API real usará csv-parse y exceljs (ver CLAUDE.md).

import { normalizarEncabezado } from '../../../shared/planillas.js';
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

  const noVacias = filas.map((valores, indice) => ({ valores, numero: indice + 1 })).filter(({ valores }) => valores.some((v) => v.trim() !== ''));
  if (noVacias.length === 0) return { encabezados: [], registros: [] };

  if (enComillas) throw new Error('Hay comillas sin cerrar en el archivo CSV.');
  if (noVacias.length > 10001) throw new Error('El archivo supera el límite técnico de 10 000 registros.');
  const encabezados = noVacias[0].valores.map(normalizarEncabezado);
  while (encabezados.at(-1) === '') encabezados.pop();
  const registros = noVacias.slice(1).map(({ valores, numero }) => {
    const registro = { __fila: numero };
    encabezados.forEach((h, idx) => {
      registro[h] = (valores[idx] ?? '').trim();
    });
    return registro;
  });
  return { encabezados, registros, filaEncabezado: noVacias[0].numero };
}
