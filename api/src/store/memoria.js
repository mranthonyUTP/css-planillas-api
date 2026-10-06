// Almacenamiento en memoria: para desarrollo, pruebas y la demo sin base de datos.
// Misma interfaz que store/postgres.js.
import { randomUUID } from 'node:crypto';
import { conflicto } from '../errores.js';

export function crearStoreMemoria() {
  const validaciones = new Map(); // id -> validación
  const envios = new Map(); // `${ruc}:${clave}` -> envío
  const enviosPorValidacion = new Map(); // validacionId -> envío
  const cargas = [];
  let secuencia = 0;

  return {
    tipo: 'memoria',

    async guardarValidacion(v) {
      validaciones.set(v.id, structuredClone(v));
      return v;
    },

    async obtenerValidacion(id, ruc) {
      const v = validaciones.get(id);
      return v && v.empresaRuc === ruc ? structuredClone(v) : null;
    },

    async buscarEnvio(ruc, clave) {
      return envios.get(`${ruc}:${clave}`) ?? null;
    },

    // Crea el envío de forma atómica (Node es de un solo hilo: no hay carrera entre await).
    async crearEnvio({ ruc, clave, validacion, usuario, periodo }) {
      const previo = envios.get(`${ruc}:${clave}`);
      if (previo) return { envio: previo, repetido: true };
      if (enviosPorValidacion.has(validacion.id)) {
        throw conflicto('Esta planilla ya fue enviada. Consulta su comprobante en el historial.', 'ya_enviada');
      }
      secuencia += 1;
      const [anio, mes] = periodo.split('-');
      const envio = {
        id: randomUUID(),
        confirmacion: `PL-${anio}-${mes}-${String(secuencia).padStart(6, '0')}`,
        enviadoEn: new Date().toISOString(),
        enviadoPor: usuario,
        validacionId: validacion.id,
        clave,
      };
      envios.set(`${ruc}:${clave}`, envio);
      enviosPorValidacion.set(validacion.id, envio);
      return { envio, repetido: false };
    },

    async registrarCarga(c) {
      cargas.unshift({ id: randomUUID(), fecha: new Date().toISOString(), ...c });
    },

    async listarCargas(ruc) {
      return cargas.filter((c) => c.empresaRuc === ruc).map(({ empresaRuc, ...resto }) => resto);
    },

    async cerrar() {},
  };
}
