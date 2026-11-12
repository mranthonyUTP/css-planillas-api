// HU-17: pruebas de las métricas, el endpoint /metricas y las alertas.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app.js';
import { crearStoreMemoria } from '../src/store/memoria.js';
import { crearMetricas } from '../src/metricas.js';
import { evaluarAlertas, crearVigilante } from '../src/alertas.js';

const umbrales = { tasaError: 0.05, latenciaMs: 2000, minSolicitudes: 20 };

describe('HU-17: endpoint /metricas', () => {
  let servidor;
  let base;
  let sinToken;
  let baseSinToken;
  before(() => {
    servidor = crearApp({ store: crearStoreMemoria(), tokenMetricas: 'secreto-de-prueba' }).listen(0);
    base = `http://localhost:${servidor.address().port}`;
    sinToken = crearApp({ store: crearStoreMemoria(), tokenMetricas: '' }).listen(0);
    baseSinToken = `http://localhost:${sinToken.address().port}`;
  });
  after(() => {
    servidor.close();
    sinToken.close();
  });

  test('exige el token de métricas', async () => {
    assert.equal((await fetch(`${base}/metricas`)).status, 401);
    assert.equal((await fetch(`${base}/metricas`, { headers: { Authorization: 'Bearer otro' } })).status, 401);
  });

  test('queda deshabilitado (404) si no hay METRICS_TOKEN', async () => {
    assert.equal((await fetch(`${baseSinToken}/metricas`)).status, 404);
  });

  test('cuenta las solicitudes por ruta y estado, sin usar la URL como etiqueta', async () => {
    await fetch(`${base}/salud`);
    await fetch(`${base}/salud`);
    await fetch(`${base}/cargas`); // 401 sin token
    await fetch(`${base}/ruta-que-no-existe-123`);
    const r = await fetch(`${base}/metricas`, { headers: { Authorization: 'Bearer secreto-de-prueba' } });
    assert.equal(r.status, 200);
    const texto = await r.text();
    assert.match(texto, /planillas_http_solicitudes_total\{metodo="GET",ruta="\/salud",estado="2xx"\} 2/);
    assert.match(texto, /planillas_http_solicitudes_total\{metodo="GET",ruta="\/cargas",estado="4xx"\} 1/);
    assert.match(texto, /ruta="no_encontrada",estado="4xx"/);
    assert.doesNotMatch(texto, /ruta-que-no-existe/);
    assert.match(texto, /planillas_http_duracion_segundos_count \d+/);
    assert.match(texto, /planillas_info\{almacenamiento="memoria"\} 1/);
  });
});

describe('HU-17: ventana de métricas', () => {
  test('resume solo los minutos recientes', () => {
    let t = 0;
    const m = crearMetricas({ ahora: () => t });
    for (let i = 0; i < 8; i++) m.registrar({ metodo: 'GET', ruta: '/x', estado: 200, ms: 100 });
    for (let i = 0; i < 2; i++) m.registrar({ metodo: 'GET', ruta: '/x', estado: 500, ms: 300 });
    const v = m.ventana(5);
    assert.equal(v.solicitudes, 10);
    assert.equal(v.tasaError, 0.2);
    assert.equal(v.latenciaMediaMs, 140);
    t += 10 * 60_000;
    assert.equal(m.ventana(5).solicitudes, 0);
  });
});

describe('HU-17: alertas', () => {
  test('no alerta con pocas solicitudes', () => {
    assert.deepEqual(evaluarAlertas({ solicitudes: 5, tasaError: 1, latenciaMediaMs: 9000 }, umbrales), []);
  });

  test('alerta por tasa de errores y por latencia', () => {
    const codigos = evaluarAlertas({ solicitudes: 100, tasaError: 0.2, latenciaMediaMs: 3500 }, umbrales).map((a) => a.codigo);
    assert.deepEqual(codigos, ['tasa_errores_alta', 'latencia_alta']);
  });

  test('no alerta dentro de los umbrales', () => {
    assert.deepEqual(evaluarAlertas({ solicitudes: 100, tasaError: 0.01, latenciaMediaMs: 200 }, umbrales), []);
  });

  test('avisa una sola vez al activarse y otra al resolverse', async () => {
    let t = 0;
    const m = crearMetricas({ ahora: () => t });
    const enviados = [];
    const registros = [];
    const logger = { warn: (o, msg) => registros.push(['warn', msg]), info: (o, msg) => registros.push(['info', msg]), error() {} };
    const vigilante = crearVigilante({
      metricas: m,
      logger,
      umbrales,
      webhookUrl: 'http://webhook.local/x',
      enviar: async (url, opciones) => enviados.push(JSON.parse(opciones.body).text),
    });
    for (let i = 0; i < 30; i++) m.registrar({ metodo: 'GET', ruta: '/x', estado: 500, ms: 10 });
    await vigilante.revisar();
    await vigilante.revisar(); // sigue activa: no repite
    assert.equal(enviados.length, 1);
    assert.match(enviados[0], /ALERTA tasa_errores_alta/);

    t += 10 * 60_000; // la ventana queda vacía
    await vigilante.revisar();
    assert.equal(enviados.length, 2);
    assert.match(enviados[1], /RESUELTA tasa_errores_alta/);
    assert.deepEqual(registros.map((r) => r[0]), ['warn', 'info']);
  });
});
