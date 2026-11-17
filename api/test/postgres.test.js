import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearStorePostgres } from '../src/store/postgres.js';

test('PostgreSQL conserva versiones entre conexiones y serializa cargas y decisiones concurrentes', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL, uno = await crearStorePostgres(url), dos = await crearStorePostgres(url);
  const ruc = `concurrencia-${randomUUID()}`;
  const intento = (sueldo) => ({ id: randomUUID(), empresaRuc: ruc, empresaNombre: 'Prueba de persistencia', usuario: 'elaborador', archivo: 'prueba.csv', periodo: '2026-11', tipo: 'Regular', validadaEn: new Date().toISOString(), valida: true, formato: 'demo-5-columnas', filas: 1, filasConError: 0, totalSalarios: sueldo, errores: [], trabajadores: [{ fila: 2, clave: 'cedula:8-000-1', documento: '8-000-1', nombreCompleto: 'Persona ficticia', sueldo: String(sueldo), rubros: { sueldo: String(sueldo) }, errores: [], valido: true }] });
  let serieId;
  try {
    const a = await uno.guardarIntento({ intento: intento(1000) }); serieId = a.serieId;
    const siguientes = await Promise.all([uno.guardarIntento({ serieId, intento: intento(1100) }), dos.guardarIntento({ serieId, intento: intento(1200) })]);
    assert.deepEqual(siguientes.map((i) => i.numero).sort(), [2, 3]);
    const serie = await dos.obtenerPlanilla(serieId, [ruc]); assert.equal(serie.intentos.length, 3); assert.equal(serie.eventos.length, 3); assert.equal(serie.intentos[0].trabajadores[0].sueldo, '1000');
    const entrada = { id: serieId, rucs: [ruc], intentoId: serie.ultimoIntentoId, accion: 'solicitar', usuario: 'elaborador', rol: 'ELABORADOR', clave: randomUUID() };
    const decisiones = await Promise.all([uno.decidirPlanilla(entrada), dos.decidirPlanilla(entrada)]); assert.ok(decisiones.every((s) => s.estado === 'PENDIENTE_REVISION' && s.eventos.length === 4));
    await assert.rejects(dos.decidirPlanilla({ ...entrada, intentoId: a.id, clave: randomUUID() }), (e) => e.estado === 409);
    assert.equal(await dos.obtenerPlanilla(serieId, ['otra-empresa']), null);
  } finally { await uno.cerrar(); await dos.cerrar(); }
  const tres = await crearStorePostgres(url);
  try { const recuperada = await tres.obtenerPlanilla(serieId, [ruc]); assert.equal(recuperada.intentos.length, 3); assert.equal(recuperada.estado, 'PENDIENTE_REVISION'); assert.equal(recuperada.eventos.length, 4); }
  finally { await tres.cerrar(); }
});

