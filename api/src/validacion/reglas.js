// Reglas de validación de la planilla (versión de ejemplo).
// Base para HU-01 (errores frecuentes) y HU-09 (pruebas unitarias).
// Deben confirmarse contra la normativa vigente de la CSS antes de usarse en producción.

export const COLUMNAS_OBLIGATORIAS = [
  'cedula',
  'nombre',
  'salario',
  'dias_laborados',
  'codigo_ocupacion',
];

export const NOMBRES_CAMPO = {
  cedula: 'Cédula',
  nombre: 'Nombre completo',
  salario: 'Salario devengado',
  dias_laborados: 'Días laborados',
  codigo_ocupacion: 'Código de ocupación',
};

// Catálogo de ejemplo. El catálogo real lo define la CSS.
export const CATALOGO_OCUPACIONES = new Set([
  '1120', '2411', '2511', '2512', '3313', '3322', '4110', '4120', '4311', '5223', '5414', '7112', '8322', '9112',
]);

// Provincias 1 a 13 (con prefijos AV y PI opcionales) y prefijos PE, E, N.
const PATRON_CEDULA = /^(?:(?:[1-9]|1[0-3])(?:AV|PI)?|PE|E|N)-\d{1,4}-\d{1,6}$/;

export function validarEncabezados(encabezados) {
  const faltantes = COLUMNAS_OBLIGATORIAS.filter((c) => !encabezados.includes(c));
  return faltantes.map((c) => ({
    fila: 1,
    campo: NOMBRES_CAMPO[c],
    valor: '(columna ausente)',
    problema: 'Falta una columna obligatoria.',
    solucion: `Agrega la columna "${c}" o usa la plantilla oficial.`,
  }));
}

export function validarRegistro(registro, numeroFila) {
  const errores = [];
  const agregar = (campo, valor, problema, solucion) =>
    errores.push({ fila: numeroFila, campo: NOMBRES_CAMPO[campo], valor: valor === '' ? '(vacío)' : valor, problema, solucion });

  const cedula = registro.cedula ?? '';
  if (cedula === '') {
    agregar('cedula', cedula, 'Este campo es obligatorio.', 'Escribe la cédula del trabajador, por ejemplo 8-123-456.');
  } else if (!PATRON_CEDULA.test(cedula.toUpperCase())) {
    agregar('cedula', cedula, 'La cédula no tiene un formato válido.', 'Usa el formato provincia-tomo-asiento, por ejemplo 8-123-456.');
  }

  if ((registro.nombre ?? '') === '') {
    agregar('nombre', '', 'Este campo es obligatorio.', 'Escribe el nombre completo del trabajador.');
  }

  const salario = registro.salario ?? '';
  if (salario === '') {
    agregar('salario', salario, 'Este campo es obligatorio.', 'Escribe el salario del período, sin símbolo de moneda.');
  } else if (!/^\d+(\.\d{1,2})?$/.test(salario)) {
    agregar('salario', salario, 'El salario debe ser un número.', 'Escribe solo el número, con punto decimal. Ejemplo: 1250.00');
  } else if (Number(salario) <= 0) {
    agregar('salario', salario, 'El salario debe ser mayor que 0.', 'Revisa el monto devengado en el período.');
  }

  const dias = registro.dias_laborados ?? '';
  if (dias === '') {
    agregar('dias_laborados', dias, 'Este campo es obligatorio.', 'Indica un número entre 0 y 31.');
  } else if (!/^\d+$/.test(dias) || Number(dias) > 31) {
    agregar('dias_laborados', dias, 'El mes no puede tener más de 31 días.', 'Indica un número entero entre 0 y 31.');
  }

  const codigo = registro.codigo_ocupacion ?? '';
  if (codigo === '') {
    agregar('codigo_ocupacion', codigo, 'Este campo es obligatorio.', 'Escribe el código de ocupación del trabajador.');
  } else if (!CATALOGO_OCUPACIONES.has(codigo)) {
    agregar('codigo_ocupacion', codigo, 'El código no existe en el catálogo.', 'Busca el código correcto en la especificación de campos.');
  }

  return errores;
}

// Valida una planilla ya leída. Las filas se numeran como en Excel: la 1 es el encabezado.
export function validarPlanilla({ encabezados, registros }) {
  const erroresEncabezado = validarEncabezados(encabezados);
  if (erroresEncabezado.length > 0) {
    return { errores: erroresEncabezado, filas: registros.length, filasConError: 0, totalSalarios: 0 };
  }

  if (registros.length === 0) {
    return {
      errores: [{ fila: 2, campo: 'Archivo', valor: '(sin filas)', problema: 'La planilla no tiene trabajadores.', solucion: 'Agrega al menos un trabajador debajo del encabezado.' }],
      filas: 0,
      filasConError: 0,
      totalSalarios: 0,
    };
  }

  const errores = registros.flatMap((r, i) => validarRegistro(r, i + 2));
  const filasConError = new Set(errores.map((e) => e.fila)).size;
  const totalSalarios = registros.reduce((s, r) => s + (Number(r.salario) || 0), 0);
  return { errores, filas: registros.length, filasConError, totalSalarios };
}
