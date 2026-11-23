// HU-09: pruebas unitarias de las reglas de validación. Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCsv } from '../src/validacion/lector.js';
import { validarPlanilla, validarRegistro } from '../src/validacion/reglas.js';
import { reglasActivas } from '../src/validacion/flags.js';

const valido = { cedula: '8-123-456', nombre: 'María Ríos', salario: '1250.00', dias_laborados: '30', codigo_ocupacion: '2411' };

test('un registro correcto no tiene errores', () => {
  assert.deepEqual(validarRegistro(valido, 2), []);
});

test('acepta cédulas con prefijos PE, E, N y AV', () => {
  for (const cedula of ['PE-12-345', 'E-8-12345', 'N-1-234', '1AV-12-345', '13-1-1']) {
    assert.equal(validarRegistro({ ...valido, cedula }, 2).length, 0, cedula);
  }
});

test('rechaza una cédula incompleta', () => {
  const [error] = validarRegistro({ ...valido, cedula: '8-1234-' }, 3);
  assert.equal(error.campo, 'Cédula');
  assert.equal(error.fila, 3);
});

test('rechaza más de 31 días laborados', () => {
  const [error] = validarRegistro({ ...valido, dias_laborados: '32' }, 2);
  assert.equal(error.campo, 'Días laborados');
});

test('rechaza un salario vacío o con símbolo de moneda', () => {
  assert.equal(validarRegistro({ ...valido, salario: '' }, 2)[0].valor, '(vacío)');
  assert.equal(validarRegistro({ ...valido, salario: 'B/. 1100' }, 2)[0].campo, 'Salario devengado');
});

test('rechaza un código de ocupación fuera del catálogo', () => {
  assert.equal(validarRegistro({ ...valido, codigo_ocupacion: 'X99' }, 2)[0].campo, 'Código de ocupación');
});

test('reporta columnas faltantes en el encabezado', () => {
  const resultado = validarPlanilla(leerCsv('cedula,nombre\n8-123-456,Ana'));
  assert.equal(resultado.errores.length, 3);
  assert.equal(resultado.errores[0].fila, 1);
});

test('numera las filas como en Excel y suma salarios', () => {
  const csv = 'Cédula,Nombre,Salario,Días laborados,Código ocupación\n8-123-456,Ana,100.50,30,2411\n8-1-1,"Ríos, Luis",200,40,2411';
  const resultado = validarPlanilla(leerCsv(csv));
  assert.equal(resultado.filas, 2);
  assert.equal(resultado.filasConError, 1);
  assert.equal(resultado.errores[0].fila, 3);
  assert.equal(resultado.totalSalarios, 300.5);
});

// HU-14: feature flags de las reglas.
test('con todas las reglas activas por defecto, rechaza un código fuera del catálogo', () => {
  assert.equal(validarRegistro({ ...valido, codigo_ocupacion: 'X99' }, 2, reglasActivas()).length, 1);
});

test('una regla desactivada no reporta errores y las demás siguen activas', () => {
  const activas = reglasActivas(['codigo_ocupacion']);
  const registro = { ...valido, codigo_ocupacion: 'X99', dias_laborados: '40' };
  const errores = validarRegistro(registro, 2, activas);
  assert.deepEqual(errores.map((e) => e.campo), ['Días laborados']);
});

test('reglasActivas rechaza ids desconocidos', () => {
  assert.throws(() => reglasActivas(['no_existe']), /desconocidas: no_existe/);
});

test('HU-24: rechaza salario mayor que 0 cuando dias_laborados es 0', () => {
  const errores = validarRegistro({ ...valido, salario: '850.00', dias_laborados: '0' }, 2);
  assert.equal(errores.some((e) => e.campo === 'Días laborados'), true);
});
