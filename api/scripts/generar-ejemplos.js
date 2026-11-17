import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { COLUMNAS_SIPE, NOMBRES_SIPE, RUBROS } from '../../shared/planillas.js';
const destino = new URL('../../web/public/ejemplos/', import.meta.url);
await mkdir(destino, { recursive: true });
const personas = [['María', 'Pérez', '1200.00'], ['Luis', 'Gómez', '1100.00'], ['Ana', 'Ríos', '980.50'], ['Carlos', 'Díaz', '1350.00'], ['Elena', 'Ruiz', '1050.00']];
for (const [archivo, valor, vacia] of [['sipe_referencia_correcta.xlsx', '0.00', false], ['sipe_referencia_con_observaciones.xlsx', 'cien', false], ['sipe_referencia_corregida.xlsx', '100.00', false], ['plantilla_referencia_25_columnas.xlsx', '', true]]) {
  const libro = new ExcelJS.Workbook(); libro.creator = 'Portal de Planillas';
  const hoja = libro.addWorksheet('Planilla');
  hoja.addRow(COLUMNAS_SIPE.map((c) => NOMBRES_SIPE[c]));
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2E59' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  if (!vacia) personas.forEach(([nombre, apellido, sueldo], i) => {
    const r = { tipo_documento: 'Cédula', numero_documento: `8-000-${1001 + i}`, numero_seguro_social: `00000${i + 1}`, nombre, apellido,
      ...Object.fromEntries(RUBROS.map(({ id }) => [id, '0.00'])), sueldo, horas_extras: i === 2 ? valor : i === 0 ? '30.00' : i === 3 ? '20.00' : '0.00' };
    hoja.addRow(COLUMNAS_SIPE.map((c) => r[c]));
  });
  hoja.columns.forEach((c, i) => { c.width = i < 5 ? 24 : Math.min(45, NOMBRES_SIPE[COLUMNAS_SIPE[i]].length + 4); });
  const notas = libro.addWorksheet('Referencia');
  notas.addRow(['Datos ficticios para recorrer la prevalidación del portal.']);
  notas.addRow(['Estructura de referencia de 25 columnas basada en el manual aportado; no acredita compatibilidad vigente con SIPE.']);
  notas.columns = [{ width: 120 }];
  await libro.xlsx.writeFile(new URL(archivo, destino).pathname); console.log(archivo);
}
