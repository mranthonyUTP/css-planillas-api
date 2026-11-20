import { crearSerie, agregarIntento, resumirSerie, cargaDeEvento } from './dominio.js';
import { noEncontrado } from '../errores.js';
import { aplicarRevisionOperador } from '../../../shared/revision-operador.js';

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
    async listarPlanillas(rucs) { return [...series.values()].filter(s => permitida(s, rucs)).map(resumirSerie).sort((a,b) => b.actualizadaEn.localeCompare(a.actualizadaEn)); },
    async revisarOperador(entrada) { const serie = aplicarRevisionOperador(obtener(entrada.idSerie, entrada.rucs), entrada); series.set(serie.id, serie); return structuredClone(serie); },
    async obtenerPlanilla(id, rucs) { const s = series.get(id); return permitida(s, rucs) ? structuredClone(s) : null; },
    async listarCargas(rucs) {
      return [...series.values()].filter((s) => permitida(s, rucs)).flatMap((s) => s.eventos.filter(e => e.accion === 'carga').map((e) => cargaDeEvento(s, e)))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 500).map(({ empresaRuc, ...c }) => c);
    },
    async cerrar() {},
  };
}
