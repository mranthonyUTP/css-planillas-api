import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { crearApp } from '../src/app.js';
import { emitirToken } from '../src/auth.js';
import { crearStoreMemoria } from '../src/store/memoria.js';
import { crearStorePostgres } from '../src/store/postgres.js';

const CSV = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-123-456,Ana Ríos,1250.00,30,2411\nPE-12-345,Luis Pérez,980.50,28,4110\n';
const almacenes = [['memoria', async () => crearStoreMemoria()]];
if (process.env.TEST_DATABASE_URL) almacenes.push(['postgres', () => crearStorePostgres(process.env.TEST_DATABASE_URL)]);

for (const [nombre, crearStore] of almacenes) describe(`Flujo y permisos · ${nombre}`, () => {
  let servidor, base, store;
  before(async () => {
    store = await crearStore(); servidor = crearApp({ store }).listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(async () => { await new Promise((resolve) => servidor.close(resolve)); await store.cerrar(); });
  const credenciales = async () => {
    const ruc = `empresa-${randomUUID()}`, otra = `empresa-${randomUUID()}`;
    const token = (rol, empresaRuc = ruc, empresas = [ruc]) => emitirToken({ ruc: empresaRuc, usuario: rol.toLowerCase(), empresa: empresaRuc, roles: [rol], empresas: empresas.map((e) => ({ ruc: e, nombre: e })) });
    return { ruc, otra, elaborador: await token('ELABORADOR'), ajeno: await token('ELABORADOR', otra, [otra]) };
  };
  const get = (ruta, token) => fetch(`${base}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const post = (ruta, token, cuerpo = {}, clave = randomUUID()) => fetch(`${base}${ruta}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': clave }, body: JSON.stringify(cuerpo) });
  const cargar = (token, { contenido = CSV, archivo = 'planilla.csv', serieId, periodo = '2026-11', tipo = 'Regular' } = {}) => {
    const datos = new FormData(); datos.append('archivo', new Blob([contenido]), archivo); datos.append('periodo', periodo); datos.append('tipo', tipo);
    if (serieId) datos.append('serieId', serieId);
    return fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: datos });
  };
  const nuevo = async (c) => { const r = await cargar(c.elaborador); assert.equal(r.status, 200); return r.json(); };

  test('salud pública y datos protegidos por token', async () => {
    assert.equal((await (await get('/salud')).json()).estado, 'ok');
    assert.equal((await get('/planillas')).status, 401); assert.equal((await get('/cargas', 'falso')).status, 401);
  });
  test('las cuentas fijas resuelven permisos y rechazan credenciales o empresas ajenas', async () => {
    const ruc = '155123456-2-2020';
    const r = await post('/auth/login', '', { ruc, usuario: 'ana.contabilidad', clave: 'demo1234', rol: 'ajeno' });
    assert.equal(r.status, 200); assert.equal((await r.json()).rol, 'ELABORADOR');
    assert.equal((await post('/auth/login', '', { ruc, usuario: 'ana.contabilidad', clave: 'incorrecta' })).status, 401);
    assert.equal((await post('/auth/login', '', { ruc: 'otra', usuario: 'ana.contabilidad', clave: 'demo1234' })).status, 403);
    assert.equal((await post('/auth/login', '', { ruc: '' })).status, 400);
  });
  test('importa el XLSX de 25 columnas y conserva 20 rubros por trabajador', async () => {
    const c = await credenciales();
    const contenido = await readFile(new URL('../../web/public/ejemplos/sipe_referencia_con_observaciones.xlsx', import.meta.url));
    const r = await cargar(c.elaborador, { contenido, archivo: 'planilla.xlsx' }); assert.equal(r.status, 200);
    const v = await r.json(); assert.equal(v.formato, 'sipe-referencia-2019'); assert.equal(v.filas, 5);
    assert.equal(v.valida, false); assert.equal(v.errores.length, 1); assert.equal(v.errores[0].fila, 4);
    assert.equal(v.errores[0].campoId, 'horas_extras'); assert.equal(v.trabajadores[2].rubros.horas_extras, 'cien');
    assert.equal(Object.keys(v.trabajadores[2].rubros).length, 20); assert.equal(v.totalSalarios, 5680.5);
  });
  test('el CSV de cinco columnas conserva trabajadores y total salarial', async () => {
    const v = await nuevo(await credenciales()); assert.equal(v.valida, true); assert.equal(v.formato, 'demo-5-columnas');
    assert.equal(v.trabajadores.length, 2); assert.equal(v.totalSalarios, 2230.5); assert.equal(v.numero, 1); assert.ok(v.serieId);
  });
  test('rechaza formatos y períodos inválidos y la carga por otros perfiles', async () => {
    const c = await credenciales();
    assert.equal((await cargar(c.elaborador, { archivo: 'planilla.pdf', contenido: 'texto' })).status, 400);
    assert.equal((await cargar(c.elaborador, { periodo: '2026-13' })).status, 400);
    assert.equal((await cargar('token-invalido')).status, 401);
  });
  test('conserva intentos inmutables y vincula solo correcciones explícitas', async () => {
    const c = await credenciales(), a = await nuevo(c);
    const b = await (await cargar(c.elaborador, { serieId: a.serieId, contenido: CSV.replace('1250.00', '1300.00') })).json();
    const s = await (await get(`/planillas/${a.serieId}`, c.elaborador)).json();
    assert.equal(s.intentos.length, 2); assert.equal(b.numero, 2); assert.equal(s.intentos[0].trabajadores[0].sueldo, '1250.00'); assert.equal(s.intentos[1].trabajadores[0].sueldo, '1300.00');
    assert.notEqual((await nuevo(c)).serieId, a.serieId);
    assert.equal((await cargar(c.elaborador, { serieId: a.serieId, tipo: 'Complementaria' })).status, 409);
  });
  test('cada empresa ve solo sus planillas y no puede corregir las ajenas', async () => {
    const c = await credenciales(), a = await nuevo(c);
    assert.equal((await get(`/planillas/${a.serieId}`, c.ajeno)).status, 404);
    assert.equal((await cargar(c.ajeno, { serieId: a.serieId })).status, 404);
    assert.equal((await (await get('/planillas', c.ajeno)).json()).length, 0);
    await cargar(c.ajeno);
    assert.equal((await (await get('/planillas', c.elaborador)).json()).length, 1);
  });
  test('compara intentos históricos sin mezclar series ni empresas', async () => {
    const c = await credenciales(), a = await nuevo(c);
    const b = await (await cargar(c.elaborador, { serieId: a.serieId, contenido: CSV.replace('1250.00', '1300.00') })).json();
    await cargar(c.elaborador, { serieId: a.serieId, contenido: CSV.replace('1250.00', '1400.00') });
    const ruta = `/planillas/${a.serieId}/comparar?anterior=${a.id}&actual=${b.id}`;
    const r = await get(ruta, c.elaborador); assert.equal(r.status, 200); const dif = await r.json(); assert.equal(dif.cambios.length, 1); assert.equal(dif.cambios[0].campo, 'sueldo');
    assert.equal((await get(ruta, c.ajeno)).status, 404);
    const ajena = await nuevo(c); assert.equal((await get(`/planillas/${a.serieId}/comparar?anterior=${a.id}&actual=${ajena.id}`, c.elaborador)).status, 404);
  });
  test('no hay envío oficial ni segunda aprobación', async () => {
    const c = await credenciales(), v = await nuevo(c);
    for (const ruta of ['/planillas/enviar', `/planillas/${v.serieId}/solicitar-revision`, `/planillas/${v.serieId}/revisar`, `/planillas/${v.serieId}/autorizar`]) assert.equal((await post(ruta, c.elaborador)).status, 404);
    const detalle = await (await get(`/planillas/${v.serieId}`, c.elaborador)).json();
    assert.ok(!('comprobante' in detalle)); assert.ok(!('eventos' in detalle));
    assert.equal(detalle.estado, 'SIN_REFERENCIA');
    for (const usuario of ['representante', 'autorizador']) assert.equal((await post('/auth/login', '', { ruc: '155123456-2-2020', usuario, clave: 'demo1234' })).status, 401);
  });
});

describe('Reglas del formato demo', () => {
  let servidor, base;
  before(async () => { servidor = crearApp({ store: crearStoreMemoria(), reglasDesactivadas: ['codigo_ocupacion', 'dias_laborados'] }).listen(0); await new Promise((resolve) => servidor.once('listening', resolve)); base = `http://127.0.0.1:${servidor.address().port}`; });
  after(() => new Promise((resolve) => servidor.close(resolve)));
  test('lista las reglas activas solo con autenticación', async () => {
    assert.equal((await fetch(`${base}/reglas`)).status, 401);
    const token = await emitirToken({ ruc: 'prueba-flags', usuario: 'qa', empresa: 'Prueba' });
    const reglas = await (await fetch(`${base}/reglas`, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal(reglas.length, 5); assert.deepEqual(reglas.filter((r) => !r.activa).map((r) => r.id), ['dias_laborados', 'codigo_ocupacion']);
  });
});

test('HU-13: limita solicitudes excedidas por empresa con HTTP 429', async () => {
  const store = crearStoreMemoria();
  const srv = crearApp({ store, limiteTasaMax: 2 }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  try {
    const tok = await emitirToken({ ruc: '155-limit-1', usuario: 'ana', empresa: 'Demo', roles: ['ELABORADOR'], empresas: [{ ruc: '155-limit-1', nombre: 'Demo' }] });
    const h = { Authorization: `Bearer ${tok}` };
    const r1 = await fetch(`${url}/reglas`, { headers: h });
    const r2 = await fetch(`${url}/reglas`, { headers: h });
    const r3 = await fetch(`${url}/reglas`, { headers: h });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 429);
  } finally {
    await new Promise((r) => srv.close(r));
    await store.cerrar();
  }
});
