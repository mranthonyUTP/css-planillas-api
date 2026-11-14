// HU-14: feature flags de las reglas de validación.
// Todas las reglas están activas salvo las listadas en REGLAS_DESACTIVADAS.
// Sirve para apagar una regla mientras se confirma contra la normativa vigente de la CSS
// (por ejemplo, el catálogo de ocupaciones) sin volver a desplegar código.
import { IDS_REGLAS } from './reglas.js';

export function reglasActivas(desactivadas = []) {
  const desconocidas = desactivadas.filter((id) => !IDS_REGLAS.includes(id));
  if (desconocidas.length > 0) {
    throw new Error(`REGLAS_DESACTIVADAS tiene reglas desconocidas: ${desconocidas.join(', ')}. Válidas: ${IDS_REGLAS.join(', ')}.`);
  }
  return new Set(IDS_REGLAS.filter((id) => !desactivadas.includes(id)));
}
