// Identificación y rubros del formato de referencia del manual de carga aportado.
// Incluye motor de prevalidación y cálculo referencial de cuotas CSS (Ley 462, HU-23).
export const RUBROS = [
  ['sueldo', 'Sueldo'], ['horas_extras', 'Horas extras'],
  ['impuesto_sobre_renta', 'Impuesto sobre renta'], ['decimo_tercer_mes', 'Décimo tercer mes'],
  ['vacaciones', 'Vacaciones'], ['comisiones', 'Comisiones'],
  ['bonificaciones', 'Bonificaciones'], ['combustible', 'Combustible'],
  ['dieta', 'Dieta'], ['salario_en_especie', 'Salario en especie'],
  ['viaticos', 'Viáticos'], ['gasto_de_representacion', 'Gasto de representación'],
  ['impuesto_sobre_renta_gasto_representacion', 'Impuesto sobre renta gasto representación'],
  ['decimo_tercer_mes_gasto_representacion', 'Décimo tercer mes gasto representación'],
  ['primas_de_produccion', 'Primas de producción'], ['dividendo', 'Dividendo'],
  ['participacion_beneficio_ingresos', 'Participación beneficio ingresos'],
  ['gratificacion_aguinaldo', 'Gratificación aguinaldo'],
  ['preaviso', 'Preaviso'], ['indemnizacion', 'Indemnización'],
].map(([id, nombre]) => Object.freeze({ id, nombre }));
export const NOMBRES_SIPE = Object.freeze({
  tipo_documento: 'Tipo de documento', numero_documento: 'Número de documento',
  numero_seguro_social: 'Número de seguro social', nombre: 'Nombre', apellido: 'Apellido',
  ...Object.fromEntries(RUBROS.map(({ id, nombre }) => [id, nombre])),
});
export const COLUMNAS_SIPE = Object.freeze(Object.keys(NOMBRES_SIPE));
const LIMITE_CENTIMOS = 99_999_999_999_999;
const ALIAS = {
  tipo_de_documento: 'tipo_documento', numero_de_documento: 'numero_documento',
  numero_de_seguro_social: 'numero_seguro_social', seguro_social: 'numero_seguro_social', nss: 'numero_seguro_social',
  n_de_seguro_social: 'numero_seguro_social', apellidos: 'apellido', nombre_completo: 'nombre', sueldos: 'sueldo',
  impuesto_sobre_la_renta: 'impuesto_sobre_renta', gastos_de_representacion: 'gasto_de_representacion',
  gasto_representacion: 'gasto_de_representacion',
  impuesto_sobre_renta_gasto_de_representacion: 'impuesto_sobre_renta_gasto_representacion',
  impuesto_sobre_la_renta_gasto_de_representacion: 'impuesto_sobre_renta_gasto_representacion',
  impuesto_sobre_la_renta_gasto_representacion: 'impuesto_sobre_renta_gasto_representacion',
  decimo_tercer_mes_gasto_de_representacion: 'decimo_tercer_mes_gasto_representacion',
  primas_produccion: 'primas_de_produccion', participacion_en_beneficios_o_utilidades: 'participacion_beneficio_ingresos',
  participacion_beneficio_ingreso: 'participacion_beneficio_ingresos',
  participacion_en_beneficios_ingresos: 'participacion_beneficio_ingresos',
  gratificaciones_y_aguinaldos: 'gratificacion_aguinaldo', gratificaciones_aguinaldos: 'gratificacion_aguinaldo', pre_aviso: 'preaviso',
};
export function normalizarEncabezado(valor) {
  const id = String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\n\r]+/g, '_').replace(/_+/g, '_');
  return Object.hasOwn(ALIAS, id) ? ALIAS[id] : id;
}
export function esFormatoSipe(encabezados = []) {
  return encabezados.some((h) => ['tipo_documento', 'numero_documento', 'sueldo'].includes(normalizarEncabezado(h)));
}
export function centimos(valor) {
  const texto = String(valor ?? '').trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(texto)) return null;
  const negativo = texto.startsWith('-');
  const [entero, decimal = ''] = texto.replace(/^-/, '').split('.');
  const n = Number(entero) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(n) && n <= LIMITE_CENTIMOS ? (negativo ? -n : n) : null;
}
function clavePersona(tipo, documento) {
  let t = normalizarEncabezado(tipo);
  if (['cedula_no_verificada', 'cedula_verificada'].includes(t)) t = 'cedula';
  const d = String(documento ?? '').trim().toUpperCase().replace(/\s/g, '');
  return t && d ? `${t}:${d}` : '';
}
export function construirTrabajadores(registros = [], errores = [], formato = 'sipe-referencia-2019') {
  return registros.map((original, i) => {
    const r = Object.fromEntries(Object.entries(original).map(([k, v]) => [normalizarEncabezado(k), String(v ?? '').trim()]));
    const fila = Number(original.__fila) || i + 2;
    const legacy = formato === 'demo-5-columnas';
    const tipoDocumento = legacy ? 'Cédula' : r.tipo_documento ?? '';
    const documento = legacy ? r.cedula ?? '' : r.numero_documento ?? '';
    const nombre = r.nombre ?? '';
    const apellido = legacy ? '' : r.apellido ?? '';
    const rubros = legacy ? { sueldo: r.salario ?? '' } : Object.fromEntries(RUBROS.map(({ id }) => [id, r[id] ?? '']));
    const delTrabajador = errores.filter((e) => e.fila === fila);
    return { fila, clave: clavePersona(tipoDocumento, documento), tipoDocumento, documento,
      seguroSocial: r.numero_seguro_social ?? '', nombre, apellido,
      nombreCompleto: [nombre, apellido].filter(Boolean).join(' '), sueldo: rubros.sueldo,
      rubros, errores: delTrabajador, valido: delTrabajador.length === 0,
      ...(legacy ? { adicionales: { dias_laborados: r.dias_laborados ?? '', codigo_ocupacion: r.codigo_ocupacion ?? '' } } : {}) };
  });
}
export function erroresIdentidad(trabajadores) {
  const vistos = new Map();
  for (const t of trabajadores) {
    if (!t.clave) continue;
    if (!vistos.has(t.clave)) vistos.set(t.clave, []);
    vistos.get(t.clave).push(t);
  }
  const errores = [];
  for (const repetidos of vistos.values()) if (repetidos.length > 1) for (const t of repetidos) errores.push({
    fila: t.fila, campo: 'Número de documento', campoId: 'numero_documento', valor: t.documento,
    problema: 'La identidad del trabajador está repetida en este archivo.',
    solucion: 'Revisa los registros de esta persona. Cada identidad debe aparecer una sola vez por intento.',
  });
  return errores;
}
export function validarFormatoSipe({ encabezados = [], registros = [], filaEncabezado = 1 }) {
  const hs = encabezados.map(normalizarEncabezado);
  const errores = [];
  const agregar = (fila, id, valor, problema, solucion) => errores.push({
    fila, campo: Object.hasOwn(NOMBRES_SIPE, id) ? NOMBRES_SIPE[id] : id, campoId: id,
    valor: valor === '' ? '(vacío)' : String(valor), problema, solucion,
  });
  for (const id of COLUMNAS_SIPE) if (!hs.includes(id)) agregar(filaEncabezado, id, '(columna ausente)',
    'Falta una columna del formato de referencia.', `Conserva la columna «${NOMBRES_SIPE[id]}» del archivo de referencia.`);
  for (const id of new Set(hs.filter((h, i) => hs.indexOf(h) !== i))) agregar(filaEncabezado, id, id,
    'El encabezado está repetido.', 'Utiliza una sola columna por campo.');
  for (const id of new Set(hs.filter((h) => !COLUMNAS_SIPE.includes(h)))) agregar(filaEncabezado, id || 'Encabezado', id || '(vacío)',
    'Esta columna no pertenece al formato de referencia seleccionado.', 'Conserva los 25 encabezados de la plantilla de referencia.');
  if (!registros.length) agregar(2, 'Archivo', '(sin filas)', 'La planilla no tiene trabajadores.', 'Agrega registros debajo del encabezado.');
  if (registros.length > 10000) agregar(1, 'Archivo', registros.length, 'El archivo supera el límite técnico de 10 000 registros.', 'Divide el archivo en grupos separados.');
  const normalizados = registros.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normalizarEncabezado(k), String(v ?? '').trim()])));
  const estructuraValida = hs.length === COLUMNAS_SIPE.length && !errores.some((e) => e.fila === filaEncabezado);
  if (estructuraValida && registros.length <= 10000) normalizados.forEach((r, i) => {
    const fila = Number(registros[i].__fila) || i + 2;
    for (const id of ['tipo_documento', 'numero_documento', 'nombre']) if (!r[id]) agregar(fila, id, '',
      'Falta un dato para identificar el registro.', 'Completa este dato en el archivo original.');
    for (const { id } of RUBROS) {
      const valor = r[id] ?? '';
      if (id === 'sueldo' && valor === '') agregar(fila, id, '', 'Falta el sueldo declarado.', 'Indica el sueldo como número; cero es distinto de vacío.');
      else if (valor !== '' && centimos(valor) === null) agregar(fila, id, valor,
        'Se esperaba un importe numérico con hasta dos decimales.', 'Revisa el valor en el Excel original. Usa punto decimal y no incluyas símbolos ni fórmulas.');
    }
    const tipoDoc = normalizarEncabezado(r.tipo_documento);
    if (tipoDoc === 'pasaporte' && r.numero_documento && !/^[A-Z0-9]{5,20}$/i.test(r.numero_documento)) {
      agregar(fila, 'numero_documento', r.numero_documento,
        'El número de pasaporte debe ser alfanumérico de 5 a 20 caracteres sin espacios ni guiones.',
        'Elimina espacios o símbolos y verifica el código del pasaporte.');
    }
    const sueldoCent = centimos(r.sueldo);
    const extrasCent = centimos(r.horas_extras);
    if (sueldoCent === 0 && extrasCent !== null && extrasCent > 0) {
      agregar(fila, 'horas_extras', r.horas_extras,
        'No se deben declarar horas extras cuando el sueldo base es 0.00.',
        'Verifica si corresponde declarar sueldo ordinario o corrige el monto de horas extras.');
    }
  });
  const iniciales = construirTrabajadores(registros.slice(0, 10000), errores);
  if (estructuraValida) errores.push(...erroresIdentidad(iniciales));
  let total = 0;
  let salariosValidos = 0;
  if (estructuraValida) for (const t of iniciales) {
    const valor = centimos(t.sueldo);
    if (valor !== null) { total += valor; salariosValidos++; }
  }
  if (!Number.isSafeInteger(total) || Math.abs(total) > LIMITE_CENTIMOS) {
    agregar(1, 'sueldo', '(total fuera de rango)', 'El total supera el límite técnico de almacenamiento.', 'Revisa los importes o divide el archivo en grupos separados.');
    total = 0;
  }
  return { formato: 'sipe-referencia-2019', estructuraValida, errores, filas: registros.length,
    filasConError: new Set(errores.filter((e) => e.fila > filaEncabezado).map((e) => e.fila)).size,
    totalSalarios: total / 100, salariosValidos, totalSalariosParcial: salariosValidos !== registros.length,
    trabajadores: construirTrabajadores(registros.slice(0, 10000), errores) };
}
function indicePersonas(trabajadores, lado, conflictos) {
  const mapa = new Map();
  for (const t of trabajadores) {
    if (!t.clave) { conflictos.push({ lado, fila: t.fila, motivo: 'El registro no tiene una identidad completa.' }); continue; }
    if (mapa.has(t.clave)) conflictos.push({ lado, fila: t.fila, motivo: 'Hay identidades repetidas; no se puede decidir qué registros corresponden.' });
    mapa.set(t.clave, t);
  }
  return mapa;
}
function valorCampo(t, campo) {
  if (campo === 'tipo_documento') return t.tipoDocumento ?? '';
  if (campo === 'numero_documento') return t.documento ?? '';
  if (campo === 'numero_seguro_social') return t.seguroSocial ?? '';
  if (campo === 'nombre') return t.nombre ?? '';
  if (campo === 'apellido') return t.apellido ?? '';
  return t.rubros?.[campo] ?? t.adicionales?.[campo] ?? '';
}
export function compararIntentos(anterior, actual) {
  const conflictos = [];
  for (const [lado, intento] of [['anterior', anterior], ['actual', actual]]) if (!Array.isArray(intento?.trabajadores)) conflictos.push({ lado, motivo: 'Este intento no conserva el detalle de trabajadores.' });
  const antes = indicePersonas(anterior?.trabajadores ?? [], 'anterior', conflictos);
  const despues = indicePersonas(actual?.trabajadores ?? [], 'actual', conflictos);
  const datos = (v) => ({ id: v?.id, numero: v?.numero, archivo: v?.archivo, validadaEn: v?.validadaEn, filas: v?.filas, filasConError: v?.filasConError, valida: v?.valida });
  const resultado = { anterior: datos(anterior), actual: datos(actual), cambios: [], altas: [], bajas: [], sinCambios: 0,
    totales: { antes: { trabajadores: anterior?.filas ?? 0, sueldos: anterior?.totalSalarios ?? 0 }, despues: { trabajadores: actual?.filas ?? 0, sueldos: actual?.totalSalarios ?? 0 } },
    conflictos, comparable: conflictos.length === 0 };
  if (conflictos.length) return resultado;
  for (const [clave, t] of antes) {
    const n = despues.get(clave);
    if (!n) { resultado.bajas.push(t); continue; }
    let cantidad = 0;
    const campos = [...COLUMNAS_SIPE, ...new Set([...Object.keys(t.adicionales ?? {}), ...Object.keys(n.adicionales ?? {})])];
    for (const campo of campos) {
      const a = String(valorCampo(t, campo));
      const b = String(valorCampo(n, campo));
      const numerico = RUBROS.some((r) => r.id === campo);
      if (a === b || (numerico && centimos(a) !== null && centimos(b) !== null && centimos(a) === centimos(b))) continue;
      cantidad++;
      resultado.cambios.push({ clave, nombre: n.nombreCompleto, documento: n.documento, filaAnterior: t.fila, filaActual: n.fila, campo,
        campoNombre: NOMBRES_SIPE[campo] ?? ({ dias_laborados: 'Días laborados', codigo_ocupacion: 'Código de ocupación' })[campo] ?? campo, antes: a, despues: b });
    }
    if (!cantidad) resultado.sinCambios++;
  }
  for (const [clave, t] of despues) if (!antes.has(clave)) resultado.altas.push(t);
  return resultado;
}

