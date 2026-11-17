import { randomUUID } from 'node:crypto';
import { conflicto, solicitudInvalida } from '../errores.js';

export function crearSerie(intento) {
  return { id: randomUUID(), empresaRuc: intento.empresaRuc, empresaNombre: intento.empresaNombre,
    periodo: intento.periodo, tipo: intento.tipo, estado: 'BORRADOR', ultimoIntentoId: null,
    creadaEn: intento.validadaEn, actualizadaEn: intento.validadaEn, intentos: [], eventos: [], comprobante: null };
}
// Una carga agrega un snapshot y mantiene las decisiones de los intentos anteriores.
export function agregarIntento(original, recibido) {
  if (original.empresaRuc !== recibido.empresaRuc || original.periodo !== recibido.periodo || original.tipo !== recibido.tipo) {
    throw conflicto('La corrección debe conservar empresa, período y tipo de la serie.', 'serie_incompatible');
  }
  const serie = structuredClone(original);
  if (serie.intentos.some((i) => i.id === recibido.id)) throw conflicto('El intento ya existe.', 'intento_existente');
  const intento = { ...structuredClone(recibido), serieId: serie.id, numero: serie.intentos.length + 1 };
  serie.intentos.push(intento); serie.ultimoIntentoId = intento.id;
  serie.actualizadaEn = intento.validadaEn; serie.estado = 'BORRADOR'; serie.comprobante = null;
  serie.eventos.push({ id: randomUUID(), accion: 'carga', decision: null, motivo: '', usuario: intento.usuario,
    rol: 'ELABORADOR', intentoId: intento.id, fecha: intento.validadaEn });
  return serie;
}
export function resumirSerie(serie) {
  const { intentos, eventos, comprobante, ...resumen } = serie;
  const ultimo = intentos.find((i) => i.id === serie.ultimoIntentoId);
  const campos = ['id', 'numero', 'archivo', 'usuario', 'validadaEn', 'filas', 'filasConError', 'totalSalarios', 'valida', 'estructuraValida', 'salariosValidos', 'totalSalariosParcial'];
  const ultimoIntentoResumen = ultimo ? Object.fromEntries(campos.map((k) => [k, ultimo[k]])) : null;
  return { ...resumen, numeroIntentos: intentos.length, ultimoIntentoResumen };
}
export function resumirActividadPropia(serie, { usuario, rol }) {
  const acciones = {
    OPERADOR: ['aprobar', 'devolver-revision'],
    AUTORIZADOR: ['autorizar', 'devolver-autorizacion'],
  }[rol] ?? [];
  const evento = [...serie.eventos].reverse().find((e) =>
    e.usuario === usuario && e.rol === rol && acciones.includes(e.accion));
  if (!evento) return null;
  const intento = serie.intentos.find((i) => i.id === evento.intentoId);
  const ultimaDecisionPropia = {
    id: evento.id, accion: evento.accion, decision: evento.decision,
    motivo: evento.motivo, usuario: evento.usuario, rol: evento.rol,
    intentoId: evento.intentoId, fecha: evento.fecha,
    numeroIntento: intento?.numero ?? null, archivo: intento?.archivo ?? null,
    esIntentoActual: evento.intentoId === serie.ultimoIntentoId,
  };
  return { ...resumirSerie(serie), ultimaDecisionPropia };
}
export function transicionar(original, entrada) {
  const { intentoId, accion, decision, motivo = '', usuario, rol, clave } = entrada;
  const huella = JSON.stringify([intentoId, accion, decision ?? '', motivo, usuario, rol]);
  const previo = original.eventos.find((e) => e.clave === clave);
  if (previo) {
    if (previo.huella !== huella) throw conflicto('La clave de idempotencia ya corresponde a otra decisión.', 'clave_reutilizada');
    if (original.ultimoIntentoId !== intentoId) throw conflicto('Hay un intento más reciente. Actualiza la planilla.', 'intento_desactualizado');
    return structuredClone(original);
  }
  if (original.ultimoIntentoId !== intentoId) throw conflicto('Hay un intento más reciente. Actualiza la planilla.', 'intento_desactualizado');
  const intento = original.intentos.find((i) => i.id === intentoId);
  if (!intento?.valida) throw conflicto('El intento tiene observaciones pendientes.', 'intento_no_valido');
  if (({ solicitar: 'ELABORADOR', revisar: 'OPERADOR', autorizar: 'AUTORIZADOR' })[accion] !== rol) throw conflicto('El rol no corresponde a esta decisión.', 'rol_incompatible');
  let estado, eventoAccion;
  if (accion === 'solicitar') {
    if (!['BORRADOR', 'DEVUELTA'].includes(original.estado)) throw conflicto('La planilla no está disponible para solicitar revisión.', 'estado_incompatible');
    estado = 'PENDIENTE_REVISION'; eventoAccion = 'solicitar';
  } else {
    const requerido = accion === 'revisar' ? 'PENDIENTE_REVISION' : 'PENDIENTE_AUTORIZACION';
    if (original.estado !== requerido) throw conflicto('La planilla cambió de estado. Actualiza la vista.', 'estado_incompatible');
    if (decision === 'devolver') {
      if (typeof motivo !== 'string' || !motivo.trim()) throw solicitudInvalida('Indica el motivo de la devolución.');
      estado = 'DEVUELTA'; eventoAccion = accion === 'revisar' ? 'devolver-revision' : 'devolver-autorizacion';
    } else if (accion === 'revisar' && decision === 'aprobar') {
      estado = 'PENDIENTE_AUTORIZACION'; eventoAccion = 'aprobar';
    } else if (accion === 'autorizar' && decision === 'autorizar') {
      estado = 'AUTORIZADA'; eventoAccion = 'autorizar';
    } else throw solicitudInvalida('La decisión no es válida.');
  }
  const serie = structuredClone(original), fecha = new Date().toISOString();
  serie.estado = estado; serie.actualizadaEn = fecha;
  serie.eventos.push({ id: randomUUID(), accion: eventoAccion, decision: decision ?? null, motivo: motivo.trim(), usuario, rol, intentoId, fecha, clave, huella });
  if (estado === 'AUTORIZADA') {
    serie.comprobante = { confirmacion: `INT-${randomUUID()}`, autorizadoEn: fecha, autorizadoPor: usuario, intentoId };
    serie.eventos.at(-1).comprobante = structuredClone(serie.comprobante);
  } else serie.comprobante = null;
  return serie;
}
export function cargaDeEvento(serie, evento) {
  const intento = serie.intentos.find((i) => i.id === evento.intentoId);
  return { id: evento.id, fecha: evento.fecha, empresaRuc: serie.empresaRuc, usuario: evento.usuario,
    periodo: serie.periodo, archivo: intento.archivo, serieId: serie.id, intentoId: intento.id,
    tipo: evento.accion === 'carga' ? 'Pre-validación' : 'Flujo interno',
    resultado: evento.accion === 'carga' ? (intento.valida ? 'Sin errores' : 'Con errores') : evento.accion,
    confirmacion: evento.comprobante?.confirmacion ?? (serie.comprobante?.intentoId === intento.id ? serie.comprobante.confirmacion : null) };
}
