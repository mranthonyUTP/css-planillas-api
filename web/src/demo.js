// Atajos para la presentación del MVP: rellenan datos de prueba para no escribirlos a mano.
// Se ocultan con VITE_BOTONES_DEMO=false en el build o en el .env del portal.

export const MOSTRAR_DEMO = import.meta.env.VITE_BOTONES_DEMO !== 'false';

export const CREDENCIALES_DEMO = {
  ruc: '155123456-2-2020',
  usuario: 'ana.contabilidad',
  clave: 'demo1234',
};

// Archivos de public/ejemplos/.
export const EJEMPLOS = {
  correcta: 'planilla_correcta.csv',
  conErrores: 'planilla_con_errores.csv',
};

export async function cargarEjemplo(nombre) {
  const respuesta = await fetch(`/ejemplos/${nombre}`);
  if (!respuesta.ok) throw new Error('No pudimos cargar la planilla de ejemplo.');
  return new File([await respuesta.blob()], nombre, { type: 'text/csv' });
}
