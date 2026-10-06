// Almacenamiento en PostgreSQL. Misma interfaz que store/memoria.js.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { conflicto } from '../errores.js';

const aValidacion = (f) => ({
  id: f.id,
  empresaRuc: f.empresa_ruc,
  usuario: f.usuario,
  archivo: f.archivo,
  periodo: f.periodo,
  tipo: f.tipo,
  filas: f.filas,
  filasConError: f.filas_con_error,
  totalSalarios: Number(f.total_salarios),
  errores: f.errores,
  valida: f.valida,
  validadaEn: f.validada_en.toISOString(),
});

const aEnvio = (f) => ({
  id: f.id,
  confirmacion: f.confirmacion,
  enviadoEn: f.enviado_en.toISOString(),
  enviadoPor: f.enviado_por,
  validacionId: f.validacion_id,
  clave: f.idempotency_key,
});

export async function crearStorePostgres(url) {
  const pool = new pg.Pool({ connectionString: url });
  const esquema = await readFile(new URL('./esquema.sql', import.meta.url), 'utf8');
  await pool.query(esquema);

  const buscarEnvio = async (ruc, clave) => {
    const { rows } = await pool.query('SELECT * FROM envios WHERE empresa_ruc = $1 AND idempotency_key = $2', [ruc, clave]);
    return rows[0] ? aEnvio(rows[0]) : null;
  };

  return {
    tipo: 'postgres',

    async guardarValidacion(v) {
      await pool.query(
        `INSERT INTO validaciones (id, empresa_ruc, usuario, archivo, periodo, tipo, filas, filas_con_error, total_salarios, errores, valida, validada_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [v.id, v.empresaRuc, v.usuario, v.archivo, v.periodo, v.tipo, v.filas, v.filasConError, v.totalSalarios, JSON.stringify(v.errores), v.valida, v.validadaEn],
      );
      return v;
    },

    async obtenerValidacion(id, ruc) {
      const { rows } = await pool.query('SELECT * FROM validaciones WHERE id = $1 AND empresa_ruc = $2', [id, ruc]);
      return rows[0] ? aValidacion(rows[0]) : null;
    },

    buscarEnvio,

    async crearEnvio({ ruc, clave, validacion, usuario, periodo }) {
      const [anio, mes] = periodo.split('-');
      try {
        const { rows } = await pool.query(
          `INSERT INTO envios (id, empresa_ruc, idempotency_key, validacion_id, confirmacion, enviado_por)
           VALUES ($1, $2, $3, $4, 'PL-' || $5 || '-' || $6 || '-' || lpad(nextval('confirmaciones_seq')::text, 6, '0'), $7)
           RETURNING *`,
          [randomUUID(), ruc, clave, validacion.id, anio, mes, usuario],
        );
        return { envio: aEnvio(rows[0]), repetido: false };
      } catch (e) {
        if (e.code !== '23505') throw e;
        // Violación de unicidad: o la clave ya se usó (reintento) o la validación ya se envió.
        const previo = await buscarEnvio(ruc, clave);
        if (previo) return { envio: previo, repetido: true };
        throw conflicto('Esta planilla ya fue enviada. Consulta su comprobante en el historial.', 'ya_enviada');
      }
    },

    async registrarCarga(c) {
      await pool.query(
        `INSERT INTO cargas (id, empresa_ruc, usuario, periodo, archivo, tipo, resultado, confirmacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), c.empresaRuc, c.usuario, c.periodo, c.archivo, c.tipo, c.resultado, c.confirmacion ?? null],
      );
    },

    async listarCargas(ruc) {
      const { rows } = await pool.query(
        'SELECT id, fecha, periodo, archivo, usuario, tipo, resultado, confirmacion FROM cargas WHERE empresa_ruc = $1 ORDER BY fecha DESC LIMIT 500',
        [ruc],
      );
      return rows.map((f) => ({ ...f, fecha: f.fecha.toISOString() }));
    },

    async cerrar() {
      await pool.end();
    },
  };
}
