// Demostración local. Los permisos productivos y el aislamiento real se aplican en la API.
import { leerArchivo } from '../validacion/archivo.js';
import { validarPlanilla } from '../validacion/reglas.js';
import { compararIntentos } from '../../../shared/planillas.js';
const CLAVE = 'portal-planillas-demo-v3';
const EMPRESAS = [{ ruc: '155123456-2-2020', nombre: 'Empresa de demostración, S.A.' },
  { ruc: '155987654-1-2021', nombre: 'Segunda empresa de demostración, S.A.' }];
const CUENTAS = { 'ana.contabilidad': ['ELABORADOR', 0], elaborador: ['ELABORADOR', 0], 'empresa.dos': ['ELABORADOR', 1],
  operador: ['OPERADOR', null], representante: ['AUTORIZADOR', null], autorizador: ['AUTORIZADOR', null] };
let memoria = { version: 3, series: {}, sesiones: {} };
const copiar = (v) => structuredClone(v);
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
function estadoActual() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE)); if (s?.version === 3 && s.series && s.sesiones) return s; }
  catch { /* La memoria conserva el estado mientras la pestaña permanezca abierta. */ }
  return copiar(memoria);
}
function guardar(estado) {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
  catch { throw error(507, 'No se pudo guardar la demostración. Libera espacio o permite el almacenamiento local del navegador.'); }
  memoria = copiar(estado);
}
function identidad(estado, sesion) {
  const u = estado.sesiones[sesion?.token];
  if (!u || u.expira < Date.now()) throw error(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  return u;
}
const puedeLeer = (s, u) => u.empresas.some((e) => e.ruc === s.empresaRuc);
function buscar(estado, id, u) {
  const s = estado.series[id];
  if (!s || !puedeLeer(s, u)) throw error(404, 'No encontramos esa planilla.');
  return s;
}
function resumen(s) {
  const { intentos, eventos, comprobante, ...resto } = s;
  const ultimo = intentos.find((i) => i.id === s.ultimoIntentoId);
  return { ...resto, numeroIntentos: intentos.length, ultimoIntentoResumen: ultimo ? Object.fromEntries(
    ['id', 'numero', 'archivo', 'usuario', 'validadaEn', 'filas', 'filasConError', 'totalSalarios', 'valida', 'estructuraValida', 'salariosValidos', 'totalSalariosParcial'].map((k) => [k, ultimo[k]])) : null };
}
const publico = (s) => copiar({ ...resumen(s), intentos: s.intentos, comprobante: s.comprobante,
  eventos: s.eventos.map(({ clave, huella, ...e }) => e) });
export const mockApi = {
  async ingresar({ ruc, usuario, clave }) {
    const nombre = String(usuario ?? '').trim();
    const cuenta = Object.hasOwn(CUENTAS, nombre) ? CUENTAS[nombre] : null;
    if (!cuenta || clave !== 'demo1234') throw error(401, 'Usa una cuenta de demostración y la contraseña demo1234.');
    const empresas = cuenta[1] === null ? EMPRESAS : [EMPRESAS[cuenta[1]]];
    const empresa = empresas.find((e) => e.ruc === String(ruc ?? '').trim());
    if (!empresa) throw error(403, 'Esta cuenta no está asignada a esa empresa.');
    const estado = estadoActual();
    const sesion = { token: `demo.${crypto.randomUUID()}`, usuario: nombre, rol: cuenta[0], roles: [cuenta[0]], empresa, empresas };
    estado.sesiones[sesion.token] = { ...sesion, expira: Date.now() + 3600000 };
    for (const [token, s] of Object.entries(estado.sesiones)) if (s.expira < Date.now()) delete estado.sesiones[token];
    guardar(estado); return copiar(sesion);
  },
  async validar({ archivo, periodo, tipo, serieId }, sesion) {
    let estado = estadoActual(); let u = identidad(estado, sesion);
    if (u.rol !== 'ELABORADOR') throw error(403, 'Solo el elaborador puede cargar un archivo.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo ?? '') || !['Regular', 'Complementaria', 'Corrección'].includes(tipo)) throw error(400, 'Selecciona un período y un tipo válidos.');
    if (!archivo) throw error(400, 'Selecciona el archivo de la planilla.');
    const resultado = validarPlanilla(await leerArchivo(archivo));
    estado = estadoActual(); u = identidad(estado, sesion);
    const fecha = new Date().toISOString();
    let s;
    if (serieId) {
      s = buscar(estado, serieId, u);
      if (s.empresaRuc !== u.empresa.ruc || s.periodo !== periodo || s.tipo !== tipo) throw error(409, 'La corrección debe conservar empresa, período y tipo.');
    } else s = { id: crypto.randomUUID(), empresaRuc: u.empresa.ruc, empresaNombre: u.empresa.nombre, periodo, tipo,
      estado: 'BORRADOR', ultimoIntentoId: null, creadaEn: fecha, actualizadaEn: fecha, intentos: [], eventos: [], comprobante: null };
    const intento = { ...resultado, id: crypto.randomUUID(), serieId: s.id, numero: s.intentos.length + 1,
      empresaRuc: s.empresaRuc, empresaNombre: s.empresaNombre, archivo: archivo.name, periodo, tipo,
      usuario: u.usuario, validadaEn: fecha, valida: resultado.errores.length === 0 };
    s.intentos.push(copiar(intento)); s.ultimoIntentoId = intento.id; s.actualizadaEn = fecha; s.estado = 'BORRADOR'; s.comprobante = null;
    s.eventos.push({ id: crypto.randomUUID(), accion: 'carga', decision: null, motivo: '', usuario: u.usuario, rol: u.rol, intentoId: intento.id, fecha });
    estado.series[s.id] = s; guardar(estado); return copiar({ ...intento, estado: s.estado });
  },
  async series(sesion, { actividad } = {}) {
    const estado = estadoActual(); const u = identidad(estado, sesion);
    if (actividad !== undefined && actividad !== 'propia') throw error(400, 'El filtro de actividad no es válido.');
    if (actividad === 'propia' && !['OPERADOR', 'AUTORIZADOR'].includes(u.rol)) throw error(403, 'La actividad propia corresponde al operador o al autorizador.');
    const accionesPropias = u.rol === 'OPERADOR' ? ['aprobar', 'devolver-revision'] : ['autorizar', 'devolver-autorizacion'];
    const series = Object.values(estado.series).filter((s) => puedeLeer(s, u));
    if (actividad !== 'propia') return copiar(series.map(resumen).sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn)));
    return copiar(series.flatMap((s) => {
      const ultima = [...s.eventos].reverse().find((e) => e.usuario === u.usuario && e.rol === u.rol && accionesPropias.includes(e.accion));
      if (!ultima) return [];
      const intento = s.intentos.find((i) => i.id === ultima.intentoId);
      const { id, accion, decision, motivo, usuario, rol, intentoId, fecha } = ultima;
      return [{ ...resumen(s), ultimaDecisionPropia: { id, accion, decision, motivo, usuario, rol, intentoId, fecha,
        numeroIntento: intento?.numero, archivo: intento?.archivo, esIntentoActual: intentoId === s.ultimoIntentoId } }];
    }).sort((a, b) => b.ultimaDecisionPropia.fecha.localeCompare(a.ultimaDecisionPropia.fecha)));
  },
  async detalleSerie(id, sesion) { const estado = estadoActual(); return publico(buscar(estado, id, identidad(estado, sesion))); },
  async comparar(id, anterior, actual, sesion) {
    const estado = estadoActual(); const s = buscar(estado, id, identidad(estado, sesion));
    const antes = s.intentos.find((i) => i.id === anterior); const despues = s.intentos.find((i) => i.id === actual);
    if (!antes || !despues) throw error(404, 'No encontramos esos intentos en esta planilla.');
    if (antes.numero >= despues.numero) throw error(400, 'Selecciona un intento anterior y uno posterior.');
    return compararIntentos(antes, despues);
  },
  async transicionar({ serieId, intentoId, accion, motivo = '', idempotencyKey = crypto.randomUUID() }, sesion) {
    const estado = estadoActual(); const u = identidad(estado, sesion); const s = buscar(estado, serieId, u);
    const permisos = { solicitar: 'ELABORADOR', aprobar: 'OPERADOR', 'devolver-revision': 'OPERADOR', autorizar: 'AUTORIZADOR', 'devolver-autorizacion': 'AUTORIZADOR' };
    if (!Object.hasOwn(permisos, accion) || u.rol !== permisos[accion]) throw error(403, 'Tu rol no permite realizar esta acción.');
    if (typeof motivo !== 'string' || motivo.length > 1000) throw error(400, 'El motivo debe tener como máximo 1000 caracteres.');
    const devolver = accion.startsWith('devolver-');
    if (devolver && !motivo.trim()) throw error(400, 'Indica el motivo de la devolución.');
    const huella = JSON.stringify([intentoId, accion, motivo.trim(), u.usuario, u.rol]);
    const previo = s.eventos.find((e) => e.clave === idempotencyKey);
    if (s.ultimoIntentoId !== intentoId) throw error(409, 'Hay un intento más reciente. Actualiza la planilla.');
    if (previo) { if (previo.huella !== huella) throw error(409, 'La clave ya se usó para otra decisión.'); return publico(s); }
    if (!s.intentos.find((i) => i.id === intentoId)?.valida) throw error(409, 'El intento tiene observaciones pendientes.');
    const esperado = accion === 'solicitar' ? ['BORRADOR', 'DEVUELTA'] : accion === 'aprobar' || accion === 'devolver-revision' ? ['PENDIENTE_REVISION'] : ['PENDIENTE_AUTORIZACION'];
    if (!esperado.includes(s.estado)) throw error(409, 'La planilla cambió de estado. Actualiza la vista.');
    s.estado = devolver ? 'DEVUELTA' : ({ solicitar: 'PENDIENTE_REVISION', aprobar: 'PENDIENTE_AUTORIZACION', autorizar: 'AUTORIZADA' })[accion];
    s.actualizadaEn = new Date().toISOString();
    s.comprobante = s.estado === 'AUTORIZADA' ? { confirmacion: `INT-${crypto.randomUUID()}`, autorizadoEn: s.actualizadaEn, autorizadoPor: u.usuario, intentoId } : null;
    s.eventos.push({ id: crypto.randomUUID(), accion, decision: devolver ? 'devolver' : accion === 'solicitar' ? null : accion,
      motivo: motivo.trim(), usuario: u.usuario, rol: u.rol, intentoId, fecha: s.actualizadaEn, clave: idempotencyKey, huella,
      ...(s.comprobante ? { comprobante: copiar(s.comprobante) } : {}) });
    guardar(estado); return publico(s);
  },
  async cargas(sesion) {
    const estado = estadoActual(); const u = identidad(estado, sesion);
    return copiar(Object.values(estado.series).filter((s) => puedeLeer(s, u)).flatMap((s) => s.eventos.map((e) => ({
      id: e.id, fecha: e.fecha, periodo: s.periodo, archivo: s.intentos.find((i) => i.id === e.intentoId)?.archivo,
      usuario: e.usuario, tipo: e.accion === 'carga' ? 'Pre-validación' : 'Flujo interno', resultado: e.accion, serieId: s.id,
    }))).sort((a, b) => b.fecha.localeCompare(a.fecha)));
  },
  async enviar() { throw error(410, 'Usa la revisión y autorización interna. La presentación oficial se realiza fuera de la demostración.'); },
};
