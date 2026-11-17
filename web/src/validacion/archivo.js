import { readSheet } from 'read-excel-file/browser';
import { leerCsv } from './csv.js';
import { normalizarEncabezado } from '../../../shared/planillas.js';

export async function leerArchivo(archivo) {
  if (archivo.size > 5 * 1024 * 1024) throw new Error('El archivo supera el máximo de 5 MB.');
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.csv')) return leerCsv(await archivo.text());
  if (!nombre.endsWith('.xlsx')) throw new Error('Selecciona un archivo Excel .xlsx o CSV.');
  let filas;
  try { filas = await readSheet(archivo, { trim: true }); }
  catch { throw new Error('No pudimos leer el Excel. Guárdalo como .xlsx y vuelve a intentarlo.'); }
  if (filas.length > 10001 || filas.some((f) => f.length > 100)) throw new Error('El archivo supera el límite técnico de filas o columnas.');
  const conNumero = filas.map((valores, i) => ({ valores, numero: i + 1 })).filter(({ valores }) => valores.some((v) => v !== null && String(v).trim() !== ''));
  if (!conNumero.length) return { encabezados: [], registros: [] };
  const texto = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim();
  const encabezados = conNumero[0].valores.map(normalizarEncabezado);
  while (encabezados.at(-1) === '') encabezados.pop();
  return { encabezados, filaEncabezado: conNumero[0].numero,
    registros: conNumero.slice(1).map(({ valores, numero }) => ({ ...Object.fromEntries(encabezados.map((h, i) => [h, texto(valores[i])])), __fila: numero })) };
}
