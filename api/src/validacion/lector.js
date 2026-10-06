// Lee una planilla .csv (csv-parse) o .xlsx (exceljs) y la devuelve como encabezados + registros.
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { solicitudInvalida } from '../errores.js';

export function normalizarEncabezado(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

function construir(filas) {
  const noVacias = filas.filter((f) => f.some((v) => String(v ?? '').trim() !== ''));
  if (noVacias.length === 0) return { encabezados: [], registros: [] };
  const encabezados = noVacias[0].map(normalizarEncabezado);
  const registros = noVacias.slice(1).map((valores) =>
    Object.fromEntries(encabezados.map((h, i) => [h, String(valores[i] ?? '').trim()])),
  );
  return { encabezados, registros };
}

export function leerCsv(buffer) {
  try {
    const filas = parse(buffer, { bom: true, relax_column_count: true, skip_empty_lines: true });
    return construir(filas);
  } catch {
    throw solicitudInvalida('No pudimos leer el archivo CSV. Revisa que esté separado por comas.');
  }
}

function textoCelda(celda) {
  const v = celda.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '');
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

export async function leerXlsx(buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw solicitudInvalida('No pudimos leer el archivo Excel. Guárdalo como .xlsx e intenta de nuevo.');
  }
  const hoja = libro.worksheets[0];
  if (!hoja) return { encabezados: [], registros: [] };
  const filas = [];
  const columnas = hoja.columnCount;
  hoja.eachRow({ includeEmpty: true }, (fila) => {
    const valores = [];
    for (let c = 1; c <= columnas; c++) valores.push(textoCelda(fila.getCell(c)));
    filas.push(valores);
  });
  return construir(filas);
}

export async function leerPlanilla(nombre, buffer) {
  const n = nombre.toLowerCase();
  if (n.endsWith('.csv')) return leerCsv(buffer);
  if (n.endsWith('.xlsx')) return leerXlsx(buffer);
  throw solicitudInvalida('Formato no admitido. Usa un archivo .xlsx o .csv.');
}