// HU-23: Cálculo referencial de cuotas obrero-patronales CSS (Ley 462 de 2025) parametrizado por período y salario neto estimado.
const RUBROS_GRAVABLES_ORDINARIOS = [
  'sueldo', 'horas_extras', 'vacaciones', 'comisiones',
  'bonificaciones', 'salario_en_especie', 'primas_de_produccion',
  'participacion_beneficio_ingresos', 'gratificacion_aguinaldo', 'preaviso',
];
const RUBROS_DECIMO = ['decimo_tercer_mes', 'decimo_tercer_mes_gasto_representacion'];

export function obtenerTasasCss(periodo = '', tasaRiesgos = 0.015) {
  const p = String(periodo ?? '').trim();
  // Escalonamiento Ley 462 de 2025 (Art. 101):
  // Hasta 2027-02: 13.25% patronal | Desde 2027-03: 14.25% patronal | Desde 2029-03: 15.25% patronal
  let ssPatronal = 0.1325;
  let tramoLey462 = 'Vigente hasta feb. 2027 (13.25 %)';
  if (p >= '2029-03') {
    ssPatronal = 0.1525;
    tramoLey462 = 'Tramo mar. 2029+ (15.25 %)';
  } else if (p >= '2027-03') {
    ssPatronal = 0.1425;
    tramoLey462 = 'Tramo mar. 2027 – feb. 2029 (14.25 %)';
  }
  return {
    ssEmpleado: 0.0975,
    ssPatronal,
    seEmpleado: 0.0125,
    sePatronal: 0.015,
    decimoEmpleado: 0.0725,
    decimoPatronal: 0.1075,
    riesgosProfesionales: tasaRiesgos,
    tramoLey462,
  };
}

