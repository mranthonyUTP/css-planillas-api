export const ACCIONES_OPERADOR = ['enviar-operador', 'autorizar-operador', 'devolver-operador'];
export function revisionesPublicas(serie) {
  return (serie.eventos ?? []).filter(e => ACCIONES_OPERADOR.includes(e.accion))
    .map(({ accion, usuario, fecha, intentoId, motivo = '' }) => ({ accion, usuario, fecha, intentoId, motivo }));
}
export function revisionDeIntento(serie, intentoId = serie.ultimoIntentoId) {
  const evento = revisionesPublicas(serie).filter(e => e.intentoId === intentoId).at(-1);
  return evento ? { ...evento, estado: ({ 'enviar-operador': 'PENDIENTE', 'autorizar-operador': 'AUTORIZADA', 'devolver-operador': 'DEVUELTA' })[evento.accion] } : { estado: 'SIN_ENVIAR', intentoId };
}
export function aplicarRevisionOperador(original, entrada) {
  const fallar = (mensaje, codigo = 'estado_incompatible', estado = 409) => { throw Object.assign(new Error(mensaje), { estado, codigo }); };
  const { intentoId, accion, usuario, rol, clave, id, fecha, motivo = '' } = entrada;
  if (!ACCIONES_OPERADOR.includes(accion)) fallar('La acción no es válida.', 'solicitud_invalida', 400);
  if (rol !== (accion === 'enviar-operador' ? 'ELABORADOR' : 'OPERADOR')) fallar('Tu perfil no permite esta acción.', 'sin_permiso', 403);
  if (typeof motivo !== 'string' || motivo.length > 1000 || (accion === 'devolver-operador' && !motivo.trim())) fallar('Indica un motivo de hasta 1000 caracteres para devolver.', 'solicitud_invalida', 400);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(clave ?? '')) fallar('Incluye una clave de idempotencia válida.', 'solicitud_invalida', 400);
  if (original.ultimoIntentoId !== intentoId) fallar('Hay un intento más reciente. Actualiza la planilla.', 'intento_desactualizado');
  const intento = original.intentos.find(i => i.id === intentoId);
  if (!intento?.valida || intento.estructuraValida === false || intento.errores?.length) fallar('Corrige las observaciones de formato antes de enviar.', 'intento_no_valido');
  const huella = JSON.stringify([intentoId, accion, usuario, rol, motivo.trim()]);
  const previo = original.eventos.find(e => e.clave === clave);
  if (previo) { if (previo.huella !== huella) fallar('La clave ya corresponde a otra operación.', 'clave_reutilizada'); return structuredClone(original); }
  const estado = revisionDeIntento(original, intentoId).estado;
  if (accion === 'enviar-operador' ? !['SIN_ENVIAR', 'DEVUELTA'].includes(estado) : estado !== 'PENDIENTE') fallar('La planilla ya cambió de estado. Actualiza la vista.');
  const serie = structuredClone(original);
  serie.eventos.push({ id, accion, usuario, rol, intentoId, motivo: motivo.trim(), fecha, clave, huella });
  serie.actualizadaEn = fecha;
  return serie;
}
