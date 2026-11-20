import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirTrabajadores } from './planillas.js';
import { contrastarPlanilla } from './contraste.js';

const personas = [['8-000-1001', 'María Pérez', '1200.00'], ['8-000-1002', 'Luis Gómez', '1100.00'], ['8-000-1003', 'Ana Ríos', '980.50']];
const resultado = (filas, formato = 'demo-5-columnas') => ({ estructuraValida: true, trabajadores: construirTrabajadores(filas.map(([cedula, nombre, salario]) => formato === 'demo-5-columnas' ? { cedula, nombre, salario } : { tipo_documento: 'Cédula', numero_documento: cedula, nombre, sueldo: salario }), [], formato) });
for (const formato of ['demo-5-columnas', 'sipe-referencia-2019']) {
  test(`piloto: presencia y sueldo, sin confundir diferencias con errores · ${formato}`, () => {
    const referencia = resultado(personas, formato);
    const planilla = resultado([[personas[0][0], personas[0][1], '1250.00'], personas[1], ['8-000-1004', 'Carlos Ruiz', '1350.00']], formato);
    const c = contrastarPlanilla(planilla, referencia, 'referencia.csv');
    assert.equal(c.estado, 'realizado');
    assert.deepEqual(c.diferencias.map(d => d.codigo), ['SUELDO_DISTINTO', 'SOLO_REFERENCIA', 'SOLO_PLANILLA']);
    assert.equal(c.diferencias[0].referencia.sueldo, '1200.00');
    assert.equal(c.diferencias[0].planilla.sueldo, '1250.00');
    assert.ok(c.diferencias.every(d => d.resultado === 'para_revisar'));
    assert.equal(c.sinDiferencias[0].nombre, 'Luis Gómez');
  });
}
test('una diferencia legítima se deja para revisar; una referencia errónea puede coincidir', () => {
  const cambiada = resultado([[personas[0][0], 'Otro nombre', '1250.00']]);
  assert.equal(contrastarPlanilla(cambiada, resultado([personas[0]])).diferencias[0].resultado, 'para_revisar');
  const igual = contrastarPlanilla(cambiada, cambiada);
  assert.equal(igual.diferencias.length, 0);
  assert.ok(igual.noVerificado.includes('exactitud_referencia'));
  assert.ok(igual.noVerificado.includes('cuotas_css'));
});
test('identidades duplicadas, incompletas, sueldo ilegible o estructura inválida impiden contrastar', () => {
  const ref = resultado(personas);
  for (const invalida of [resultado([personas[0], personas[0]]), resultado([['', 'Sin documento', '100']]), resultado([['8-000-1001', 'María', 'cien']]), { ...ref, estructuraValida: false }]) {
    for (const [p, r] of [[invalida, ref], [ref, invalida]]) {
      const c = contrastarPlanilla(p, r);
      assert.equal(c.estado, 'no_comparable'); assert.ok(c.conflictos.length);
      assert.equal(c.diferencias.length, 0); assert.equal(c.sinDiferencias.length, 0);
    }
  }
});
test('sin referencia no se declara coincidencia; solo se compara sueldo, no otros datos', () => {
  assert.equal(contrastarPlanilla(resultado(personas)).estado, 'no_realizado');
  const c = contrastarPlanilla(resultado([[personas[0][0], 'Nombre distinto', '1200']]), resultado([personas[0]]));
  assert.equal(c.diferencias.length, 0); assert.equal(c.sinDiferencias.length, 1);
});
