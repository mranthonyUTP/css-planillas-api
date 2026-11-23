import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNAS_SIPE, RUBROS, validarFormatoSipe, compararIntentos, construirTrabajadores, centimos, normalizarEncabezado } from './planillas.js';
const registro = (n, cambios = {}) => ({ tipo_documento: 'Cédula', numero_documento: `8-000-${n}`, numero_seguro_social: `0000${n}`, nombre: n === 1 ? 'Ana' : 'Luis', apellido: 'Ríos', ...Object.fromEntries(RUBROS.map(({ id }) => [id, '0.00'])), sueldo: '1000.00', ...cambios });
const validar = (registros, encabezados = COLUMNAS_SIPE) => validarFormatoSipe({ registros, encabezados });
const intento = (id, registros) => ({ id, numero: Number(id), ...validar(registros) });
test('conserva veinte rubros, vacíos, ceros e identificaciones como texto', () => {
  const v = validar([registro(1, { comisiones: '', horas_extras: '0', numero_seguro_social: '0000123' })]);
  assert.equal(v.errores.length, 0); assert.equal(Object.keys(v.trabajadores[0].rubros).length, 20);
  assert.equal(v.trabajadores[0].rubros.comisiones, ''); assert.equal(v.trabajadores[0].rubros.horas_extras, '0'); assert.equal(v.trabajadores[0].seguroSocial, '0000123');
});
test('corregir un rubro resuelve su observación y conserva el total de sueldos', () => {
  const a = intento('1', [registro(1, { horas_extras: 'cien' }), registro(2)]), b = intento('2', [registro(1, { horas_extras: '100.00' }), registro(2)]);
  assert.equal(a.errores.length, 1); assert.equal(a.errores[0].campoId, 'horas_extras'); assert.equal(b.errores.length, 0);
  const c = compararIntentos(a, b); assert.equal(c.comparable, true); assert.equal(c.cambios.length, 1);
  assert.equal(c.cambios[0].antes, 'cien'); assert.equal(c.cambios[0].despues, '100.00');
  assert.equal(c.totales.antes.sueldos, 2000); assert.equal(c.totales.despues.sueldos, 2000); assert.equal(a.trabajadores[0].rubros.horas_extras, 'cien');
});
test('reordenar filas y variar representación decimal no cambia los valores', () => {
  const c = compararIntentos(intento('1', [registro(1), registro(2)]), intento('2', [registro(2, { sueldo: '1000' }), registro(1)]));
  assert.equal(c.cambios.length, 0); assert.equal(c.altas.length, 0); assert.equal(c.bajas.length, 0); assert.equal(c.sinCambios, 2);
});
test('compara altas y bajas por identidad, no por nombre o fila', () => {
  const c = compararIntentos(intento('1', [registro(1), registro(2)]), intento('2', [registro(1), registro(3)]));
  assert.equal(c.altas.length, 1); assert.equal(c.altas[0].documento, '8-000-3'); assert.equal(c.bajas[0].documento, '8-000-2');
});
test('identidades duplicadas impiden validar y comparar con certeza', () => {
  const a = intento('1', [registro(1), registro(1)]); assert.equal(a.errores.filter((e) => e.campoId === 'numero_documento').length, 2);
  const c = compararIntentos(a, intento('2', [registro(1)])); assert.equal(c.comparable, false); assert.ok(c.conflictos.length); assert.equal(c.cambios.length, 0);
});
test('detecta encabezados ausentes y duplicados sin declarar válida la estructura', () => {
  assert.equal(validar([registro(1)], COLUMNAS_SIPE.slice(1)).estructuraValida, false);
  const v = validar([registro(1)], [...COLUMNAS_SIPE, 'sueldo']); assert.equal(v.estructuraValida, false); assert.ok(v.errores.some((e) => e.problema.includes('repetido')));
});
test('el total parcial indica los sueldos ilegibles y suma exactamente en centavos', () => {
  const v = validar([registro(1, { sueldo: 'texto' }), registro(2, { sueldo: '10.20' })]);
  assert.equal(v.totalSalariosParcial, true); assert.equal(v.salariosValidos, 1); assert.equal(v.totalSalarios, 10.2);
  assert.equal(validar([registro(1, { sueldo: '0.10' }), registro(2, { sueldo: '0.20' })]).totalSalarios, 0.3);
});
test('distingue vacío de cero y conserva el número de fila de origen', () => {
  const c = compararIntentos(intento('1', [registro(1, { comisiones: '', __fila: 7 })]), intento('2', [registro(1, { comisiones: '0.00', __fila: 8 })]));
  assert.equal(c.cambios[0].antes, ''); assert.equal(c.cambios[0].despues, '0.00'); assert.equal(c.cambios[0].filaAnterior, 7); assert.equal(c.cambios[0].filaActual, 8);
});
test('rechaza importes fuera de rango, símbolos y precisión excesiva', () => {
  for (const v of ['B/. 100', '12O.00', '1,200.00', '1.001', '99999999999999999999999']) assert.equal(centimos(v), null);
  assert.equal(centimos('0'), 0); assert.equal(centimos(''), null);
});
test('conserva días y ocupación del formato demo y compara sus cambios', () => {
  const r = { cedula: '8-123-456', nombre: 'Persona ficticia', salario: '1000', dias_laborados: '30', codigo_ocupacion: '2411' };
  const a = { trabajadores: construirTrabajadores([r], [], 'demo-5-columnas') }, b = { trabajadores: construirTrabajadores([{ ...r, dias_laborados: '29' }], [], 'demo-5-columnas') };
  assert.equal(a.trabajadores[0].adicionales.codigo_ocupacion, '2411'); const c = compararIntentos(a, b);
  assert.equal(c.cambios.length, 1); assert.equal(c.cambios[0].campoNombre, 'Días laborados'); assert.equal(c.cambios[0].antes, '30'); assert.equal(c.cambios[0].despues, '29');
});
test('trata encabezados con nombres de propiedades de Object como texto desconocido', () => {
  assert.equal(normalizarEncabezado('constructor'), 'constructor');
  const v = validar([registro(1)], [...COLUMNAS_SIPE, 'constructor']); assert.equal(v.estructuraValida, false); assert.equal(typeof v.errores.find((e) => e.campoId === 'constructor').campo, 'string');
});

