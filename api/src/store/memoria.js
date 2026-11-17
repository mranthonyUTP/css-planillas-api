import { crearSerie, agregarIntento, transicionar, resumirSerie, resumirActividadPropia, cargaDeEvento } from './dominio.js';
import { noEncontrado } from '../errores.js';

export function crearStoreMemoria() {
  const series = new Map();
  const permitida = (s, rucs) => s && rucs.includes(s.empresaRuc);
  const obtener = (id, rucs) => { const s = series.get(id); if (!permitida(s, rucs)) throw noEncontrado('No encontramos esa planilla.'); return s; };
  return {
    tipo: 'memoria',
    async guardarIntento({ serieId, intento }) {
      const original = serieId ? obtener(serieId, [intento.empresaRuc]) : crearSerie(intento);
      const s = agregarIntento(original, intento); series.set(s.id, s);
      return { ...structuredClone(s.intentos.at(-1)), estado: s.estado };
    },
    async listarPlanillas(rucs, { actividadPropia } = {}) {
      return [...series.values()].filter((s) => permitida(s, rucs))
        .map((s) => actividadPropia ? resumirActividadPropia(s, actividadPropia) : resumirSerie(s))
        .filter(Boolean)
        .sort((a, b) => actividadPropia
          ? b.ultimaDecisionPropia.fecha.localeCompare(a.ultimaDecisionPropia.fecha) || a.id.localeCompare(b.id)
          : b.actualizadaEn.localeCompare(a.actualizadaEn));
    },
    async obtenerPlanilla(id, rucs) { const s = series.get(id); return permitida(s, rucs) ? structuredClone(s) : null; },
    async decidirPlanilla(entrada) {
      const s = transicionar(obtener(entrada.id, entrada.rucs), entrada); series.set(s.id, s); return structuredClone(s);
    },
    async listarCargas(rucs) {
      return [...series.values()].filter((s) => permitida(s, rucs)).flatMap((s) => s.eventos.map((e) => cargaDeEvento(s, e)))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 500).map(({ empresaRuc, ...c }) => c);
    },
    async cerrar() {},
  };
}
