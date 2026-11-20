import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearStorePostgres } from '../src/store/postgres.js';

test('PostgreSQL conserva versiones entre conexiones y serializa cargas concurrentes', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL, uno = await crearStorePostgres(url), dos = await crearStorePostgres(url);
  const ruc = `concurrencia-${randomUUID()}`;
  const intento = (sueldo) => ({ id: randomUUID(), empresaRuc: ruc, empresaNombre: 'Prueba de persistencia', usuario: 'elaborador', archivo: 'prueba.csv', periodo: '2026-11', tipo: 'Regular', validadaEn: new Date().toISOString(), valida: true, formato: 'demo-5-columnas', filas: 1, filasConError: 0, totalSalarios: sueldo, errores: [], trabajadores: [{ fila: 2, clave: 'cedula:8-000-1', documento: '8-000-1', nombreCompleto: 'Persona ficticia', sueldo: String(sueldo), rubros: { sueldo: String(sueldo) }, errores: [], valido: true }] });
  let serieId;
  try {
    const a = await uno.guardarIntento({ intento: intento(1000) }); serieId = a.serieId;
    const siguientes = await Promise.all([uno.guardarIntento({ serieId, intento: intento(1100) }), dos.guardarIntento({ serieId, intento: intento(1200) })]);
    assert.deepEqual(siguientes.map((i) => i.numero).sort(), [2, 3]);
    const serie = await dos.obtenerPlanilla(serieId, [ruc]); assert.equal(serie.intentos.length, 3); assert.equal(serie.eventos.length, 3); assert.equal(serie.intentos[0].trabajadores[0].sueldo, '1000');
    assert.equal(await dos.obtenerPlanilla(serieId, ['otra-empresa']), null);
  } finally { await uno.cerrar(); await dos.cerrar(); }
  const tres = await crearStorePostgres(url);
  try { const recuperada = await tres.obtenerPlanilla(serieId, [ruc]); assert.equal(recuperada.intentos.length, 3); assert.equal(recuperada.eventos.length, 3); }
  finally { await tres.cerrar(); }
});
