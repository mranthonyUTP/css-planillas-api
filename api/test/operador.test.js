import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearApp } from '../src/app.js';
import { emitirToken } from '../src/auth.js';
import { crearStoreMemoria } from '../src/store/memoria.js';
import { crearStorePostgres } from '../src/store/postgres.js';

for (const modo of ['memoria', ...(process.env.TEST_DATABASE_URL ? ['postgres'] : [])]) test(`operador: enviar, devolver, corregir y autorizar con permisos e idempotencia · ${modo}`, async () => {
  const store = modo === 'postgres' ? await crearStorePostgres(process.env.TEST_DATABASE_URL) : crearStoreMemoria();
  const server = crearApp({ store }).listen(0); await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`, ruc = `operador-${randomUUID()}`;
  const token = (usuario, rol, empresa = ruc) => emitirToken({ ruc: empresa, usuario, empresa, roles: [rol], empresas: [{ ruc: empresa, nombre: empresa }] });
  const responsable = await token('ana', 'ELABORADOR'), operador = await token('operador', 'OPERADOR'), ajeno = await token('ajeno', 'OPERADOR', 'otra');
  const csv = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-000-1001,María Pérez,1200.00,30,2411\n';
  const cargar = (contenido = csv, serieId, auth = responsable) => { const form = new FormData(); form.append('archivo', new Blob([contenido]), 'ejemplo.csv'); form.append('periodo', '2026-11'); form.append('tipo', 'Regular'); if (serieId) form.append('serieId', serieId); return fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: form }); };
  const decidir = (intento, decision, auth, motivo = '', clave = randomUUID()) => fetch(`${base}/planillas/${intento.serieId}/${decision === 'enviar' ? 'enviar-operador' : 'decision-operador'}`, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', 'Idempotency-Key': clave }, body: JSON.stringify({ intentoId: intento.id, decision, motivo }) });
  try {
    const mala = await (await cargar(csv.replace('1200.00', 'cien'))).json();
    assert.equal((await decidir(mala, 'enviar', responsable)).status, 409);
    assert.equal((await cargar(csv, undefined, operador)).status, 403);
    const a = await (await cargar()).json();
    assert.equal((await decidir(a, 'autorizar', responsable)).status, 403);
    assert.equal((await decidir(a, 'enviar', operador)).status, 403);
    assert.equal((await decidir(a, 'autorizar', operador)).status, 409);
    const enviada = await decidir(a, 'enviar', responsable); assert.equal(enviada.status, 200); assert.equal((await enviada.json()).revisionInterna.estado, 'PENDIENTE');
    assert.equal((await decidir(a, 'autorizar', ajeno)).status, 404);
    assert.equal((await decidir(a, 'devolver', operador, ' ')).status, 400);
    const clave = randomUUID();
    const devolucion = await decidir(a, 'devolver', operador, 'Revisar el sueldo en origen.', clave); assert.equal(devolucion.status, 200);
    const devuelta = await devolucion.json(); assert.equal(devuelta.revisionInterna.estado, 'DEVUELTA'); assert.equal(devuelta.revisionInterna.motivo, 'Revisar el sueldo en origen.');
    assert.equal((await (await decidir(a, 'devolver', operador, 'Revisar el sueldo en origen.', clave)).json()).revisionesInternas.length, devuelta.revisionesInternas.length);
    assert.equal((await decidir(a, 'devolver', operador, 'Otro motivo', clave)).status, 409);
    const b = await (await cargar(csv.replace('1200.00', '1250.00'), a.serieId)).json();
    assert.equal((await decidir(a, 'autorizar', operador)).status, 409);
    const detalle = await (await fetch(`${base}/planillas/${a.serieId}`, { headers: { Authorization: `Bearer ${responsable}` } })).json();
    assert.equal(detalle.revisionInterna.estado, 'SIN_ENVIAR'); assert.equal(detalle.intentos.length, 2); assert.ok(detalle.revisionesInternas.some(e => e.intentoId === a.id && e.accion === 'devolver-operador'));
    await decidir(b, 'enviar', responsable);
    const claveAutorizar = randomUUID();
    const autorizada = await decidir(b, 'autorizar', operador, '', claveAutorizar); assert.equal(autorizada.status, 200); assert.equal((await autorizada.json()).revisionInterna.estado, 'AUTORIZADA');
    const repetida = await (await decidir(b, 'autorizar', operador, '', claveAutorizar)).json(); assert.equal(repetida.revisionesInternas.filter(e => e.accion === 'autorizar-operador').length, 1);
    assert.equal((await decidir(b, 'enviar', responsable)).status, 409);
    if (modo === 'postgres') { const dos = await crearStorePostgres(process.env.TEST_DATABASE_URL); try { const recuperada = await dos.obtenerPlanilla(a.serieId, [ruc]); assert.ok(recuperada.eventos.some(e => e.accion === 'autorizar-operador')); } finally { await dos.cerrar(); } }
  } finally { await new Promise(r => server.close(r)); await store.cerrar(); }
});
