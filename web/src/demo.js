// Cuentas y archivos de prueba para recorrer los perfiles del portal.

export const MOSTRAR_DEMO = import.meta.env.VITE_BOTONES_DEMO === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_BOTONES_DEMO !== 'false');

export const CREDENCIALES_DEMO = {
  ruc: '155123456-2-2020',
  usuario: 'ana.contabilidad',
  clave: 'demo1234',
};

export const ACCESOS_DEMO = [
  { etiqueta: 'Responsable', credenciales: CREDENCIALES_DEMO },
  { etiqueta: 'Operador', credenciales: { ...CREDENCIALES_DEMO, usuario: 'operador' } },
  { etiqueta: 'Empresa 2', credenciales: { ruc: '155987654-1-2021', usuario: 'empresa.dos', clave: 'demo1234' } },
];

export const EJEMPLOS = {
  correcta: 'sipe_referencia_correcta.xlsx',
  conErrores: 'sipe_referencia_con_observaciones.xlsx',
  corregida: 'sipe_referencia_corregida.xlsx',
};

export async function cargarEjemplo(nombre) {
  const respuesta = await fetch(`/ejemplos/${nombre}`);
  if (!respuesta.ok) throw new Error('No pudimos cargar la planilla de ejemplo.');
  const tipo = nombre.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
  return new File([await respuesta.blob()], nombre, { type: tipo });
}
