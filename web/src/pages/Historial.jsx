import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, fechaHora, nombreAccion, nombrePeriodo, nombreEstado, claseEstado } from '../formato.js';

const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Intentos({ serie, sesion }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setDetalle(null); setError('');
    api.detalleSerie(serie.id, sesion).then((datos) => { if (vigente) setDetalle(datos); })
      .catch((err) => { if (vigente) setError(err.message); });
    return () => { vigente = false; };
  }, [abierto, serie.id, serie.actualizadaEn, sesion]);
  const ordenados = [...(detalle?.intentos ?? [])].sort((a, b) => b.numero - a.numero);
  return <details className="historial-intentos" onToggle={(e) => setAbierto(e.currentTarget.open)}>
    <summary className="enlace-accion">Ver intentos ({serie.numeroIntentos}) y decisiones</summary>
    {abierto && <div className="pila">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!detalle && !error && <p role="status">Cargando intentos…</p>}
      {detalle && <>
        <div className="cabecera-pagina"><h3 className="titulo-tarjeta">Intentos de {nombrePeriodo(serie.periodo)}</h3>{ordenados.length > 1 && <Link className="enlace-accion" to={`/historial/${encodeURIComponent(serie.id)}`}>Comparar intentos</Link>}</div>
        <ol className="intentos-lista" aria-label="Intentos relacionados">{ordenados.map((i) => <li key={i.id} className="intento-resumen"><div className="intento-indice"><strong>Intento {i.numero}</strong>{i.id === detalle.ultimoIntentoId && <span className="etiqueta etiqueta-info">Actual</span>}</div><div className="intento-datos"><p className="intento-archivo">{i.archivo}</p><p className="texto-pequeno">{i.usuario} · {fechaHora(i.validadaEn)}</p><span className={`intento-resultado ${i.estructuraValida === false || !i.valida ? 'valor-observado' : ''}`}>{i.estructuraValida === false ? 'Sin evaluar' : i.valida ? 'Sin observaciones de formato' : `${i.errores?.length ?? 0} ${i.errores?.length === 1 ? 'observación' : 'observaciones'}`}</span></div><Link className="enlace-accion" to={`/revision/${encodeURIComponent(serie.id)}?intento=${encodeURIComponent(i.id)}`}>Ver revisión</Link></li>)}</ol>
        <details><summary className="enlace-accion">Consultar decisiones ({detalle.eventos?.length ?? 0})</summary><div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Decisiones y devoluciones"><table className="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Intento</th><th>Motivo</th></tr></thead><tbody>{(detalle.eventos ?? []).map((e) => <tr key={e.id}><td>{fechaHora(e.fecha)}</td><td>{e.usuario}</td><td>{nombreAccion(e.accion)}</td><td>{ordenados.find((i) => i.id === e.intentoId)?.numero ?? '—'}</td><td>{e.motivo || '—'}</td></tr>)}</tbody></table></div></details>
      </>}
    </div>}
  </details>;
}

