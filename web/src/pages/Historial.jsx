import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { fechaHora, nombrePeriodo } from '../formato.js';

const ESTILO_RESULTADO = { Enviada: 'etiqueta-exito', 'Sin errores': 'etiqueta-info', 'Con errores': 'etiqueta-error' };

// Pantalla 6 · HU-11
export default function Historial() {
  const { sesion } = useSesion();
  const [cargas, setCargas] = useState(null);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ periodo: 'Todos', tipo: 'Todas', resultado: 'Todos' });

  useEffect(() => {
    api.cargas(sesion).then(setCargas).catch((e) => setError(e.message));
  }, [sesion]);

  const periodos = useMemo(() => [...new Set((cargas ?? []).map((c) => c.periodo))], [cargas]);

  const visibles = (cargas ?? []).filter(
    (c) =>
      (filtros.periodo === 'Todos' || c.periodo === filtros.periodo) &&
      (filtros.tipo === 'Todas' || c.tipo === filtros.tipo) &&
      (filtros.resultado === 'Todos' || c.resultado === filtros.resultado),
  );

  const cambiar = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  return (
    <Marco>
      <div className="cabecera-pagina">
        <div>
          <h1 className="titulo">Historial de cargas</h1>
          <p className="subtitulo">Cada carga queda registrada con quién la hizo, cuándo y su resultado.</p>
        </div>
        <Link to="/cargar" className="boton boton-primario">Cargar nueva planilla</Link>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <section className="tarjeta sin-relleno">
        <div className="filtros" role="search">
          <div className="campo">
            <label htmlFor="f-periodo">Período</label>
            <select id="f-periodo" name="periodo" value={filtros.periodo} onChange={cambiar}>
              <option>Todos</option>
              {periodos.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-tipo">Tipo de carga</label>
            <select id="f-tipo" name="tipo" value={filtros.tipo} onChange={cambiar}>
              <option>Todas</option>
              <option>Pre-validación</option>
              <option>Envío oficial</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-resultado">Resultado</label>
            <select id="f-resultado" name="resultado" value={filtros.resultado} onChange={cambiar}>
              <option>Todos</option>
              <option>Enviada</option>
              <option>Sin errores</option>
              <option>Con errores</option>
            </select>
          </div>
        </div>

        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Período</th>
                <th scope="col">Archivo</th>
                <th scope="col">Usuario</th>
                <th scope="col">Tipo</th>
                <th scope="col">Resultado</th>
                <th scope="col">Confirmación</th>
              </tr>
            </thead>
            <tbody>
              {cargas === null && !error && (
                <tr><td colSpan={7} className="celda-vacia">Cargando historial…</td></tr>
              )}
              {cargas !== null && visibles.length === 0 && (
                <tr><td colSpan={7} className="celda-vacia">No hay cargas con esos filtros.</td></tr>
              )}
              {visibles.map((c) => (
                <tr key={c.id}>
                  <td>{fechaHora(c.fecha)}</td>
                  <td className="sin-salto">{nombrePeriodo(c.periodo)}</td>
                  <td className="romper">{c.archivo}</td>
                  <td>{c.usuario}</td>
                  <td>{c.tipo}</td>
                  <td><span className={`etiqueta ${ESTILO_RESULTADO[c.resultado]}`}>{c.resultado}</span></td>
                  <td className="mono sin-salto">{c.confirmacion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cargas !== null && (
          <div className="tabla-pie">Mostrando {visibles.length} de {cargas.length} registros</div>
        )}
      </section>
    </Marco>
  );
}
