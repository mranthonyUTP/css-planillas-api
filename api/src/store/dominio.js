import { estadoIntento } from '../../../shared/estado.js';
import { randomUUID } from 'node:crypto';
import { conflicto } from '../errores.js';
import { revisionDeIntento } from '../../../shared/revision-operador.js';

export function crearSerie(intento) {
  return { id: randomUUID(), empresaRuc: intento.empresaRuc, empresaNombre: intento.empresaNombre,
    periodo: intento.periodo, tipo: intento.tipo, estado: estadoIntento(intento), ultimoIntentoId: null,
    creadaEn: intento.validadaEn, actualizadaEn: intento.validadaEn, intentos: [], eventos: [] };
}
// Cada carga conserva un snapshot del intento anterior.
export function agregarIntento(original, recibido) {
  if (original.empresaRuc !== recibido.empresaRuc || original.periodo !== recibido.periodo || original.tipo !== recibido.tipo) {
    throw conflicto('La corrección debe conservar empresa, período y tipo de la serie.', 'serie_incompatible');
  }
  const serie = structuredClone(original);
  if (serie.intentos.some((i) => i.id === recibido.id)) throw conflicto('El intento ya existe.', 'intento_existente');
  const intento = { ...structuredClone(recibido), serieId: serie.id, numero: serie.intentos.length + 1 };
  serie.intentos.push(intento); serie.ultimoIntentoId = intento.id;
  serie.actualizadaEn = intento.validadaEn; serie.estado = estadoIntento(intento); delete serie.comprobante;
  serie.eventos.push({ id: randomUUID(), accion: 'carga', usuario: intento.usuario,
    intentoId: intento.id, fecha: intento.validadaEn });
  return serie;
}
export function resumirSerie(serie) {
  const { intentos, eventos, comprobante, ...resumen } = serie;
  const ultimo = intentos.find((i) => i.id === serie.ultimoIntentoId);
  const campos = ['id', 'numero', 'archivo', 'usuario', 'validadaEn', 'filas', 'filasConError', 'totalSalarios', 'valida', 'estructuraValida', 'salariosValidos', 'totalSalariosParcial'];
  const ultimoIntentoResumen = ultimo ? Object.fromEntries(campos.map((k) => [k, ultimo[k]])) : null;
  return { ...resumen, estado: estadoIntento(ultimo), revisionInterna: revisionDeIntento(serie), numeroIntentos: intentos.length, ultimoIntentoResumen };
}
export function cargaDeEvento(serie, evento) {
  const intento = serie.intentos.find((i) => i.id === evento.intentoId);
  return { id: evento.id, fecha: evento.fecha, empresaRuc: serie.empresaRuc, usuario: evento.usuario,
    periodo: serie.periodo, archivo: intento.archivo, serieId: serie.id, intentoId: intento.id,
    tipo: 'Pre-validación', resultado: estadoIntento(intento) };
}