export default function Historial() {
  const { sesion, empresaActiva } = useSesion();
  const [series, setSeries] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [periodo, setPeriodo] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [decision, setDecision] = useState('');
  const [buscar, setBuscar] = useState('');
  const elaborador = sesion.rol === 'ELABORADOR';
  const operador = sesion.rol === 'OPERADOR';
  const titulo = elaborador ? 'Mis planillas' : operador ? 'Mis revisiones' : 'Mis autorizaciones';

  useEffect(() => {
    let vigente = true;
    setError('');
    api.series(sesion, elaborador ? {} : { actividad: 'propia' })
      .then((datos) => { if (vigente) setSeries(datos); })
      .catch((err) => { if (vigente) setError(err.message); });
    return () => { vigente = false; };
  }, [sesion, elaborador, recarga]);
  useEffect(() => escucharCambiosPlanillas(() => setRecarga((n) => n + 1)), []);
  useEffect(() => { setPeriodo(''); setTipo(''); setEstado(''); setDecision(''); setBuscar(''); }, [empresaActiva?.ruc]);

  const deEmpresa = useMemo(() => (series ?? []).filter((s) => s.empresaRuc === empresaActiva?.ruc), [series, empresaActiva?.ruc]);
  const periodos = useMemo(() => [...new Set(deEmpresa.map((s) => s.periodo))].sort().reverse(), [deEmpresa]);
  const visibles = deEmpresa.filter((s) => (!periodo || s.periodo === periodo) && (!tipo || s.tipo === tipo) && (!estado || s.estado === estado) && (!decision || s.ultimaDecisionPropia?.accion === decision) && normalizar(`${s.ultimoIntentoResumen?.archivo ?? ''} ${s.ultimaDecisionPropia?.archivo ?? ''} ${s.id}`).includes(normalizar(buscar)));

  return <Marco>
    <div className="cabecera-pagina"><div><h1 className="titulo">{titulo}</h1><p className="subtitulo">{elaborador ? 'Consulta el estado de tus planillas, sus correcciones y decisiones.' : operador ? 'Consulta las revisiones que tú has aprobado o devuelto.' : 'Consulta las autorizaciones y devoluciones que tú has registrado.'}</p></div><div className="acciones-cabecera"><button type="button" className="boton boton-secundario" onClick={() => setRecarga((n) => n + 1)}>Actualizar historial</button>{elaborador && <Link className="boton boton-primario" to="/cargar">Revisar nuevo archivo</Link>}</div></div>
    <p className="resumen-bandeja">{empresaActiva?.nombre} · RUC {empresaActiva?.ruc}{!elaborador && ' · Última decisión propia por planilla'}</p>
    {error && <Aviso tipo="error">{error} <button className="enlace-boton" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></Aviso>}
    <section className="tarjeta sin-relleno">
      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo"><label htmlFor="historial-periodo">Período</label><select id="historial-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="">Todos</option>{periodos.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}</select></div>
        <div className="campo"><label htmlFor="historial-tipo">Tipo</label><select id="historial-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{['Regular', 'Complementaria', 'Corrección'].map((t) => <option key={t}>{t}</option>)}</select></div>
        {!elaborador && <div className="campo"><label htmlFor="historial-decision">Mi decisión</label><select id="historial-decision" value={decision} onChange={(e) => setDecision(e.target.value)}><option value="">Todas</option>{(operador ? ['aprobar', 'devolver-revision'] : ['autorizar', 'devolver-autorizacion']).map((a) => <option key={a} value={a}>{nombreAccion(a)}</option>)}</select></div>}
        <div className="campo"><label htmlFor="historial-estado">Estado actual</label><select id="historial-estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{['BORRADOR', 'PENDIENTE_REVISION', 'PENDIENTE_AUTORIZACION', 'DEVUELTA', 'AUTORIZADA'].map((v) => <option key={v} value={v}>{nombreEstado(v)}</option>)}</select></div>
        <div className="campo"><label htmlFor="historial-buscar">Buscar</label><input id="historial-buscar" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Archivo o referencia" /></div>
      </form>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}><table className="tabla"><caption className="sr">{elaborador ? 'Planillas de la empresa activa.' : 'Decisiones propias sobre planillas de la empresa activa.'}</caption><thead><tr><th>Período</th><th>{elaborador ? 'Trabajadores' : 'Archivo decidido'}</th><th>{elaborador ? 'Sueldos declarados' : 'Mi decisión'}</th><th>Estado actual</th><th>{elaborador ? 'Actualizado' : 'Fecha de mi decisión'}</th><th>Acción</th></tr></thead><tbody>
        {series === null && !error && <tr><td colSpan={6} className="celda-vacia">Cargando historial…</td></tr>}
        {series === null && error && <tr><td colSpan={6} className="celda-vacia">No se pudo cargar el historial.</td></tr>}
        {series !== null && visibles.length === 0 && <tr><td colSpan={6} className="celda-vacia">{deEmpresa.length ? 'No hay registros con esos filtros.' : elaborador ? 'Todavía no hay planillas para esta empresa.' : 'Todavía no has registrado decisiones para esta empresa.'}</td></tr>}
        {visibles.map((s) => {
          const i = s.ultimoIntentoResumen;
          const d = s.ultimaDecisionPropia;
          const etiqueta = s.estado === 'BORRADOR' ? i?.estructuraValida === false ? 'Sin evaluar' : i?.valida ? 'Lista para revisión' : 'Con observaciones' : nombreEstado(s.estado);
          return <Fragment key={s.id}><tr><th scope="row">{nombrePeriodo(s.periodo)}<div className="trabajador-identidad">{s.tipo}</div></th>
            {elaborador ? <><td className="mono">{i?.filas ?? '—'}</td><td className="mono sin-salto">{i?.estructuraValida === false ? '—' : balboas(i?.totalSalarios)}{i?.totalSalariosParcial && <div className="texto-pequeno">Suma parcial · {i.salariosValidos ?? 0} sueldos legibles</div>}</td></> : <><td className="romper">{d?.archivo}<div className="trabajador-identidad">Intento {d?.numeroIntento ?? '—'}{d?.esIntentoActual === false && ' · Hay una versión posterior'}</div></td><td><strong>{nombreAccion(d?.accion)}</strong>{d?.motivo && <p className="texto-pequeno romper">{d.motivo}</p>}</td></>}
            <td><span className={`etiqueta ${claseEstado(s.estado)}`}>{etiqueta}</span></td><td>{fechaHora(elaborador ? s.actualizadaEn : d?.fecha)}</td><td><Link className="boton boton-secundario" to={`/revision/${encodeURIComponent(s.id)}${!elaborador && d ? `?intento=${encodeURIComponent(d.intentoId)}` : ''}`}>{elaborador ? 'Ver planilla' : 'Ver intento decidido'}</Link></td></tr><tr><td colSpan={6}><Intentos serie={s} sesion={sesion} /></td></tr></Fragment>;
        })}
      </tbody></table></div>
      {series !== null && <div className="tabla-pie">Mostrando {visibles.length} de {deEmpresa.length} planillas de esta empresa.</div>}
    </section>
  </Marco>;
}
