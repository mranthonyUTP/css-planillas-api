import { mockApi } from './mock.js';
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const modoSimulado = BASE === '';
const CLAVE_CAMBIOS = `portal-planillas-actualizadas:${BASE || 'demo'}`;

function publicarCambio() {
  window.dispatchEvent(new Event('planillas-actualizadas'));
  try { localStorage.setItem(CLAVE_CAMBIOS, crypto.randomUUID()); } catch { /* El resultado guardado se mantiene aunque no pueda avisarse a otra pestaña. */ }
}

export function escucharCambiosPlanillas(actualizar, { locales = true } = {}) {
  const alVolver = () => { if (document.visibilityState === 'visible') actualizar(); };
  const alGuardar = (evento) => { if (evento.key === CLAVE_CAMBIOS) actualizar(); };
  window.addEventListener('focus', alVolver);
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('storage', alGuardar);
  if (locales) window.addEventListener('planillas-actualizadas', actualizar);
  return () => {
    window.removeEventListener('focus', alVolver);
    document.removeEventListener('visibilitychange', alVolver);
    window.removeEventListener('storage', alGuardar);
    if (locales) window.removeEventListener('planillas-actualizadas', actualizar);
  };
}
async function pedir(ruta, { metodo = 'GET', token, cuerpo, cabeceras = {} } = {}) {
  const esForm = cuerpo instanceof FormData;
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, { method: metodo, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo && !esForm ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
      body: cuerpo ? (esForm ? cuerpo : JSON.stringify(cuerpo)) : undefined });
  } catch {
    throw Object.assign(new Error('No pudimos confirmar la operación con el servidor. Comprueba la conexión y actualiza la vista o vuelve a intentar.'), { estado: 0, codigo: 'sin_conexion' });
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = Object.assign(new Error(datos.mensaje ?? 'No pudimos completar la solicitud.'), { estado: respuesta.status, codigo: datos.codigo });
    if (respuesta.status === 401 && token) window.dispatchEvent(new Event('sesion-expirada'));
    throw error;
  }
  return datos;
}
const acciones = { solicitar: ['solicitar-revision', undefined], aprobar: ['revisar', 'aprobar'],
  'devolver-revision': ['revisar', 'devolver'], autorizar: ['autorizar', 'autorizar'], 'devolver-autorizacion': ['autorizar', 'devolver'] };
const apiReal = {
  ingresar: (credenciales) => pedir('/auth/login', { metodo: 'POST', cuerpo: credenciales }),
  validar({ archivo, periodo, tipo, serieId }, { token }) {
    const form = new FormData();
    form.append('archivo', archivo); form.append('periodo', periodo); form.append('tipo', tipo);
    if (serieId) form.append('serieId', serieId);
    return pedir('/planillas/validar', { metodo: 'POST', token, cuerpo: form });
  },
  series: ({ token }, { actividad } = {}) => pedir(`/planillas${actividad ? `?${new URLSearchParams({ actividad })}` : ''}`, { token }),
  detalleSerie: (id, { token }) => pedir(`/planillas/${encodeURIComponent(id)}`, { token }),
  comparar: (id, antes, despues, { token }) => pedir(`/planillas/${encodeURIComponent(id)}/comparar?${new URLSearchParams({ anterior: antes, actual: despues })}`, { token }),
  transicionar({ serieId, intentoId, accion, motivo = '', idempotencyKey = crypto.randomUUID() }, { token }) {
    const datos = Object.hasOwn(acciones, accion) ? acciones[accion] : null;
    if (!datos) return Promise.reject(new Error('La acción seleccionada no existe.'));
    return pedir(`/planillas/${encodeURIComponent(serieId)}/${datos[0]}`, { metodo: 'POST', token,
      cuerpo: { intentoId, decision: datos[1], motivo }, cabeceras: { 'Idempotency-Key': idempotencyKey } });
  },
  cargas: ({ token }) => pedir('/cargas', { token }),
  enviar: () => Promise.reject(new Error('Usa la revisión y autorización interna. La presentación oficial se realiza fuera del portal.')),
};
const cliente = modoSimulado ? mockApi : apiReal;
export const api = {
  ...cliente,
  async validar(...argumentos) {
    const resultado = await cliente.validar(...argumentos);
    publicarCambio();
    return resultado;
  },
  async transicionar(...argumentos) {
    const resultado = await cliente.transicionar(...argumentos);
    publicarCambio();
    return resultado;
  },
};
