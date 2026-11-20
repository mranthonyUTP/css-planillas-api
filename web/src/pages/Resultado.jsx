import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import Contraste from '../components/Contraste.jsx';
import { Alerta, Check, Descargar, Documento, Subir } from '../components/Iconos.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, nombrePeriodo } from '../formato.js';
import { RUBROS } from '../../../shared/planillas.js';

const erroresDe = (trabajador, intento) => trabajador.errores ?? intento.errores.filter((e) => e.fila === trabajador.fila);
const texto = (v) => v === '' || v == null ? '(vacío)' : String(v);
const buscarTexto = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dineroOTexto = (v) => balboas(v) === '—' ? texto(v) : balboas(v);
function Flecha() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>; }
function ErrorDetalle({ error }) { return <div className="observacion-campo"><strong>{error.campo} · Fila {error.fila}</strong><p>Valor recibido: <code>{texto(error.valor)}</code></p><p>{error.problema}</p><p>{error.solucion}</p></div>; }
function descargarReporte(intento) {
  const columnas = ['fila', 'campo', 'valor', 'problema', 'solucion'];
  const escapar = (v) => { const t = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replaceAll('"', '""')}"`; };
  const contenido = [columnas.join(','), ...intento.errores.map((e) => columnas.map((c) => escapar(e[c])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a'); enlace.href = url;
  enlace.download = `reporte_intento_${intento.numero}_${intento.archivo.replace(/\.[^.]+$/, '')}.csv`;
  enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}


function RubrosArchivo({ trabajador, errores }) {
  const rubros = RUBROS.map((r) => {
    const valor = trabajador.rubros?.[r.id] ?? (r.id === 'sueldo' ? trabajador.sueldo : '');
    const observaciones = errores.filter((e) => e.campoId === r.id || buscarTexto(e.campo) === buscarTexto(r.nombre) || (r.id === 'sueldo' && (e.campoId === 'salario' || buscarTexto(e.campo) === 'salario devengado')));
    return { ...r, valor, observaciones };
  }).filter((r) => (r.valor != null && String(r.valor).trim() !== '') || r.observaciones.length);
  const enCero = (r) => r.id !== 'sueldo' && !r.observaciones.length && Number(r.valor) === 0;
  const principales = rubros.filter((r) => !enCero(r));
  const ceros = rubros.filter(enCero);
  const dibujar = (r) => <div className={`rubro ${r.observaciones.length ? 'rubro-con-error' : ''}`} key={r.id}><div className="rubro-linea"><span className="rubro-nombre">{r.nombre}</span><span className="rubro-valor mono">{dineroOTexto(r.valor)}</span></div>{r.observaciones.length > 0 && <p className="error-contextual"><Alerta size={14} /><span>{r.observaciones.map((e) => e.problema).join(' ')}</span></p>}</div>;
  return <div className="rubros-archivo"><div className="rubros-grid">{principales.map(dibujar)}</div>{ceros.length > 0 && <details className="rubros-ceros"><summary>Ver {ceros.length} rubros en cero del archivo</summary><div className="rubros-grid">{ceros.map(dibujar)}</div></details>}{!rubros.length && <p className="texto-pequeno">Este registro no incluye valores en los rubros.</p>}</div>;
}

export default function Resultado() {
  const { serieId: parametroSerie } = useParams();
  const [parametros] = useSearchParams();
  const { sesion, validacion, empresaActiva, seleccionarEmpresa } = useSesion();
  const serieId = parametroSerie ?? validacion?.serieId;
  const intentoId = parametros.get('intento') ?? (!parametroSerie ? validacion?.id : null);
  const [serie, setSerie] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [abiertos, setAbiertos] = useState(new Set());
  const [revision, setRevision] = useState(0);
  const serieCargada = useRef(null);
  const solicitudActual = useRef(0);
  useEffect(() => {
    if (!serieId) { setCargando(false); return; }
    let vigente = true;
    const solicitud = ++solicitudActual.current;
    if (serieCargada.current !== serieId) { setCargando(true); setSerie(null); serieCargada.current = serieId; }
    setError('');
    api.detalleSerie(serieId, sesion).then((datos) => { if (vigente && solicitud === solicitudActual.current) { setSerie(datos); if (datos.empresaRuc !== empresaActiva?.ruc) seleccionarEmpresa(datos.empresaRuc); } })
      .catch((err) => { if (vigente && solicitud === solicitudActual.current) { setError(err.message); if ([403, 404].includes(err.estado)) setSerie(null); } })
      .finally(() => { if (vigente && solicitud === solicitudActual.current) setCargando(false); });
    return () => { vigente = false; };
  }, [serieId, sesion, revision]);
  useEffect(() => escucharCambiosPlanillas(() => setRevision((v) => v + 1), { locales: false }), []);
  useEffect(() => {
    const elegido = serie?.intentos.find((i) => i.id === (intentoId ?? serie.ultimoIntentoId));
    const primera = elegido?.trabajadores?.find((t) => erroresDe(t, elegido).length);
    setAbiertos(new Set(primera ? [primera.fila] : [])); setFiltro('todos'); setBusqueda('');
  }, [serieId, intentoId, serie?.ultimoIntentoId]);
  if (!serieId) return <Navigate to={'/cargar'} replace />;
  if (cargando) return <Marco><p role="status">Cargando la revisión de la planilla…</p></Marco>;
  if (!serie) return <Marco><Aviso tipo="error">{error || 'No encontramos esta planilla.'}</Aviso><Link to="/historial" className="enlace-accion">Volver al historial</Link></Marco>;
  const intento = serie.intentos.find((i) => i.id === (intentoId ?? serie.ultimoIntentoId));
  if (!intento) return <Marco><Aviso tipo="error">Este intento no pertenece a la planilla seleccionada.</Aviso><Link className="enlace-accion" to={`/revision/${serie.id}`}>Ver intento actual</Link></Marco>;
  const actual = intento.id === serie.ultimoIntentoId;
  const estructuraValida = intento.estructuraValida !== false;
  const trabajadores = estructuraValida ? intento.trabajadores ?? [] : [];
  const conError = trabajadores.filter((t) => erroresDe(t, intento).length).length;
  const erroresGenerales = intento.errores.filter((e) => !trabajadores.some((t) => t.fila === e.fila));
  const visibles = trabajadores.filter((t) => {
    const tieneError = erroresDe(t, intento).length > 0;
    return (filtro === 'todos' || (filtro === 'errores' ? tieneError : !tieneError)) && buscarTexto(`${t.nombreCompleto} ${t.documento} ${t.seguroSocial} ${t.fila}`).includes(buscarTexto(busqueda));
  });
  const alternar = (fila) => setAbiertos((antes) => { const nuevo = new Set(antes); nuevo.has(fila) ? nuevo.delete(fila) : nuevo.add(fila); return nuevo; });
  return <Marco><div className="revision-despejada">
    <nav className="migas" aria-label="Ubicación"><Link className="enlace-accion" to="/historial">Mis planillas</Link><span aria-hidden="true">/</span><span>Revisión · Intento {intento.numero}</span></nav>
    <div className="cabecera-pagina"><div><h1 className="titulo">Revisión de planilla</h1><p className="subtitulo">Consulta el formato, contrasta los sueldos y conserva las correcciones.</p></div><Link className="enlace-accion" to={`/historial/${serie.id}`}>Ver intentos y cambios</Link></div>
    {actual && <Pasos actual={2} />}
    <section className="banda-archivo" aria-label="Resumen del archivo"><div className="banda-documento"><span className="archivo-icono"><Documento size={30} /><span>{intento.archivo.split('.').pop().toUpperCase()}</span></span><div><h2>{intento.archivo}</h2><p>{nombrePeriodo(intento.periodo)} · {intento.tipo} · Intento {intento.numero}</p><p className="texto-pequeno">{serie.empresaNombre}</p></div></div><div className="banda-cifra"><strong className="mono">{intento.filas}</strong><span>{estructuraValida ? 'trabajadores' : 'filas sin evaluar'}</span></div><div className="banda-cifra"><strong className="mono">{estructuraValida ? balboas(intento.totalSalarios) : '—'}</strong><span>{!estructuraValida ? 'Sueldos sin evaluar' : intento.totalSalariosParcial ? `Suma parcial · ${intento.salariosValidos ?? 0} sueldos legibles` : 'Sueldos declarados'}</span></div></section>
    {!actual && <Aviso tipo="info" titulo="Estás consultando un intento anterior">Su contenido se conserva para comparar. <Link className="enlace-accion" to={`/revision/${serie.id}`}>Abrir intento actual</Link>.</Aviso>}
    <Aviso tipo={intento.valida ? 'exito' : 'error'} titulo={intento.valida ? `${intento.filas} trabajadores sin observaciones de formato` : `${intento.errores.length} ${intento.errores.length === 1 ? 'observación' : 'observaciones'}${conError ? ` en ${conError} ${conError === 1 ? 'trabajador' : 'trabajadores'}` : ''}`}>{intento.valida ? 'La prevalidación de formato se completó. Revisa los datos antes de continuar.' : 'Corrige los datos en el archivo y carga una corrección dentro de esta misma planilla.'}</Aviso>
    <section className="tarjeta sin-relleno revision-panel" aria-labelledby="titulo-trabajadores"><div className="trabajadores-barra"><h2 id="titulo-trabajadores" className="titulo-tarjeta">Trabajadores</h2>{estructuraValida && <><div className="filtros-trabajadores" aria-label="Filtrar trabajadores por resultado">{[['todos', 'Todos', trabajadores.length], ['errores', 'Con observaciones', conError], ['correctos', 'Sin observaciones', trabajadores.length - conError]].map(([v, label, n]) => <button type="button" key={v} className={`filtro-trabajadores ${filtro === v ? 'seleccionado' : ''}`} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{label} <span>{n}</span></button>)}</div><div className="campo busqueda-trabajador"><label htmlFor="buscar-trabajador" className="sr">Buscar por nombre, documento, seguro social o fila</label><input id="buscar-trabajador" type="search" placeholder="Buscar trabajador" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div></>}</div>
      {erroresGenerales.length > 0 && <div className="errores-generales">{erroresGenerales.map((e, i) => <Aviso tipo="error" key={i}><ErrorDetalle error={e} /></Aviso>)}</div>}
      {estructuraValida ? <div className="tabla-contenedor" role="region" aria-label="Registros de trabajadores" tabIndex={0}><table className="tabla tabla-trabajadores"><caption className="sr">Trabajadores del intento {intento.numero}. Expande una fila para consultar sus rubros y observaciones.</caption><thead><tr><th scope="col">Fila del archivo</th><th scope="col">Trabajador</th><th scope="col" className="alinear-derecha">Sueldo</th><th scope="col">Resultado</th><th scope="col">Rubros</th></tr></thead><tbody>
        {visibles.map((t) => { const errores = erroresDe(t, intento); const abierto = abiertos.has(t.fila); const detalleId = `rubros-${intento.id}-${t.fila}`;
          return <Fragment key={`${t.clave}-${t.fila}`}><tr><td className="mono">{t.fila}</td><td><div className="trabajador-nombre">{t.nombreCompleto || '(Sin nombre)'}</div><div className="trabajador-identidad">{t.tipoDocumento ? `${t.tipoDocumento} · ` : ''}{t.documento || 'Sin documento'}</div></td><td className="mono alinear-derecha sin-salto">{dineroOTexto(t.sueldo)}</td><td><span className={`resultado-trabajador ${errores.length ? 'resultado-error' : 'resultado-correcto'}`}>{errores.length ? <Alerta size={17} /> : <Check size={17} />}<span>{errores.length ? `${errores.length} ${errores.length === 1 ? 'observación' : 'observaciones'}` : 'Sin observaciones'}</span></span></td><td><button className="boton-fila" type="button" aria-label={`${abierto ? 'Ocultar' : 'Ver'} los rubros del archivo de ${t.nombreCompleto || `fila ${t.fila}`}`} aria-expanded={abierto} aria-controls={abierto ? detalleId : undefined} onClick={() => alternar(t.fila)}><span>{abierto ? 'Ocultar' : 'Ver rubros'}</span><Flecha /></button></td></tr>
          {abierto && <tr className="fila-detalle"><td colSpan={5}><div id={detalleId} className="trabajador-detalle"><h3 className="titulo-tarjeta">Rubros de {t.nombreCompleto || `fila ${t.fila}`}</h3><p className="rubros-origen">Valores incluidos en el archivo. Los campos vacíos no se muestran.</p><p className="texto-pequeno">Documento: {t.documento || '(vacío)'} · Seguro social: {t.seguroSocial || '(vacío)'}</p>{t.adicionales && <p className="texto-pequeno">Días laborados: {texto(t.adicionales.dias_laborados)} · Código de ocupación: {texto(t.adicionales.codigo_ocupacion)}</p>}<div className="detalle-disposicion"><RubrosArchivo trabajador={t} errores={errores} /><div className={`observaciones-inline ${errores.length ? 'observaciones-error' : 'observaciones-correctas'}`}><h4>{errores.length ? 'Observaciones del trabajador' : 'Rubros revisados'}</h4>{errores.length ? errores.map((e, i) => <ErrorDetalle key={i} error={e} />) : <p>Sin observaciones de formato en este registro.</p>}</div></div></div></td></tr>}</Fragment>;
        })}{visibles.length === 0 && <tr><td colSpan={5} className="celda-vacia">No hay trabajadores con esos filtros.</td></tr>}
      </tbody></table></div> : <div className="celda-vacia">Sin evaluar. Revisa los encabezados del archivo antes de verificar los trabajadores.</div>}
      <div className="tabla-pie" role="status">{estructuraValida ? `${trabajadores.length} registros · ${trabajadores.length - conError} sin observaciones · ${conError} con observaciones` : 'Sin evaluar: estructura del archivo pendiente de corrección.'}{estructuraValida && (busqueda || filtro !== 'todos') ? ` · ${visibles.length} visibles` : ''}</div>
    </section>
    <Contraste contraste={intento.contraste} />
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="acciones entre"><button type="button" className="boton boton-secundario" onClick={() => descargarReporte(intento)}><Descargar /> Descargar observaciones de formato</button><div className="acciones">{actual && sesion.rol === 'ELABORADOR' && <Link className="boton boton-secundario" to={`/cargar?serie=${serie.id}`}><Subir size={19} />Cargar corrección</Link>}{intento.valida ? <Link className="boton boton-primario" to={`/revision/${encodeURIComponent(serie.id)}/resumen?intento=${encodeURIComponent(intento.id)}`}>Finalizar revisión</Link> : <button className="boton boton-primario" type="button" disabled aria-describedby="bloqueo-resumen">Finalizar revisión</button>}</div></div>
    {!intento.valida && <p id="bloqueo-resumen" className="error-contextual">Corrige las observaciones de formato antes de continuar al resumen.</p>}
    <p className="nota-validacion">Corrige en el archivo de origen. El nuevo intento conserva los anteriores y permite comparar qué cambió.</p>
  </div></Marco>;
}