export function calcularCuotasTrabajador(trabajador, opciones = {}) {
  const { tasaRiesgos = 0.015, periodo = '' } = typeof opciones === 'number' ? { tasaRiesgos: opciones } : opciones;
  const tasas = obtenerTasasCss(periodo, tasaRiesgos);
  const r = trabajador?.rubros ?? {};
  const sumaCentimos = (ids) => ids.reduce((acc, id) => {
    const val = id === 'sueldo' ? (r.sueldo ?? trabajador?.sueldo) : r[id];
    const c = centimos(val);
    return acc + (c !== null && c > 0 ? c : 0);
  }, 0);

  const baseOrdinaria = sumaCentimos(RUBROS_GRAVABLES_ORDINARIOS) / 100;
  const baseDecimo = sumaCentimos(RUBROS_DECIMO) / 100;
  const baseSS = Math.round((baseOrdinaria + baseDecimo) * 100) / 100;
  const gastoRep = Math.max(0, centimos(r.gasto_de_representacion) ?? 0) / 100;
  const isr = (Math.max(0, centimos(r.impuesto_sobre_renta) ?? 0) + Math.max(0, centimos(r.impuesto_sobre_renta_gasto_representacion) ?? 0)) / 100;

  const redondear = (n) => Math.round(n * 100) / 100;

  // SS Ordinario + SS Décimo Tercer Mes (7.25% emp. / 10.75% pat.)
  const ssEmpleado = redondear(baseOrdinaria * tasas.ssEmpleado + baseDecimo * tasas.decimoEmpleado);
  const ssPatronal = redondear(baseOrdinaria * tasas.ssPatronal + baseDecimo * tasas.decimoPatronal);
  const seEmpleado = redondear(baseOrdinaria * tasas.seEmpleado);
  const sePatronal = redondear(baseOrdinaria * tasas.sePatronal);
  const riesgosProfesionales = redondear(baseOrdinaria * tasas.riesgosProfesionales);
  const totalEmpleado = redondear(ssEmpleado + seEmpleado);
  const totalPatronal = redondear(ssPatronal + sePatronal + riesgosProfesionales);
  const totalCss = redondear(totalEmpleado + totalPatronal);
  const salarioNetoEstimado = redondear(Math.max(0, (baseSS + gastoRep) - totalEmpleado - isr));

  return {
    baseCotizable: baseSS,
    baseOrdinaria: redondear(baseOrdinaria),
    baseDecimo: redondear(baseDecimo),
    gastoRepresentacion: redondear(gastoRep),
    isrDeclarado: redondear(isr),
    ssEmpleado,
    ssPatronal,
    seEmpleado,
    sePatronal,
    riesgosProfesionales,
    totalEmpleado,
    totalPatronal,
    totalCss,
    salarioNetoEstimado,
    tasas,
  };
}

