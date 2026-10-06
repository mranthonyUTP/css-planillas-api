// Pruebas de la API de punta a punta con fetch nativo (sin Supertest).
// Corren contra el almacenamiento en memoria y, si existe TEST_DATABASE_URL, también contra PostgreSQL.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { crearApp } from '../src/app.js';
import { crearStoreMemoria } from '../src/store/memoria.js';
import { crearStorePostgres } from '../src/store/postgres.js';

const CORRECTA = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-123-456,Ana Ríos,1250.00,30,2411\nPE-12-345,Luis Pérez,980.50,28,4110\n';
const CON_ERRORES = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-1234-,Ana Ríos,,32,X99\n';

const almacenes = [['memoria', async () => crearStoreMemoria()]];
if (process.env.TEST_DATABASE_URL) almacenes.push(['postgres', () => crearStorePostgres(process.env.TEST_DATABASE_URL)]);

for (const [nombre, crearStore] of almacenes) {
  describe(`API con almacenamiento ${nombre}`, () => {
    let servidor;
    let base;
    let store;

    before(async () => {
      store = await crearStore();
      servidor = crearApp({ store }).listen(0);
      base = `http://localhost:${servidor.address().port}`;
    });
    after(async () => {
      servidor.close();
      await store.cerrar();
    });

    const ingresar = async (ruc = `RUC-${randomUUID().slice(0, 8)}`) => {
      const r = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc, usuario: 'contabilidad', clave: 'demo' }),
      });
      assert.equal(r.status, 200);
      return (await r.json()).token;
    };

    const validar = (token, contenido, nombreArchivo = 'planilla.csv', periodo = '2026-10') => {
      const form = new FormData();
      form.append('archivo', new Blob([contenido]), nombreArchivo);
      form.append('periodo', periodo);
      form.append('tipo', 'Regular');
      return fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    };

    const enviar = (token, validacionId, clave) =>
      fetch(`${base}/planillas/enviar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': clave },
        body: JSON.stringify({ validacionId }),
      });

    test('GET /salud responde ok', async () => {
      const r = await fetch(`${base}/salud`);
      assert.equal((await r.json()).estado, 'ok');
    });

    test('login rechaza credenciales vacías', async () => {
      const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ruc":""}' });
      assert.equal(r.status, 400);
    });

    test('HU-07: sin token o con token falso responde 401', async () => {
      assert.equal((await fetch(`${base}/cargas`)).status, 401);
      assert.equal((await fetch(`${base}/cargas`, { headers: { Authorization: 'Bearer falso' } })).status, 401);
    });

    test('HU-05 y HU-06: una planilla con errores devuelve fila, campo y motivo', async () => {
      const r = await validar(await ingresar(), CON_ERRORES);
      assert.equal(r.status, 200);
      const v = await r.json();
      assert.equal(v.valida, false);
      assert.equal(v.filasConError, 1);
      assert.ok(v.errores.length >= 4);
      assert.deepEqual(Object.keys(v.errores[0]).sort(), ['campo', 'fila', 'problema', 'solucion', 'valor']);
      assert.equal(v.errores[0].fila, 2);
      assert.equal(v.empresaRuc, undefined);
    });

    test('HU-05: valida archivos .xlsx', async () => {
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet('Planilla');
      hoja.addRow(['Cédula', 'Nombre', 'Salario', 'Días laborados', 'Código ocupación']);
      hoja.addRow(['8-123-456', 'Ana Ríos', 1250, 30, '2411']);
      const buffer = await libro.xlsx.writeBuffer();
      const r = await validar(await ingresar(), buffer, 'planilla.xlsx');
      const v = await r.json();
      assert.equal(r.status, 200, JSON.stringify(v));
      assert.equal(v.valida, true);
      assert.equal(v.totalSalarios, 1250);
    });

    test('rechaza formatos no admitidos y períodos inválidos', async () => {
      const token = await ingresar();
      assert.equal((await validar(token, 'x', 'planilla.pdf')).status, 400);
      assert.equal((await validar(token, CORRECTA, 'planilla.csv', '2026-13')).status, 400);
    });

    test('HU-08 y HU-12: el envío es idempotente y genera un comprobante', async () => {
      const token = await ingresar();
      const v = await (await validar(token, CORRECTA)).json();
      assert.equal(v.valida, true);
      const clave = randomUUID();

      const r1 = await enviar(token, v.id, clave);
      assert.equal(r1.status, 201);
      const e1 = await r1.json();
      assert.match(e1.confirmacion, /^PL-2026-10-\d{6}$/);

      const r2 = await enviar(token, v.id, clave);
      assert.equal(r2.status, 200);
      const e2 = await r2.json();
      assert.equal(e2.confirmacion, e1.confirmacion);
      assert.equal(e2.repetido, true);

      // La misma validación con otra clave no crea un segundo envío.
      assert.equal((await enviar(token, v.id, randomUUID())).status, 409);
    });

    test('HU-12: no se puede enviar una planilla con errores', async () => {
      const token = await ingresar();
      const v = await (await validar(token, CON_ERRORES)).json();
      assert.equal((await enviar(token, v.id, randomUUID())).status, 409);
    });

    test('HU-08: exige la cabecera Idempotency-Key', async () => {
      const token = await ingresar();
      const v = await (await validar(token, CORRECTA)).json();
      assert.equal((await enviar(token, v.id, '')).status, 400);
    });

    test('HU-07: una empresa no puede enviar la validación de otra', async () => {
      const v = await (await validar(await ingresar(), CORRECTA)).json();
      assert.equal((await enviar(await ingresar(), v.id, randomUUID())).status, 404);
    });

    test('HU-11: el historial registra cada carga solo para su empresa', async () => {
      const token = await ingresar();
      const v = await (await validar(token, CORRECTA)).json();
      await validar(token, CON_ERRORES);
      await enviar(token, v.id, randomUUID());

      const cargas = await (await fetch(`${base}/cargas`, { headers: { Authorization: `Bearer ${token}` } })).json();
      assert.deepEqual(cargas.map((c) => c.resultado), ['Enviada', 'Con errores', 'Sin errores']);
      assert.ok(cargas.every((c) => c.usuario === 'contabilidad' && c.fecha));

      const otra = await (await fetch(`${base}/cargas`, { headers: { Authorization: `Bearer ${await ingresar()}` } })).json();
      assert.equal(otra.length, 0);
    });
  });
}
