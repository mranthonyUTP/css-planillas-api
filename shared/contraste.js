import { compararIntentos, centimos } from './planillas.js';

// El contraste señala diferencias respecto de un archivo aportado; no certifica su exactitud.
export function contrastarPlanilla(planilla, referencia, archivo = null) {
  const resultado = { version: 1, estado: 'no_realizado', referencia: archivo ? { archivo } : null,
    comprobado: [], noVerificado: ['identidad_oficial', 'sueldo_real', 'exactitud_referencia', 'nombres', 'otros_rubros', 'periodo_contenido', 'cuotas_css', 'aceptacion_css'],
    diferencias: [], sinDiferencias: [], conflictos: [] };
  if (!referencia) return resultado;
  const conflictos = resultado.conflictos;
  for (const [lado, datos] of [['planilla', planilla], ['referencia', referencia]]) {
    if (datos.estructuraValida === false || !datos.trabajadores?.length) conflictos.push({ lado, codigo: 'ESTRUCTURA_INVALIDA', motivo: 'El archivo no tiene una estructura válida con trabajadores.' });
    for (const t of datos.trabajadores ?? []) if (centimos(t.sueldo) === null) conflictos.push({ lado, fila: t.fila, codigo: 'SUELDO_ILEGIBLE', motivo: 'El sueldo no es un importe legible.' });
  }
  // Proyectar únicamente sueldo evita presentar cambios de nombres o rubros como comprobados.
  const proyectar = (datos) => ({ trabajadores: (datos.trabajadores ?? []).map(t => ({
    clave: t.clave, fila: t.fila, documento: t.documento, nombreCompleto: t.nombreCompleto,
    rubros: { sueldo: t.sueldo },
  })) });
  const comparacion = compararIntentos(proyectar(referencia), proyectar(planilla));
  conflictos.push(...comparacion.conflictos.map(c => ({ ...c, lado: c.lado === 'anterior' ? 'referencia' : 'planilla', codigo: 'IDENTIDAD_AMBIGUA' })));
  if (conflictos.length) { resultado.estado = 'no_comparable'; return resultado; }
  const resumir = t => ({ clave: t.clave, fila: t.fila, documento: t.documento, nombre: t.nombreCompleto, sueldo: t.sueldo ?? t.rubros.sueldo });
  const antes = new Map(referencia.trabajadores.map(t => [t.clave, t]));
  const despues = new Map(planilla.trabajadores.map(t => [t.clave, t]));
  const diferencia = (codigo, a, b) => ({ codigo, resultado: 'para_revisar', referencia: a ? resumir(a) : null, planilla: b ? resumir(b) : null });
  for (const cambio of comparacion.cambios.filter(c => c.campo === 'sueldo')) resultado.diferencias.push(diferencia('SUELDO_DISTINTO', antes.get(cambio.clave), despues.get(cambio.clave)));
  for (const t of comparacion.bajas) resultado.diferencias.push(diferencia('SOLO_REFERENCIA', antes.get(t.clave), null));
  for (const t of comparacion.altas) resultado.diferencias.push(diferencia('SOLO_PLANILLA', null, despues.get(t.clave)));
  for (const t of planilla.trabajadores) if (antes.has(t.clave) && centimos(antes.get(t.clave).sueldo) === centimos(t.sueldo)) resultado.sinDiferencias.push(resumir(t));
  resultado.estado = 'realizado'; resultado.comprobado = ['relacion_por_documento', 'presencia_trabajadores', 'sueldo'];
  return resultado;
}