export function calcularCuotasPlanilla(trabajadores = [], opciones = {}) {
  const { tasaRiesgos = 0.015, periodo = '' } = typeof opciones === 'number' ? { tasaRiesgos: opciones } : opciones;
  const tasas = obtenerTasasCss(periodo, tasaRiesgos);
  const acum = {
    baseCotizable: 0,
    baseOrdinaria: 0,
    baseDecimo: 0,
    gastoRepresentacion: 0,
    isrDeclarado: 0,
    ssEmpleado: 0,
    ssPatronal: 0,
    seEmpleado: 0,
    sePatronal: 0,
    riesgosProfesionales: 0,
    totalEmpleado: 0,
    totalPatronal: 0,
    totalCss: 0,
    salarioNetoEstimado: 0,
    trabajadoresCalculados: 0,
    tasas,
  };
  for (const t of trabajadores) {
    const c = calcularCuotasTrabajador(t, { tasaRiesgos, periodo });
    if (c.baseCotizable <= 0 && c.gastoRepresentacion <= 0) continue;
    acum.trabajadoresCalculados++;
    for (const k of [
      'baseCotizable', 'baseOrdinaria', 'baseDecimo', 'gastoRepresentacion', 'isrDeclarado',
      'ssEmpleado', 'ssPatronal', 'seEmpleado', 'sePatronal', 'riesgosProfesionales',
      'totalEmpleado', 'totalPatronal', 'totalCss', 'salarioNetoEstimado',
    ]) {
      acum[k] = Math.round((acum[k] + c[k]) * 100) / 100;
    }
  }
  return acum;
}
