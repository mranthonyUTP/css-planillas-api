import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import { Alerta, Check, Descargar, Documento, Subir } from '../components/Iconos.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, claseEstado, fechaHora, nombreAccion, nombreEstado, nombrePeriodo } from '../formato.js';
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
  const [motivo, setMotivo] = useState('');
  const [devolviendo, setDevolviendo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [revision, setRevision] = useState(0);
  const claves = useRef({});
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
  useEffect(() => escucharCambiosPlanillas(() => { if (!procesando) setRevision((v) => v + 1); }, { locales: false }), [procesando]);
  useEffect(() => {
    const elegido = serie?.intentos.find((i) => i.id === (intentoId ?? serie.ultimoIntentoId));
    const primera = elegido?.trabajadores?.find((t) => erroresDe(t, elegido).length);
    setAbiertos(new Set(primera ? [primera.fila] : [])); setFiltro('todos'); setBusqueda('');
    setDevolviendo(false); setMotivo(''); setMensaje('');
  }, [serieId, intentoId, serie?.ultimoIntentoId]);
  if (!serieId) return <Navigate to={sesion.rol === 'ELABORADOR' ? '/cargar' : '/bandeja'} replace />;
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
  const elaborador = sesion.rol === 'ELABORADOR';
  const puedeCorregir = actual && elaborador;
  const puedeSolicitar = puedeCorregir && ['BORRADOR', 'DEVUELTA'].includes(serie.estado) && intento.valida;
  const puedeRevisar = actual && sesion.rol === 'OPERADOR' && serie.estado === 'PENDIENTE_REVISION';
  const puedeAutorizar = actual && sesion.rol === 'AUTORIZADOR' && serie.estado === 'PENDIENTE_AUTORIZACION';
  const ultimaDevolucion = [...(serie.eventos ?? [])].reverse().find((e) => e.intentoId === intento.id && e.motivo && (e.decision === 'devolver' || e.accion?.startsWith('devolver')));
  const ultimaDecision = [...(serie.eventos ?? [])].reverse().find((e) => e.intentoId === intento.id && e.accion !== 'carga');
  const comprobanteDelIntento = actual ? serie.comprobante?.intentoId === intento.id ? serie.comprobante : null : [...(serie.eventos ?? [])].reverse().find((e) => e.intentoId === intento.id && e.accion === 'autorizar')?.comprobante;
  const estadoTexto = serie.estado === 'BORRADOR' ? intento.valida ? 'Lista para revisión' : 'Con observaciones' : nombreEstado(serie.estado);
  const tituloVista = elaborador ? 'Revisión de planilla' : sesion.rol === 'OPERADOR' ? 'Revisión del operador' : 'Autorización de planilla';
  const descripcionVista = elaborador ? 'Consulta los registros y revisa las observaciones del archivo.' : sesion.rol === 'OPERADOR' ? 'Comprueba los datos y registra si la planilla puede pasar a autorización.' : 'Consulta los datos y la revisión previa antes de autorizar internamente.';
  const tituloDecision = elaborador ? 'Preparación de la planilla' : sesion.rol === 'OPERADOR' ? 'Decisión del operador' : 'Decisión del autorizador';
  const descripcionDecision = !actual ? 'Este intento es de consulta. Las decisiones se registran sobre el intento actual.' : puedeRevisar ? 'Aprueba la revisión o devuelve la planilla al elaborador indicando el motivo.' : puedeAutorizar ? 'Autoriza la planilla internamente o devuélvela indicando el motivo.' : puedeSolicitar ? 'Solicita la revisión del operador cuando hayas comprobado los datos.' : puedeCorregir && !intento.valida ? 'Carga un archivo corregido para resolver las observaciones de este intento.' : elaborador && puedeCorregir ? 'La planilla ya está en revisión o autorización. Una nueva corrección reiniciará ese proceso.' : 'No hay una decisión pendiente para tu rol en el estado actual de esta planilla.';
  const alternar = (fila) => setAbiertos((antes) => { const nuevo = new Set(antes); nuevo.has(fila) ? nuevo.delete(fila) : nuevo.add(fila); return nuevo; });
  const transicionar = async (accion) => {
    if (procesando) return;
    if (accion.startsWith('devolver') && !motivo.trim()) { setError('Escribe el motivo de la devolución para que el elaborador pueda corregirlo.'); document.getElementById('motivo-devolucion')?.focus(); return; }
    const clave = `${serie.id}:${intento.id}:${serie.eventos?.at(-1)?.id ?? 'inicial'}:${accion}`; claves.current[clave] ??= crypto.randomUUID();
    solicitudActual.current += 1;
    setProcesando(true); setError(''); setMensaje('');
    try {
      const datos = await api.transicionar({ serieId: serie.id, intentoId: intento.id, accion, motivo: motivo.trim(), idempotencyKey: claves.current[clave] }, sesion);
      setSerie(datos); setDevolviendo(false); setMotivo('');
      const esperado = accion.startsWith('devolver') ? 'DEVUELTA' : { solicitar: 'PENDIENTE_REVISION', aprobar: 'PENDIENTE_AUTORIZACION', autorizar: 'AUTORIZADA' }[accion];
      if (datos.estado !== esperado) { setError(`La planilla está en «${nombreEstado(datos.estado)}». Consulta la última decisión registrada; esta respuesta no confirma la acción en el estado esperado.`); return; }
      setMensaje({ solicitar: 'La planilla quedó pendiente de revisión del operador.', aprobar: 'Revisión completada. La planilla quedó pendiente de autorización.', autorizar: 'Planilla autorizada internamente.', 'devolver-revision': 'Planilla devuelta al elaborador con el motivo indicado.', 'devolver-autorizacion': 'Planilla devuelta al elaborador con el motivo indicado.' }[accion]);
    } catch (err) { setError(err.message); } finally { setProcesando(false); }
  };
  return <Marco><div className="revision-despejada">
    <nav className="migas" aria-label="Ubicación"><Link className="enlace-accion" to={elaborador ? '/historial' : '/bandeja'}>{elaborador ? 'Mis planillas' : sesion.rol === 'OPERADOR' ? 'Pendientes de revisión' : 'Pendientes de autorización'}</Link><span aria-hidden="true">/</span><span>Revisión · Intento {intento.numero}</span></nav>
    <div className="cabecera-pagina"><div><h1 className="titulo">{tituloVista}</h1><p className="subtitulo">{descripcionVista}</p></div><Link className="enlace-accion" to={`/historial/${serie.id}`}>Ver intentos y cambios</Link></div>
    {actual && elaborador && <Pasos actual={['BORRADOR', 'DEVUELTA'].includes(serie.estado) ? 2 : 3} />}
    {!elaborador && <div className="revision-estado"><span className={`etiqueta ${claseEstado(serie.estado)}`}>{estadoTexto}</span>{(puedeRevisar || puedeAutorizar) && <a className="enlace-accion" href="#decision-planilla">Ir a la decisión</a>}</div>}
    <section className="banda-archivo" aria-label="Resumen del archivo"><div className="banda-documento"><span className="archivo-icono"><Documento size={30} /><span>{intento.archivo.split('.').pop().toUpperCase()}</span></span><div><h2>{intento.archivo}</h2><p>{nombrePeriodo(intento.periodo)} · {intento.tipo} · Intento {intento.numero}</p><p className="texto-pequeno">{serie.empresaNombre}</p></div></div><div className="banda-cifra"><strong className="mono">{intento.filas}</strong><span>{estructuraValida ? 'trabajadores' : 'filas sin evaluar'}</span></div><div className="banda-cifra"><strong className="mono">{estructuraValida ? balboas(intento.totalSalarios) : '—'}</strong><span>{!estructuraValida ? 'Sueldos sin evaluar' : intento.totalSalariosParcial ? `Suma parcial · ${intento.salariosValidos ?? 0} sueldos legibles` : 'Sueldos declarados'}</span></div></section>
    {!actual && <Aviso tipo="info" titulo="Estás consultando un intento anterior">Su contenido se conserva para comparar. <Link className="enlace-accion" to={`/revision/${serie.id}`}>Abrir intento actual</Link>.</Aviso>}
    <Aviso tipo={intento.valida ? 'exito' : 'error'} titulo={intento.valida ? `${intento.filas} trabajadores sin observaciones de formato` : `${intento.errores.length} ${intento.errores.length === 1 ? 'observación' : 'observaciones'}${conError ? ` en ${conError} ${conError === 1 ? 'trabajador' : 'trabajadores'}` : ''}`}>{intento.valida ? 'La prevalidación de formato se completó. Revisa los datos antes de continuar.' : elaborador ? 'Corrige los datos en el archivo y carga una corrección dentro de esta misma planilla.' : 'Este intento contiene observaciones de formato. La corrección del archivo corresponde al elaborador.'}</Aviso>
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
    <section id="decision-planilla" className="tarjeta revision-decision" aria-labelledby="titulo-decision">
      <div className="revision-decision-cabecera"><h2 id="titulo-decision" className="titulo-tarjeta">{tituloDecision}</h2><p className="texto-pequeno">{descripcionDecision}</p></div>
      {ultimaDecision && <div className="decision-registrada"><strong>Última decisión registrada: {nombreAccion(ultimaDecision.accion)}</strong><p>{ultimaDecision.usuario} · {fechaHora(ultimaDecision.fecha)} · Intento {intento.numero}</p>{ultimaDecision.motivo && <p className="romper">Motivo: {ultimaDecision.motivo}</p>}<p>Estado actual: <strong>{nombreEstado(serie.estado)}</strong></p></div>}
      {error && <Aviso tipo="error">{error} <button type="button" className="enlace-boton" onClick={() => setRevision((v) => v + 1)}>Actualizar revisión</button></Aviso>}
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      <div className="acciones entre revision-decision-acciones"><button type="button" className="boton boton-secundario" onClick={() => descargarReporte(intento)}><Descargar /> Descargar reporte</button><div className="acciones-texto">{elaborador && <span className={`etiqueta ${claseEstado(serie.estado)}`}>{estadoTexto}</span>}{puedeCorregir && <Link className={`boton ${intento.valida ? 'boton-secundario' : 'boton-primario'}`} to={`/cargar?serie=${serie.id}`}><Subir size={19} />{intento.valida ? 'Cargar otra corrección' : 'Cargar archivo corregido'}</Link>}{puedeSolicitar && !devolviendo && <button type="button" className="boton boton-primario" disabled={procesando} onClick={() => transicionar('solicitar')}>{procesando ? 'Solicitando…' : 'Solicitar revisión'}</button>}{(puedeRevisar || puedeAutorizar) && !devolviendo && <><button type="button" className="boton boton-secundario boton-peligro" disabled={procesando} onClick={() => { setError(''); setDevolviendo(true); }}>Devolver</button><button type="button" className="boton boton-primario" disabled={procesando || !intento.valida} onClick={() => transicionar(puedeRevisar ? 'aprobar' : 'autorizar')}>{procesando ? 'Guardando…' : puedeRevisar ? 'Aprobar revisión' : 'Autorizar planilla'}</button></>}</div></div>
    </section>
    {devolviendo && <section className="tarjeta devolucion-formulario"><h2 className="titulo-tarjeta">Devolver al elaborador</h2><p className="texto-secundario">Indica qué debe corregirse. El motivo quedará asociado a este intento.</p><div className="campo"><label htmlFor="motivo-devolucion">Motivo de la devolución</label><textarea id="motivo-devolucion" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} required /></div><div className="acciones"><button type="button" className="boton boton-secundario" disabled={procesando} onClick={() => setDevolviendo(false)}>Cancelar</button><button type="button" className="boton boton-primario" disabled={procesando} onClick={() => transicionar(puedeRevisar ? 'devolver-revision' : 'devolver-autorizacion')}>{procesando ? 'Guardando…' : 'Confirmar devolución'}</button></div></section>}
    {(serie.estado === 'DEVUELTA' || !actual) && ultimaDevolucion && <div className="nota-devolucion"><strong>Motivo de la devolución de este intento</strong><p>{ultimaDevolucion.motivo}</p><p>{ultimaDevolucion.usuario} · {fechaHora(ultimaDevolucion.fecha)}</p></div>}
    {comprobanteDelIntento && <section className="tarjeta constancia-interna"><h2 className="titulo-tarjeta">Autorización interna{!actual ? ` · Intento ${intento.numero}` : ''}</h2><p><span className="mono">{comprobanteDelIntento.confirmacion}</span> · {comprobanteDelIntento.autorizadoPor} · {fechaHora(comprobanteDelIntento.autorizadoEn)}</p><p className="texto-pequeno">Esta constancia corresponde a la aprobación interna del intento {intento.numero}.</p></section>}
    <p className="nota-validacion">La prevalidación revisa la estructura y los importes del archivo. La autorización es un paso interno.</p>
  </div></Marco>;
}
