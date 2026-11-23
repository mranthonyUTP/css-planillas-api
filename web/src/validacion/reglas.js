// Puente hacia api/src/validacion/reglas.js para mantener una sola fuente de verdad en las reglas.
export {
  COLUMNAS_OBLIGATORIAS,
  NOMBRES_CAMPO,
  IDS_REGLAS,
  CATALOGO_OCUPACIONES,
  validarEncabezados,
  validarRegistro,
  validarPlanilla,
} from '../../../api/src/validacion/reglas.js';
