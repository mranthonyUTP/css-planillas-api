// Sistema de nómina de ejemplo: datos sintéticos y cuenta local de demostración.
// Cada ejecución crea una serie con dos intentos en la API indicada.
import assert from 'node:assert/strict';
const base = process.env.API_URL ?? 'http://localhost:3000';
async function leer(respuesta) {
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(`${respuesta.status}: ${datos.mensaje}`);
  return datos;
}
const sesion = await leer(await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruc: '155123456-2-2020', usuario: 'ana.contabilidad', clave: process.env.DEMO_PASSWORD ?? 'demo1234' }) }));
const referencia = 'cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-000-1001,María Pérez,1200.00,30,2411\n8-000-1002,Luis Gómez,1100.00,30,2411\n8-000-1003,Ana Ríos,980.50,30,2411\n';
async function enviar(contenido, serieId) {
  const form = new FormData(); form.append('archivo', new Blob([contenido]), 'piloto_planilla.csv');
  form.append('referencia', new Blob([referencia]), 'piloto_referencia.csv'); form.append('periodo', '2026-11'); form.append('tipo', 'Regular');
  if (serieId) form.append('serieId', serieId);
  return leer(await fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${sesion.token}` }, body: form }));
}
const inicial = await enviar(referencia.replace('1200.00', '1250.00').replace('8-000-1003,Ana Ríos,980.50', '8-000-1004,Carlos Ruiz,1350.00'));
assert.equal(inicial.contraste?.diferencias.length, 3);
const corregido = await enviar(referencia, inicial.serieId);
assert.equal(corregido.numero, 2); assert.equal(corregido.contraste.diferencias.length, 0);
console.log(JSON.stringify({ demostracion: 'Cuenta local y datos sintéticos; no es una identidad de servicio productiva', serieId: inicial.serieId, intentoInicial: inicial.contraste, intentoCorregido: corregido.contraste }, null, 2));
