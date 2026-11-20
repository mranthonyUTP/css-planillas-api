import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { crearApp } from '../src/app.js';
import { emitirToken } from '../src/auth.js';
import { crearStoreMemoria } from '../src/store/memoria.js';
import { crearStorePostgres } from '../src/store/postgres.js';
import { COLUMNAS_SIPE } from '../../shared/planillas.js';

const encabezado = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n';
const referencia = encabezado + '8-000-1001,María Pérez,1200.00,30,2411\n8-000-1002,Luis Gómez,1100.00,30,2411\n8-000-1003,Ana Ríos,980.50,30,2411\n';
const planilla = referencia.replace('1200.00', '1250.00').replace('8-000-1003,Ana Ríos,980.50', '8-000-1004,Carlos Ruiz,1350.00');
for (const modo of ['memoria', ...(process.env.TEST_DATABASE_URL ? ['postgres'] : [])]) test(`API: contraste, corrección, aislamiento y recuperación · ${modo}`, async () => {
  let store = modo === 'postgres' ? await crearStorePostgres(process.env.TEST_DATABASE_URL) : crearStoreMemoria();
  const servidor = crearApp({ store }).listen(0);
  await new Promise(r => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const ruc = `contraste-${randomUUID()}`;
  const token = await emitirToken({ ruc, usuario: 'piloto', empresa: 'Datos sintéticos', roles: ['ELABORADOR'], empresas: [{ ruc, nombre: 'Datos sintéticos' }] });
  const ajeno = await emitirToken({ ruc: 'ajena', usuario: 'ajeno', empresa: 'Ajena', roles: ['ELABORADOR'], empresas: [{ ruc: 'ajena', nombre: 'Ajena' }] });
  const enviar = async ({ contenido = planilla, ref = referencia, serieId, extension = 'csv', auth = token } = {}) => {
    const form = new FormData(); form.append('archivo', new Blob([contenido]), `planilla.${extension}`);
    if (ref !== null) form.append('referencia', new Blob([ref]), `referencia.${extension}`);
    form.append('periodo', '2026-11'); form.append('tipo', 'Regular'); if (serieId) form.append('serieId', serieId);
    return fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: form });
  };
  try {
    const respuesta = await enviar(); assert.equal(respuesta.status, 200);
    const a = await respuesta.json(); assert.equal(a.contraste.diferencias.length, 3); assert.equal(a.valida, true);
    const b = await (await enviar({ contenido: referencia, serieId: a.serieId })).json();
    assert.equal(b.serieId, a.serieId); assert.equal(b.numero, 2); assert.equal(b.contraste.diferencias.length, 0);
    const detalle = await (await fetch(`${base}/planillas/${a.serieId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal(detalle.intentos[0].contraste.diferencias.length, 3); assert.equal(detalle.intentos[1].contraste.sinDiferencias.length, 3);
    assert.equal((await fetch(`${base}/planillas/${a.serieId}`, { headers: { Authorization: `Bearer ${ajeno}` } })).status, 404);
    assert.equal((await enviar({ serieId: a.serieId, auth: ajeno })).status, 404);
    assert.equal((await (await enviar({ ref: null })).json()).contraste.estado, 'no_realizado');
    assert.equal((await (await enviar({ ref: referencia + '8-000-1001,Repetido,1200,30,2411\n' })).json()).contraste.estado, 'no_comparable');
    assert.equal((await (await enviar({ ref: 'otra,columna\n1,2' })).json()).contraste.estado, 'no_comparable');
    if (modo === 'postgres') {
      const otraConexion = await crearStorePostgres(process.env.TEST_DATABASE_URL);
      try { const recuperada = await otraConexion.obtenerPlanilla(a.serieId, [ruc]); assert.deepEqual(recuperada.intentos[0].contraste, a.contraste); }
      finally { await otraConexion.cerrar(); }
    }
    const excel = async (sueldo) => {
      const libro = new ExcelJS.Workbook(), hoja = libro.addWorksheet('Planilla'); hoja.addRow(COLUMNAS_SIPE);
      hoja.addRow(COLUMNAS_SIPE.map(c => ({ tipo_documento: 'Cédula', numero_documento: '8-000-1001', nombre: 'María', apellido: 'Pérez', sueldo })[c] ?? ''));
      return libro.xlsx.writeBuffer();
    };
    const x = await enviar({ contenido: await excel('1250.00'), ref: await excel('1200.00'), extension: 'xlsx' });
    assert.equal(x.status, 200); const datos = await x.json(); assert.equal(datos.contraste.diferencias[0].codigo, 'SUELDO_DISTINTO');
  } finally { await new Promise(r => servidor.close(r)); await store.cerrar(); }
});
