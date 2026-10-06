// Cliente de la API. Sin VITE_API_URL usa la API simulada; con una URL, la API real.
// Contrato: ver "Contrato de API" en CLAUDE.md.

import { mockApi } from './mock.js';

const BASE = import.meta.env.VITE_API_URL ?? '';
export const modoSimulado = BASE === '';

async function pedir(ruta, { metodo = 'GET', token, cuerpo, cabeceras = {} } = {}) {
  const esForm = cuerpo instanceof FormData;
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo && !esForm ? { 'Content-Type': 'application/json' } : {}),
      ...cabeceras,
    },
    body: cuerpo ? (esForm ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const e = new Error(datos.mensaje ?? 'No pudimos completar la solicitud. Intenta de nuevo.');
    e.estado = respuesta.status;
    throw e;
  }
  return datos;
}

const apiReal = {
  ingresar: (credenciales) => pedir('/auth/login', { metodo: 'POST', cuerpo: credenciales }),

  validar({ archivo, periodo, tipo }, { token }) {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('periodo', periodo);
    form.append('tipo', tipo);
    return pedir('/planillas/validar', { metodo: 'POST', token, cuerpo: form });
  },

  enviar({ validacionId, idempotencyKey }, { token }) {
    return pedir('/planillas/enviar', {
      metodo: 'POST',
      token,
      cuerpo: { validacionId },
      cabeceras: { 'Idempotency-Key': idempotencyKey },
    });
  },

  cargas: ({ token }) => pedir('/cargas', { token }),
};

export const api = modoSimulado ? mockApi : apiReal;