test('PostgreSQL conserva actividad propia por actor, rol y empresa tras una corrección y una reconexión', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  const ruc = `actividad-${randomUUID()}`, otroRuc = `actividad-ajena-${randomUUID()}`;
  const actor = { usuario: `operador-${randomUUID()}`, rol: 'OPERADOR' };
  const uno = await crearStorePostgres(url), dos = await crearStorePostgres(url);
  const intento = (empresaRuc = ruc) => ({ id: randomUUID(), empresaRuc, empresaNombre: 'Prueba de actividad',
    usuario: 'elaborador', archivo: 'actividad.csv', periodo: '2026-11', tipo: 'Regular',
    validadaEn: new Date().toISOString(), valida: true, formato: 'demo-5-columnas', filas: 1,
    filasConError: 0, totalSalarios: 1000, errores: [], trabajadores: [] });
  const solicitar = (a) => uno.decidirPlanilla({ id: a.serieId, rucs: [ruc, otroRuc], intentoId: a.id,
    accion: 'solicitar', usuario: 'elaborador', rol: 'ELABORADOR', clave: randomUUID() });
  const revisar = (a, usuario = actor.usuario) => ({ id: a.serieId, rucs: [ruc, otroRuc], intentoId: a.id,
    accion: 'revisar', decision: 'aprobar', motivo: '', usuario, rol: 'OPERADOR', clave: randomUUID() });
  let serieId, intentoId, decisionId;
  try {
    const propio = await uno.guardarIntento({ intento: intento() });
    const ajeno = await uno.guardarIntento({ intento: intento() });
    const otraEmpresa = await uno.guardarIntento({ intento: intento(otroRuc) });
    serieId = propio.serieId; intentoId = propio.id;
    await Promise.all([solicitar(propio), solicitar(ajeno), solicitar(otraEmpresa)]);
    const entrada = revisar(propio);
    const respuestas = await Promise.all([uno.decidirPlanilla(entrada), dos.decidirPlanilla(entrada)]);
    assert.ok(respuestas.every((s) => s.estado === 'PENDIENTE_AUTORIZACION'));
    assert.ok(respuestas.every((s) => s.eventos.filter((e) => e.accion === 'aprobar').length === 1));
    decisionId = respuestas[0].eventos.at(-1).id;
    await uno.decidirPlanilla(revisar(ajeno, 'otro-operador'));
    await uno.decidirPlanilla(revisar(otraEmpresa));
    await dos.decidirPlanilla({ id: serieId, rucs: [ruc], intentoId, accion: 'autorizar', decision: 'autorizar',
      usuario: actor.usuario, rol: 'AUTORIZADOR', clave: randomUUID() });

    const actividad = await dos.listarPlanillas([ruc], { actividadPropia: actor });
    assert.equal(actividad.length, 1);
    assert.equal(actividad[0].id, serieId);
    assert.equal(actividad[0].ultimaDecisionPropia.id, decisionId);
    assert.equal(actividad[0].ultimaDecisionPropia.accion, 'aprobar');
    assert.equal(actividad[0].ultimaDecisionPropia.esIntentoActual, true);
    assert.equal(actividad[0].ultimaDecisionPropia.numeroIntento, 1);
    assert.equal(actividad[0].ultimaDecisionPropia.archivo, 'actividad.csv');
    assert.ok(!Object.hasOwn(actividad[0].ultimaDecisionPropia, 'clave'));
    assert.ok(!Object.hasOwn(actividad[0].ultimaDecisionPropia, 'huella'));
    const comoAutorizador = await dos.listarPlanillas([ruc], { actividadPropia: { ...actor, rol: 'AUTORIZADOR' } });
    assert.equal(comoAutorizador.length, 1);
    assert.equal(comoAutorizador[0].ultimaDecisionPropia.accion, 'autorizar');
    assert.deepEqual(await dos.listarPlanillas(['sin-asignacion'], { actividadPropia: actor }), []);
    assert.deepEqual(await dos.listarPlanillas([ruc], { actividadPropia: { ...actor, usuario: 'sin-actividad' } }), []);

    await uno.guardarIntento({ serieId, intento: { ...intento(), archivo: 'actividad-corregida.csv' } });
    const despues = await dos.listarPlanillas([ruc], { actividadPropia: actor });
    assert.equal(despues.length, 1);
    assert.equal(despues[0].estado, 'BORRADOR');
    assert.equal(despues[0].numeroIntentos, 2);
    assert.equal(despues[0].ultimaDecisionPropia.id, decisionId);
    assert.equal(despues[0].ultimaDecisionPropia.intentoId, intentoId);
    assert.equal(despues[0].ultimaDecisionPropia.esIntentoActual, false);
    const todas = await dos.listarPlanillas([ruc]);
    assert.equal(todas.length, 2);
    assert.ok(todas.every((s) => !Object.hasOwn(s, 'ultimaDecisionPropia')));
  } finally {
    await uno.cerrar(); await dos.cerrar();
  }
  const recuperado = await crearStorePostgres(url);
  try {
    const actividad = await recuperado.listarPlanillas([ruc], { actividadPropia: actor });
    assert.equal(actividad.length, 1);
    assert.equal(actividad[0].id, serieId);
    assert.equal(actividad[0].estado, 'BORRADOR');
    assert.equal(actividad[0].ultimaDecisionPropia.id, decisionId);
    assert.equal(actividad[0].ultimaDecisionPropia.intentoId, intentoId);
    assert.equal(actividad[0].ultimaDecisionPropia.esIntentoActual, false);
    const detalle = await recuperado.obtenerPlanilla(serieId, [ruc]);
    assert.equal(detalle.eventos.filter((e) => e.accion === 'aprobar').length, 1);
    assert.equal(detalle.eventos.find((e) => e.id === decisionId).decision, 'aprobar');
  } finally { await recuperado.cerrar(); }
});
