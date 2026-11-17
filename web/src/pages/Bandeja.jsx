import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, fechaHora, nombrePeriodo } from '../formato.js';

export default function Bandeja() {
  const { sesion, empresaActiva } = useSesion();
  const [series, setSeries] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [revision, setRevision] = useState(0);
  const operador = sesion.rol === 'OPERADOR';
  const estadoPendiente = operador ? 'PENDIENTE_REVISION' : 'PENDIENTE_AUTORIZACION';

  useEffect(() => {
    let vigente = true;
    setError('');
    api.series(sesion).then((s) => { if (vigente) setSeries(s); })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [sesion, revision]);
  useEffect(() => escucharCambiosPlanillas(() => setRevision((v) => v + 1)), []);

  if (sesion.rol === 'ELABORADOR') return <Navigate to="/cargar" replace />;
  const pendientes = (series ?? []).filter((s) => s.empresaRuc === empresaActiva?.ruc && s.estado === estadoPendiente);
  const visibles = pendientes.filter((s) => `${s.periodo} ${nombrePeriodo(s.periodo)} ${s.ultimoIntentoResumen?.archivo ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()));

  return <Marco>
    <div className="cabecera-pagina"><div><h1 className="titulo">{operador ? 'Pendientes de revisión' : 'Pendientes de autorización'}</h1><p className="subtitulo">{operador ? 'Planillas que esperan tu revisión antes de pasar al representante.' : 'Planillas revisadas por el operador que esperan tu autorización interna.'}</p></div><button type="button" className="boton boton-secundario" onClick={() => setRevision((v) => v + 1)}>Actualizar bandeja</button></div>
    <p className="resumen-bandeja">{pendientes.length} pendientes · {empresaActiva?.nombre} · RUC {empresaActiva?.ruc}</p>
    {error && <Aviso tipo="error">{error}</Aviso>}
    <section className="tarjeta sin-relleno">
      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}><div className="campo"><label htmlFor="buscar-bandeja">Buscar planilla pendiente</label><input id="buscar-bandeja" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Período o nombre del archivo" /></div></form>
      <div className="tabla-contenedor" role="region" aria-label="Planillas pendientes de la empresa activa" tabIndex={0}>
        <table className="tabla"><thead><tr><th>Período</th><th>Archivo</th><th>Trabajadores</th><th>Sueldos declarados</th><th>Recibida</th><th>Acción</th></tr></thead><tbody>
          {visibles.map((s) => { const v = s.ultimoIntentoResumen; return <tr key={s.id}><th scope="row">{nombrePeriodo(s.periodo)}<p className="texto-pequeno">{s.tipo}</p></th><td className="romper">{v?.archivo}<p className="texto-pequeno">Intento {v?.numero ?? '—'}</p></td><td>{v?.filas ?? '—'}</td><td className="mono sin-salto">{v?.estructuraValida === false ? '—' : balboas(v?.totalSalarios)}{v?.totalSalariosParcial && <p className="texto-pequeno">Suma parcial</p>}</td><td>{fechaHora(s.actualizadaEn)}</td><td><Link className="boton boton-secundario" to={`/revision/${s.id}`}>{operador ? 'Revisar planilla' : 'Consultar y autorizar'}</Link></td></tr>; })}
          {visibles.length === 0 && <tr><td colSpan={6} className="celda-vacia">{series === null && !error ? 'Cargando bandeja…' : error && series === null ? 'No se pudo cargar la bandeja.' : busqueda ? 'No hay pendientes que coincidan con la búsqueda.' : 'No tienes planillas pendientes para esta empresa.'}</td></tr>}
        </tbody></table>
      </div>
      <div className="tabla-pie">Mostrando {visibles.length} de {pendientes.length} pendientes. Las decisiones registradas se consultan en <Link className="enlace-accion" to="/historial">{operador ? 'Mis revisiones' : 'Mis autorizaciones'}</Link>.</div>
    </section>
  </Marco>;
}
