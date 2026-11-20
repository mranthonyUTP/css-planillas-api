import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, fechaHora, nombrePeriodo, nombreEstado, claseEstado } from '../formato.js';

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
    <summary className="enlace-accion">Ver intentos ({serie.numeroIntentos})</summary>
    {abierto && <div className="pila">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!detalle && !error && <p role="status">Cargando intentos…</p>}
      {detalle && <>
        <div className="cabecera-pagina"><h3 className="titulo-tarjeta">Intentos de {nombrePeriodo(serie.periodo)}</h3>{ordenados.length > 1 && <Link className="enlace-accion" to={`/historial/${encodeURIComponent(serie.id)}`}>Comparar intentos</Link>}</div>
        <ol className="intentos-lista" aria-label="Intentos relacionados">{ordenados.map((i) => <li key={i.id} className="intento-resumen"><div className="intento-indice"><strong>Intento {i.numero}</strong>{i.id === detalle.ultimoIntentoId && <span className="etiqueta etiqueta-info">Actual</span>}</div><div className="intento-datos"><p className="intento-archivo">{i.archivo}</p><p className="texto-pequeno">{i.usuario} · {fechaHora(i.validadaEn)}</p><span className={`intento-resultado ${i.estructuraValida === false || !i.valida ? 'valor-observado' : ''}`}>{i.estructuraValida === false ? 'Sin evaluar' : i.valida ? 'Sin observaciones de formato' : `${i.errores?.length ?? 0} ${i.errores?.length === 1 ? 'observación' : 'observaciones'}`}</span></div><Link className="enlace-accion" to={`/revision/${encodeURIComponent(serie.id)}?intento=${encodeURIComponent(i.id)}`}>Ver revisión</Link></li>)}</ol>
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
  const [buscar, setBuscar] = useState('');
  const titulo = 'Mis planillas';

  useEffect(() => {
    let vigente = true;
    setError('');
    api.series(sesion)
      .then((datos) => { if (vigente) setSeries(datos); })
      .catch((err) => { if (vigente) setError(err.message); });
    return () => { vigente = false; };
  }, [sesion, recarga]);
  useEffect(() => escucharCambiosPlanillas(() => setRecarga((n) => n + 1)), []);
  useEffect(() => { setPeriodo(''); setTipo(''); setEstado(''); setBuscar(''); }, [empresaActiva?.ruc]);

  const deEmpresa = useMemo(() => (series ?? []).filter((s) => s.empresaRuc === empresaActiva?.ruc), [series, empresaActiva?.ruc]);
  const periodos = useMemo(() => [...new Set(deEmpresa.map((s) => s.periodo))].sort().reverse(), [deEmpresa]);
  const visibles = deEmpresa.filter((s) => (!periodo || s.periodo === periodo) && (!tipo || s.tipo === tipo) && (!estado || s.estado === estado) && normalizar(`${s.ultimoIntentoResumen?.archivo ?? ''} ${s.id}`).includes(normalizar(buscar)));

  return <Marco>
    <div className="cabecera-pagina"><div><h1 className="titulo">{titulo}</h1><p className="subtitulo">Consulta el formato, los contrastes y los intentos de tus planillas.</p></div><div className="acciones-cabecera"><button type="button" className="boton boton-secundario" onClick={() => setRecarga((n) => n + 1)}>Actualizar historial</button>{sesion.rol === 'ELABORADOR' && <Link className="boton boton-primario" to="/cargar">Revisar nuevo archivo</Link>}</div></div>
    <p className="resumen-bandeja">{empresaActiva?.nombre} · RUC {empresaActiva?.ruc}</p>
    {error && <Aviso tipo="error">{error} <button className="enlace-boton" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></Aviso>}
    <section className="tarjeta sin-relleno">
      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo"><label htmlFor="historial-periodo">Período</label><select id="historial-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="">Todos</option>{periodos.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}</select></div>
        <div className="campo"><label htmlFor="historial-tipo">Tipo</label><select id="historial-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{['Regular', 'Complementaria', 'Corrección'].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="campo"><label htmlFor="historial-estado">Estado actual</label><select id="historial-estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{['FORMATO_INVALIDO', 'CONTRASTE_NO_COMPARABLE', 'SIN_REFERENCIA', 'DIFERENCIAS_POR_REVISAR', 'SIN_DIFERENCIAS'].map((v) => <option key={v} value={v}>{nombreEstado(v)}</option>)}</select></div>
        <div className="campo"><label htmlFor="historial-buscar">Buscar</label><input id="historial-buscar" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Archivo o referencia" /></div>
      </form>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}><table className="tabla"><caption className="sr">Planillas de la empresa activa.</caption><thead><tr><th>Período</th><th>Trabajadores</th><th>Sueldos declarados</th><th>Estado actual</th><th>Actualizado</th><th>Acción</th></tr></thead><tbody>
        {series === null && !error && <tr><td colSpan={6} className="celda-vacia">Cargando historial…</td></tr>}
        {series === null && error && <tr><td colSpan={6} className="celda-vacia">No se pudo cargar el historial.</td></tr>}
        {series !== null && visibles.length === 0 && <tr><td colSpan={6} className="celda-vacia">{deEmpresa.length ? 'No hay registros con esos filtros.' : 'Todavía no hay planillas para esta empresa.'}</td></tr>}
        {visibles.map((s) => {
          const i = s.ultimoIntentoResumen;
          const etiqueta = nombreEstado(s.estado);
          return <Fragment key={s.id}><tr><th scope="row">{nombrePeriodo(s.periodo)}<div className="trabajador-identidad">{s.tipo}</div></th>
            <td className="mono">{i?.filas ?? '—'}</td><td className="mono sin-salto">{i?.estructuraValida === false ? '—' : balboas(i?.totalSalarios)}{i?.totalSalariosParcial && <div className="texto-pequeno">Suma parcial · {i.salariosValidos ?? 0} sueldos legibles</div>}</td>
            <td><span className={`etiqueta ${claseEstado(s.estado)}`}>{etiqueta}</span>{s.revisionInterna?.estado && s.revisionInterna.estado !== 'SIN_ENVIAR' && <p className="texto-pequeno">{({ PENDIENTE: 'Pendiente del operador', AUTORIZADA: 'Autorizada internamente', DEVUELTA: 'Devuelta para corregir' })[s.revisionInterna.estado]}</p>}</td><td>{fechaHora(s.actualizadaEn)}</td><td><Link className="boton boton-secundario" to={`/revision/${encodeURIComponent(s.id)}`}>Ver planilla</Link></td></tr><tr><td colSpan={6}><Intentos serie={s} sesion={sesion} /></td></tr></Fragment>;
        })}
      </tbody></table></div>
      {series !== null && <div className="tabla-pie">Mostrando {visibles.length} de {deEmpresa.length} planillas de esta empresa.</div>}
    </section>
  </Marco>;
}
