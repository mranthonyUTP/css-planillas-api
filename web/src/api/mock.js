// API simulada para trabajar el frontend antes de tener el backend.
// Respeta el contrato descrito en CLAUDE.md, así que se reemplaza sin tocar las pantallas.
// Guarda su estado en sessionStorage: se borra al cerrar la pestaña.

import { leerCsv } from '../validacion/csv.js';
import { validarPlanilla } from '../validacion/reglas.js';

const CLAVE = 'portal-planillas-mock';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function cargarEstado() {
  try {
    const guardado = sessionStorage.getItem(CLAVE);
    if (guardado) return JSON.parse(guardado);
  } catch {
    // Sin sessionStorage (modo privado): se usa el estado en memoria.
  }
  return { validaciones: {}, envios: {}, cargas: historialInicial(), secuencia: 122 };
}

let estado = cargarEstado();

function guardar() {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Ignorado: el estado sigue en memoria.
  }
}

function historialInicial() {
  return [
    { id: 'h3', fecha: '2026-09-05T16:20:00', periodo: '2026-09', archivo: 'planilla_septiembre_2026.xlsx', usuario: 'contabilidad', tipo: 'Envío oficial', resultado: 'Enviada', confirmacion: 'PL-2026-09-000087' },
    { id: 'h2', fecha: '2026-09-05T16:11:00', periodo: '2026-09', archivo: 'planilla_septiembre_2026.xlsx', usuario: 'contabilidad', tipo: 'Pre-validación', resultado: 'Sin errores', confirmacion: null },
    { id: 'h1', fecha: '2026-08-04T11:03:00', periodo: '2026-08', archivo: 'planilla_agosto_2026.csv', usuario: 'contabilidad', tipo: 'Envío oficial', resultado: 'Enviada', confirmacion: 'PL-2026-08-000052' },
  ];
}

function exigirToken(token) {
  if (!token) {
    const e = new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    e.estado = 401;
    throw e;
  }
}

function registrarCarga(carga) {
  estado.cargas.unshift({ id: crypto.randomUUID(), fecha: new Date().toISOString(), ...carga });
  guardar();
}

export const mockApi = {
  // HU-07. En producción, flujo OAuth2 con Keycloak.
  async ingresar({ ruc, usuario, clave }) {
    await espera(400);
    if (!ruc || !usuario || !clave) {
      const e = new Error('Completa el RUC, el usuario y la contraseña.');
      e.estado = 400;
      throw e;
    }
    return { token: `mock.${crypto.randomUUID()}`, usuario, empresa: { ruc, nombre: 'Empresa de demostración, S.A.' } };
  },

  // HU-05 y HU-06. Pre-validación: no registra la planilla.
  async validar({ archivo, periodo, tipo }, { token, usuario }) {
    exigirToken(token);
    await espera(700);

    const nombre = archivo.name.toLowerCase();
    if (!nombre.endsWith('.csv') && !nombre.endsWith('.xlsx')) {
      const e = new Error('Formato no admitido. Usa un archivo .xlsx o .csv.');
      e.estado = 415;
      throw e;
    }
    if (nombre.endsWith('.xlsx')) {
      const e = new Error('En el modo de demostración solo se leen archivos .csv. La API real también leerá .xlsx.');
      e.estado = 415;
      throw e;
    }

    const resultado = validarPlanilla(leerCsv(await archivo.text()));
    const validacion = {
      id: crypto.randomUUID(),
      archivo: archivo.name,
      periodo,
      tipo,
      filas: resultado.filas,
      filasConError: resultado.filasConError,
      totalSalarios: resultado.totalSalarios,
      errores: resultado.errores,
      valida: resultado.errores.length === 0,
      validadaEn: new Date().toISOString(),
    };
    estado.validaciones[validacion.id] = validacion;
    registrarCarga({ periodo, archivo: archivo.name, usuario, tipo: 'Pre-validación', resultado: validacion.valida ? 'Sin errores' : 'Con errores', confirmacion: null });
    return validacion;
  },

  // HU-08 y HU-12. Envío oficial con clave de idempotencia.
  async enviar({ validacionId, idempotencyKey }, { token, usuario }) {
    exigirToken(token);
    await espera(900);

    const previo = estado.envios[idempotencyKey];
    if (previo) return { ...previo, repetido: true };

    const validacion = estado.validaciones[validacionId];
    if (!validacion || !validacion.valida) {
      const e = new Error('Solo se pueden enviar planillas que pasaron la pre-validación.');
      e.estado = 409;
      throw e;
    }

    estado.secuencia += 1;
    const [anio, mes] = validacion.periodo.split('-');
    const envio = {
      confirmacion: `PL-${anio}-${mes}-${String(estado.secuencia).padStart(6, '0')}`,
      enviadoEn: new Date().toISOString(),
      enviadoPor: usuario,
      validacion,
    };
    estado.envios[idempotencyKey] = envio;
    registrarCarga({ periodo: validacion.periodo, archivo: validacion.archivo, usuario, tipo: 'Envío oficial', resultado: 'Enviada', confirmacion: envio.confirmacion });
    return envio;
  },

  // HU-11. Historial y auditoría.
  async cargas({ token }) {
    exigirToken(token);
    await espera(300);
    return estado.cargas;
  },
};
