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
    return { ruc, otra, elaborador: await token('ELABORADOR'), operador: await token('OPERADOR'), autorizador: await token('AUTORIZADOR'), ajeno: await token('ELABORADOR', otra, [otra]), operadorMulti: await token('OPERADOR', ruc, [ruc, otra]) };
  };
  const get = (ruta, token) => fetch(`${base}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const post = (ruta, token, cuerpo = {}, clave = randomUUID()) => fetch(`${base}${ruta}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': clave }, body: JSON.stringify(cuerpo) });
  const cargar = (token, { contenido = CSV, archivo = 'planilla.csv', serieId, periodo = '2026-11', tipo = 'Regular' } = {}) => {
    const datos = new FormData(); datos.append('archivo', new Blob([contenido]), archivo); datos.append('periodo', periodo); datos.append('tipo', tipo);
    if (serieId) datos.append('serieId', serieId);
    return fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: datos });
  };
  const nuevo = async (c) => { const r = await cargar(c.elaborador); assert.equal(r.status, 200); return r.json(); };
  const decidir = (v, token, accion, decision, motivo, clave) => post(`/planillas/${v.serieId}/${accion}`, token, { intentoId: v.id, ...(decision ? { decision } : {}), ...(motivo !== undefined ? { motivo } : {}) }, clave);
  const aRevision = async (v, c) => { const r = await decidir(v, c.elaborador, 'solicitar-revision'); assert.equal(r.status, 200); return r.json(); };

  test('salud pública y datos protegidos por token', async () => {
    assert.equal((await (await get('/salud')).json()).estado, 'ok');
    assert.equal((await get('/planillas')).status, 401); assert.equal((await get('/cargas', 'falso')).status, 401);
  });
  test('las cuentas fijas resuelven permisos y rechazan credenciales o empresas ajenas', async () => {
    const ruc = '155123456-2-2020';
    const r = await post('/auth/login', '', { ruc, usuario: 'ana.contabilidad', clave: 'demo1234', rol: 'AUTORIZADOR' });
    assert.equal(r.status, 200); assert.equal((await r.json()).rol, 'ELABORADOR');
    assert.equal((await post('/auth/login', '', { ruc, usuario: 'ana.contabilidad', clave: 'incorrecta' })).status, 401);
    assert.equal((await post('/auth/login', '', { ruc: 'otra', usuario: 'operador', clave: 'demo1234' })).status, 403);
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
    assert.equal((await cargar(c.operador)).status, 403); assert.equal((await cargar(c.autorizador)).status, 403);
  });
  test('conserva intentos inmutables y vincula solo correcciones explícitas', async () => {
    const c = await credenciales(), a = await nuevo(c);
    const b = await (await cargar(c.elaborador, { serieId: a.serieId, contenido: CSV.replace('1250.00', '1300.00') })).json();
    const s = await (await get(`/planillas/${a.serieId}`, c.elaborador)).json();
    assert.equal(s.intentos.length, 2); assert.equal(b.numero, 2); assert.equal(s.intentos[0].trabajadores[0].sueldo, '1250.00'); assert.equal(s.intentos[1].trabajadores[0].sueldo, '1300.00');
    assert.notEqual((await nuevo(c)).serieId, a.serieId);
    assert.equal((await cargar(c.elaborador, { serieId: a.serieId, tipo: 'Complementaria' })).status, 409);
  });
  test('cada elaborador queda aislado y el operador solo ve empresas asignadas', async () => {
    const c = await credenciales(), a = await nuevo(c);
    assert.equal((await get(`/planillas/${a.serieId}`, c.ajeno)).status, 404);
    assert.equal((await cargar(c.ajeno, { serieId: a.serieId })).status, 404);
    assert.equal((await (await get('/planillas', c.ajeno)).json()).length, 0);
    await cargar(c.ajeno);
    assert.equal((await (await get('/planillas', c.operador)).json()).length, 1);
    assert.equal((await (await get('/planillas', c.operadorMulti)).json()).length, 2);
  });
  test('la revisión y autorización exigen los perfiles y estados correspondientes', async () => {
    const c = await credenciales(), v = await nuevo(c);
    assert.equal((await decidir(v, c.elaborador, 'revisar', 'aprobar')).status, 403);
    assert.equal((await decidir(v, c.operador, 'autorizar', 'autorizar')).status, 403);
    assert.equal((await decidir(v, c.autorizador, 'autorizar', 'autorizar')).status, 409);
    assert.equal((await aRevision(v, c)).estado, 'PENDIENTE_REVISION');
    const r = await decidir(v, c.operador, 'revisar', 'aprobar'); assert.equal(r.status, 200); assert.equal((await r.json()).estado, 'PENDIENTE_AUTORIZACION');
    const a = await decidir(v, c.autorizador, 'autorizar', 'autorizar'); assert.equal(a.status, 200);
    const s = await a.json(); assert.equal(s.estado, 'AUTORIZADA'); assert.match(s.comprobante.confirmacion, /^INT-/); assert.equal(s.comprobante.intentoId, v.id);
    assert.deepEqual(s.eventos.map((e) => e.rol), ['ELABORADOR', 'ELABORADOR', 'OPERADOR', 'AUTORIZADOR']);
    assert.ok(s.eventos.every((e) => !('clave' in e) && !('huella' in e)));
  });
  test('la devolución exige motivo y lo conserva asociado al intento', async () => {
    const c = await credenciales(), v = await nuevo(c); await aRevision(v, c);
    assert.equal((await decidir(v, c.operador, 'revisar', 'devolver', '  ')).status, 400);
    const r = await decidir(v, c.operador, 'revisar', 'devolver', 'Verificar comisiones.'); assert.equal(r.status, 200);
    const s = await r.json(); assert.equal(s.estado, 'DEVUELTA'); assert.equal(s.eventos.at(-1).motivo, 'Verificar comisiones.'); assert.equal(s.eventos.at(-1).intentoId, v.id);
  });
  test('la actividad propia filtra actor, rol y empresas asignadas sin modificar el historial general', async () => {
    const c = await credenciales();
    const identidad = (usuario, rol) => emitirToken({ ruc: c.ruc, usuario, empresa: c.ruc, roles: [rol], empresas: [{ ruc: c.ruc, nombre: c.ruc }] });
    const otroOperador = await identidad('otro-operador', 'OPERADOR');
    const autorizadorMismoNombre = await identidad('operador', 'AUTORIZADOR');
    const propia = await nuevo(c); await aRevision(propia, c);
    assert.equal((await decidir(propia, c.operador, 'revisar', 'aprobar')).status, 200);
    const deOtro = await nuevo(c); await aRevision(deOtro, c);
    assert.equal((await decidir(deOtro, otroOperador, 'revisar', 'aprobar')).status, 200);
    assert.equal((await decidir(deOtro, autorizadorMismoNombre, 'autorizar', 'autorizar')).status, 200);
    const deOtraEmpresa = await (await cargar(c.ajeno)).json();
    assert.equal((await decidir(deOtraEmpresa, c.ajeno, 'solicitar-revision')).status, 200);
    assert.equal((await decidir(deOtraEmpresa, c.operadorMulti, 'revisar', 'aprobar')).status, 200);
    await nuevo(c);
    const lista = async (token, ruta = '/planillas?actividad=propia') => {
      const respuesta = await get(ruta, token); assert.equal(respuesta.status, 200); return respuesta.json();
    };
    const actividad = await lista(c.operador, '/planillas?actividad=propia&usuario=otro-operador&rol=AUTORIZADOR');
    assert.deepEqual(actividad.map((s) => s.id), [propia.serieId]);
    assert.equal(actividad[0].ultimaDecisionPropia.usuario, 'operador');
    assert.equal(actividad[0].ultimaDecisionPropia.rol, 'OPERADOR');
    assert.deepEqual((await lista(otroOperador)).map((s) => s.id), [deOtro.serieId]);
    assert.deepEqual((await lista(autorizadorMismoNombre)).map((s) => s.id), [deOtro.serieId]);
    assert.deepEqual((await lista(c.operadorMulti)).map((s) => s.id).sort(), [propia.serieId, deOtraEmpresa.serieId].sort());
    assert.equal((await lista(c.autorizador)).length, 0);
    const general = await lista(c.operador, '/planillas');
    assert.equal(general.length, 3); assert.ok(general.every((s) => !('ultimaDecisionPropia' in s)));
  });
  test('la decisión guardada coincide en detalle, listado y actividad y conserva versiones históricas sin duplicarlas', async () => {
    const c = await credenciales(), v = await nuevo(c); await aRevision(v, c);
    const clave = randomUUID();
    const respuesta = await decidir(v, c.operador, 'revisar', 'aprobar', undefined, clave);
    assert.equal(respuesta.status, 200); const guardada = await respuesta.json();
    const repetida = await decidir(v, c.operador, 'revisar', 'aprobar', undefined, clave);
    assert.equal(repetida.status, 200); assert.equal((await repetida.json()).eventos.length, guardada.eventos.length);
    const detalle = await (await get(`/planillas/${v.serieId}`, c.operador)).json();
    const general = await (await get('/planillas', c.operador)).json();
    const actividad = await (await get('/planillas?actividad=propia', c.operador)).json();
    assert.equal(detalle.estado, 'PENDIENTE_AUTORIZACION'); assert.equal(general[0].estado, detalle.estado);
    assert.equal(actividad.length, 1); assert.equal(actividad[0].estado, detalle.estado);
    assert.equal(actividad[0].ultimaDecisionPropia.id, detalle.eventos.at(-1).id);
    assert.equal(actividad[0].ultimaDecisionPropia.esIntentoActual, true);
    assert.equal(actividad[0].ultimaDecisionPropia.numeroIntento, 1);
    assert.ok(!('clave' in actividad[0].ultimaDecisionPropia) && !('huella' in actividad[0].ultimaDecisionPropia));
    const correccion = await (await cargar(c.elaborador, { serieId: v.serieId })).json();
    const historica = await (await get('/planillas?actividad=propia', c.operador)).json();
    assert.equal(historica.length, 1); assert.equal(historica[0].estado, 'BORRADOR');
    assert.equal(historica[0].ultimaDecisionPropia.id, actividad[0].ultimaDecisionPropia.id);
    assert.equal(historica[0].ultimaDecisionPropia.esIntentoActual, false);
    assert.equal(historica[0].ultimaDecisionPropia.intentoId, v.id);
    assert.equal(historica[0].ultimoIntentoResumen.id, correccion.id);
    await aRevision(correccion, c);
    assert.equal((await decidir(correccion, c.operador, 'revisar', 'devolver', 'Corregir el dato de origen.')).status, 200);
    const actualizada = await (await get('/planillas?actividad=propia', c.operador)).json();
    assert.equal(actualizada.length, 1); assert.equal(actualizada[0].estado, 'DEVUELTA');
    assert.equal(actualizada[0].ultimaDecisionPropia.numeroIntento, 2);
    assert.equal(actualizada[0].ultimaDecisionPropia.accion, 'devolver-revision');
    assert.equal(actualizada[0].ultimaDecisionPropia.motivo, 'Corregir el dato de origen.');
    assert.equal(actualizada[0].ultimaDecisionPropia.esIntentoActual, true);
  });
  test('el filtro de actividad rechaza valores inválidos y no admite el perfil elaborador', async () => {
    const c = await credenciales();
    assert.equal((await get('/planillas?actividad=propia')).status, 401);
    assert.equal((await get('/planillas?actividad=otra', c.operador)).status, 400);
    assert.equal((await get('/planillas?actividad=propia&actividad=propia', c.operador)).status, 400);
    assert.equal((await get('/planillas?actividad=propia', c.elaborador)).status, 403);
    assert.equal((await get('/planillas', c.elaborador)).status, 200);
  });
  test('una planilla con observaciones no puede solicitar revisión', async () => {
    const c = await credenciales(), v = await (await cargar(c.elaborador, { contenido: CSV.replace('1250.00', 'texto') })).json();
    assert.equal(v.valida, false); assert.equal((await decidir(v, c.elaborador, 'solicitar-revision')).status, 409);
  });
  test('los reintentos no duplican eventos y no se puede reutilizar una clave con otros datos', async () => {
    const c = await credenciales(), v = await nuevo(c), clave = randomUUID();
    const s = await (await decidir(v, c.elaborador, 'solicitar-revision', undefined, '', clave)).json();
    const repetida = await decidir(v, c.elaborador, 'solicitar-revision', undefined, '', clave); assert.equal(repetida.status, 200); assert.equal((await repetida.json()).eventos.length, s.eventos.length);
    assert.equal((await decidir(v, c.elaborador, 'solicitar-revision', undefined, 'otro', clave)).status, 409);
    assert.equal((await decidir(v, c.operador, 'revisar', 'aprobar', undefined, '')).status, 400);
  });
  test('una corrección reinicia la revisión y las decisiones sobre versiones anteriores fallan', async () => {
    const c = await credenciales(), v = await nuevo(c); await aRevision(v, c); await decidir(v, c.operador, 'revisar', 'aprobar'); await decidir(v, c.autorizador, 'autorizar', 'autorizar');
    const b = await (await cargar(c.elaborador, { serieId: v.serieId })).json();
    const s = await (await get(`/planillas/${v.serieId}`, c.elaborador)).json();
    assert.equal(s.estado, 'BORRADOR'); assert.equal(s.comprobante, null); assert.equal(s.intentos.length, 2); assert.equal(s.ultimoIntentoId, b.id); assert.ok(s.eventos.some((e) => e.accion === 'autorizar'));
    assert.equal((await decidir(v, c.operador, 'revisar', 'aprobar')).status, 409);
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
  test('el endpoint anterior no puede saltarse la autorización interna', async () => {
    const c = await credenciales(), v = await nuevo(c);
    assert.equal((await post('/planillas/enviar', c.elaborador, { validacionId: v.id })).status, 410);
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
