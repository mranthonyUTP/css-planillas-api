// Misma interfaz y reglas que memoria.js. Intentos y eventos se agregan sin reescribirlos.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { conflicto, noEncontrado } from '../errores.js';
import { crearSerie, agregarIntento, transicionar, resumirSerie, resumirActividadPropia, cargaDeEvento } from './dominio.js';

const DETALLE = `s.snapshot || jsonb_build_object(
  'intentos', COALESCE((SELECT jsonb_agg(i.snapshot ORDER BY i.numero)
    FROM planilla_intentos i WHERE i.serie_id = s.id), '[]'::jsonb),
  'eventos', COALESCE((SELECT jsonb_agg(e.snapshot ORDER BY e.numero)
    FROM planilla_eventos e WHERE e.serie_id = s.id), '[]'::jsonb)
) AS detalle`;
const cabecera = ({ intentos, eventos, ...serie }) => serie;

export async function crearStorePostgres(url) {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const esquema = await readFile(new URL('./esquema.sql', import.meta.url), 'utf8');
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('SELECT pg_advisory_xact_lock(903215, 1)');
      await cliente.query(esquema);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally { cliente.release(); }
  } catch (error) {
    await pool.end();
    throw error;
  }

  async function transaccion(operacion) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await operacion(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      if (error.code === '23505') throw conflicto('El intento o la decisión ya existe.', 'registro_existente');
      throw error;
    } finally { cliente.release(); }
  }

  async function obtenerPlanilla(id, rucs, cliente = pool) {
    const { rows } = await cliente.query(
      `SELECT ${DETALLE} FROM planilla_series s WHERE s.id = $1 AND s.empresa_ruc = ANY($2::text[])`, [id, rucs],
    );
    return rows[0]?.detalle ?? null;
  }

  async function bloquearSerie(cliente, id, rucs) {
    const { rowCount } = await cliente.query(
      'SELECT id FROM planilla_series WHERE id = $1 AND empresa_ruc = ANY($2::text[]) FOR UPDATE', [id, rucs],
    );
    if (!rowCount) throw noEncontrado('No encontramos esa planilla.');
    // La relectura después del bloqueo incorpora los cambios ya confirmados por otra conexión.
    return obtenerPlanilla(id, rucs, cliente);
  }

  async function persistir(cliente, serie, original) {
    if (original) await cliente.query(
      'UPDATE planilla_series SET estado = $2, actualizada_en = $3, snapshot = $4 WHERE id = $1',
      [serie.id, serie.estado, serie.actualizadaEn, JSON.stringify(cabecera(serie))],
    );
    else await cliente.query(
      `INSERT INTO planilla_series (id, empresa_ruc, estado, creada_en, actualizada_en, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [serie.id, serie.empresaRuc, serie.estado, serie.creadaEn, serie.actualizadaEn, JSON.stringify(cabecera(serie))],
    );
    for (const intento of serie.intentos.slice(original?.intentos.length ?? 0)) await cliente.query(
      'INSERT INTO planilla_intentos (id, serie_id, numero, snapshot) VALUES ($1, $2, $3, $4)',
      [intento.id, serie.id, intento.numero, JSON.stringify(intento)],
    );
    const anteriores = original?.eventos.length ?? 0;
    for (const [indice, evento] of serie.eventos.slice(anteriores).entries()) await cliente.query(
      `INSERT INTO planilla_eventos (id, serie_id, intento_id, numero, fecha, clave, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [evento.id, serie.id, evento.intentoId, anteriores + indice + 1, evento.fecha, evento.clave ?? null, JSON.stringify(evento)],
    );
  }

  async function seriesPermitidas(rucs) {
    const { rows } = await pool.query(
      `SELECT ${DETALLE} FROM planilla_series s WHERE s.empresa_ruc = ANY($1::text[])
       ORDER BY s.actualizada_en DESC, s.id`, [rucs],
    );
    return rows.map((fila) => fila.detalle);
  }

  return {
    tipo: 'postgres',
    async guardarIntento({ serieId, intento }) {
      return transaccion(async (cliente) => {
        const original = serieId ? await bloquearSerie(cliente, serieId, [intento.empresaRuc]) : null;
        const serie = agregarIntento(original ?? crearSerie(intento), intento);
        await persistir(cliente, serie, original);
        return { ...structuredClone(serie.intentos.at(-1)), estado: serie.estado };
      });
    },
    async listarPlanillas(rucs, { actividadPropia } = {}) {
      const series = await seriesPermitidas(rucs);
      if (!actividadPropia) return series.map(resumirSerie);
      return series.map((serie) => resumirActividadPropia(serie, actividadPropia)).filter(Boolean)
        .sort((a, b) => b.ultimaDecisionPropia.fecha.localeCompare(a.ultimaDecisionPropia.fecha) || a.id.localeCompare(b.id));
    },
    obtenerPlanilla,
    async decidirPlanilla(entrada) {
      return transaccion(async (cliente) => {
        const original = await bloquearSerie(cliente, entrada.id, entrada.rucs);
        const serie = transicionar(original, entrada);
        if (serie.eventos.length !== original.eventos.length) await persistir(cliente, serie, original);
        return serie;
      });
    },
    async listarCargas(rucs) {
      return (await seriesPermitidas(rucs))
        .flatMap((serie) => serie.eventos.map((evento) => cargaDeEvento(serie, evento)))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 500)
        .map(({ empresaRuc, ...carga }) => carga);
    },
    async cerrar() { await pool.end(); },
  };
}