import { calcularCuotasTrabajador, calcularCuotasPlanilla } from './planillas.js';

test('HU-23: calcula cuotas obrero-patronales CSS (Ley 462), escalonamiento 2027 y décimo tercer mes', () => {
  const emp = {
    sueldo: '1000.00',
    rubros: { sueldo: '1000.00', horas_extras: '200.00', impuesto_sobre_renta: '50.00' },
  };
  const c = calcularCuotasTrabajador(emp, { periodo: '2026-11' });
  assert.equal(c.baseCotizable, 1200);
  assert.equal(c.ssEmpleado, 117);
  assert.equal(c.seEmpleado, 15);
  assert.equal(c.isrDeclarado, 50);
  assert.equal(c.salarioNetoEstimado, 1018);
  assert.equal(c.ssPatronal, 159);
  assert.equal(c.sePatronal, 18);
  assert.equal(c.riesgosProfesionales, 18);
  assert.equal(c.totalCss, 327);

  const c2027 = calcularCuotasTrabajador({ sueldo: '1000.00', rubros: { sueldo: '1000.00' } }, { periodo: '2027-03' });
  assert.equal(c2027.ssPatronal, 142.5);
  assert.equal(c2027.tasas.ssPatronal, 0.1425);

  const cDecimo = calcularCuotasTrabajador({ sueldo: '0.00', rubros: { sueldo: '0.00', decimo_tercer_mes: '1000.00' } }, { periodo: '2026-12' });
  assert.equal(cDecimo.ssEmpleado, 72.5);
  assert.equal(cDecimo.ssPatronal, 107.5);
  assert.equal(cDecimo.seEmpleado, 0);

  const planilla = calcularCuotasPlanilla([emp], { periodo: '2026-11' });
  assert.equal(planilla.trabajadoresCalculados, 1);
  assert.equal(planilla.totalCss, 327);
});

test('HU-24: rechaza pasaporte inválido y horas extras con sueldo en cero', () => {
  const v = validar([
    registro(1, { tipo_documento: 'Pasaporte', numero_documento: 'AB-12' }),
    registro(2, { sueldo: '0.00', horas_extras: '50.00' }),
  ]);
  assert.equal(v.errores.some((e) => e.campoId === 'numero_documento'), true);
  assert.equal(v.errores.some((e) => e.campoId === 'horas_extras'), true);
});
