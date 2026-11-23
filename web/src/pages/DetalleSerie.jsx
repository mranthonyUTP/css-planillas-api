import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, fechaHora, nombrePeriodo } from '../formato.js';

const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const original = (v) => v === '' ? 'Vacío' : v == null ? '—' : String(v);
const tieneError = (intento, cambio) => intento?.trabajadores?.find((t) => t.clave === cambio.clave)?.errores?.some((e) => e.campoId === cambio.campo || e.campo === cambio.campoNombre);

function Movimientos({ titulo, trabajadores }) {
  return trabajadores.length > 0 && <section className="tarjeta sin-relleno"><div className="tarjeta-cabecera"><h2 className="titulo-tarjeta">{titulo} ({trabajadores.length})</h2></div><div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Trabajador</th><th>Documento</th><th>Sueldo declarado</th></tr></thead><tbody>{trabajadores.map((t, i) => <tr key={`${t.clave}-${i}`}><th scope="row">{t.nombreCompleto}</th><td className="mono">{t.documento}</td><td className="mono">{original(t.sueldo)}</td></tr>)}</tbody></table></div></section>;
}

export default function DetalleSerie() {
  const { serieId } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const { sesion, empresaActiva, seleccionarEmpresa } = useSesion();
  const [detalle, setDetalle] = useState(null);
  const [comparacion, setComparacion] = useState(null);
  const [error, setError] = useState('');
  const [errorComparacion, setErrorComparacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  useEffect(() => {
    let vigente = true; setDetalle(null); setError('');
    api.detalleSerie(serieId, sesion).then((s) => { if (vigente) { setDetalle(s); if (s.empresaRuc !== empresaActiva?.ruc) seleccionarEmpresa(s.empresaRuc); } }).catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [serieId, sesion, recarga]);
  const intentos = [...(detalle?.intentos ?? [])].sort((a, b) => a.numero - b.numero);
  const despues = intentos.slice(1).find((i) => i.id === parametros.get('actual')) ?? intentos.at(-1);
  const disponibles = intentos.filter((i) => i.numero < (despues?.numero ?? 0));
  const antes = disponibles.find((i) => i.id === parametros.get('anterior')) ?? disponibles.at(-1);
  useEffect(() => {
    if (!antes || !despues) return undefined;
    let vigente = true; setComparacion(null); setErrorComparacion(''); setCargando(true);
    api.comparar(serieId, antes.id, despues.id, sesion).then((c) => { if (vigente) setComparacion(c); }).catch((e) => { if (vigente) setErrorComparacion(e.message); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [serieId, antes?.id, despues?.id, sesion, recarga]);
  const seleccionar = (campo, id) => { const p = new URLSearchParams(parametros); p.set(campo, id); setParametros(p, { replace: true }); };
  const coincide = (...valores) => normalizar(valores.join(' ')).includes(normalizar(busqueda));
  const cambios = (comparacion?.cambios ?? []).filter((c) => coincide(c.nombre, c.documento, c.campoNombre, c.antes, c.despues));
  const altas = (comparacion?.altas ?? []).filter((t) => coincide(t.nombreCompleto, t.documento));
  const bajas = (comparacion?.bajas ?? []).filter((t) => coincide(t.nombreCompleto, t.documento));
  const claves = new Set([...(comparacion?.cambios ?? []), ...(comparacion?.altas ?? [])].map((t) => t.clave));
  const iguales = (despues?.trabajadores ?? []).filter((t) => !claves.has(t.clave));
  const mostrarCambios = filtro === 'todos' || filtro === 'cambios';
  const mostrarAltas = filtro === 'todos' || filtro === 'altas';
  const mostrarBajas = filtro === 'todos' || filtro === 'bajas';
  return <Marco><div className="comparacion-despejada">
    <nav className="migas" aria-label="Ubicación"><Link className="enlace-accion" to="/historial">← Historial</Link></nav>
    <div className="cabecera-pagina"><div><h1 className="titulo">Comparar intentos</h1><p className="subtitulo">{detalle ? `${nombrePeriodo(detalle.periodo)} · ${detalle.tipo} · ${detalle.empresaNombre}` : 'Consulta qué cambió entre dos revisiones de la misma planilla.'}</p></div></div>
    {error && <Aviso tipo="error">{error} <button className="enlace-boton" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></Aviso>}
    {!detalle && !error && <p role="status">Cargando planilla…</p>}
    {detalle && intentos.length < 2 && <Aviso tipo="info">Esta planilla tiene un solo intento. Carga una corrección para poder comparar. <Link className="enlace-accion" to={`/revision/${encodeURIComponent(serieId)}`}>Abrir revisión</Link></Aviso>}
    {detalle && intentos.length >= 2 && <div className="pila">
      <section className="tarjeta serie-resumen"><div><h2>{despues?.archivo}</h2><p>{nombrePeriodo(detalle.periodo)} · {detalle.tipo} · Intento {despues?.numero}{despues?.id === detalle.ultimoIntentoId ? ' · Actual' : ''}</p></div><div><strong className="mono">{despues?.filas}</strong> trabajadores</div><div><strong className="mono">{despues?.estructuraValida === false ? '—' : balboas(despues?.totalSalarios)}</strong><p>{despues?.estructuraValida === false ? 'Sueldos sin evaluar' : despues?.totalSalariosParcial ? `Suma parcial · ${despues.salariosValidos ?? 0} sueldos legibles` : 'Sueldos declarados'}</p></div></section>
      <section className="tarjeta sin-relleno"><div className="comparacion-selectores"><div className="campo"><label htmlFor="comparacion-anterior">Antes</label><select id="comparacion-anterior" value={antes?.id ?? ''} onChange={(e) => seleccionar('anterior', e.target.value)}>{disponibles.map((i) => <option key={i.id} value={i.id}>Intento {i.numero}</option>)}</select><p className="texto-pequeno">{fechaHora(antes?.validadaEn)} · {antes?.valida ? 'Sin observaciones' : `${antes?.errores?.length ?? 0} observaciones`}</p></div><div className="campo"><label htmlFor="comparacion-actual">Después</label><select id="comparacion-actual" value={despues?.id ?? ''} onChange={(e) => seleccionar('actual', e.target.value)}>{intentos.slice(1).map((i) => <option key={i.id} value={i.id}>Intento {i.numero}{i.id === detalle.ultimoIntentoId ? ' · Actual' : ''}</option>)}</select><p className="texto-pequeno">{fechaHora(despues?.validadaEn)} · {despues?.valida ? 'Sin observaciones' : `${despues?.errores?.length ?? 0} observaciones`}</p></div></div><form className="filtros" onSubmit={(e) => e.preventDefault()}><div className="campo"><label htmlFor="comparacion-buscar">Buscar trabajador, documento o campo</label><input id="comparacion-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div><div className="campo"><label htmlFor="comparacion-mostrar">Mostrar</label><select id="comparacion-mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="todos">Todos los cambios</option><option value="cambios">Campos modificados</option><option value="altas">Altas</option><option value="bajas">Bajas</option></select></div></form></section>
      {cargando && <p role="status">Comparando intentos…</p>}
      {errorComparacion && <Aviso tipo="error">{errorComparacion}</Aviso>}
      {comparacion?.comparable === false && <Aviso tipo="error" titulo="Hay identidades que requieren revisión"><p>No se pueden relacionar estos registros con certeza.</p><ul>{comparacion.conflictos?.map((c, i) => <li key={i}>{c.motivo}</li>)}</ul></Aviso>}
      {comparacion?.comparable && <>
        <p className="texto-secundario" role="status">{comparacion.cambios.length} campos modificados · {comparacion.altas.length} altas · {comparacion.bajas.length} bajas</p>
        {mostrarCambios && cambios.length > 0 && <section className="tarjeta sin-relleno"><div className="tarjeta-cabecera"><h2 className="titulo-tarjeta">{cambios.length} {cambios.length === 1 ? 'campo cambió' : 'campos cambiaron'}</h2></div><div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Campos modificados"><table className="tabla"><thead><tr><th>Trabajador</th><th>Campo</th><th>Antes</th><th>Después</th><th>Resultado</th></tr></thead><tbody>{cambios.map((c, i) => { const malAntes = tieneError(antes, c); const malDespues = tieneError(despues, c); return <tr key={`${c.clave}-${c.campo}-${i}`}><th scope="row">{c.nombre}<div className="trabajador-identidad">{c.documento} · Fila {c.filaActual}</div></th><td>{c.campoNombre ?? c.campo}</td><td className={`mono ${malAntes ? 'valor-observado' : 'valor-anterior'}`}>{original(c.antes)}</td><td className={`mono ${malDespues ? 'valor-observado' : malAntes ? 'valor-corregido' : 'valor-actualizado'}`}>{original(c.despues)}</td><td><span className={`etiqueta ${malDespues ? 'etiqueta-error' : malAntes ? 'etiqueta-exito' : 'etiqueta-info'}`}>{malDespues ? 'Con observación' : malAntes ? 'Observación resuelta' : 'Valor actualizado'}</span></td></tr>; })}</tbody></table></div></section>}
        {mostrarAltas && <Movimientos titulo="Altas de trabajadores" trabajadores={altas} />}
        {mostrarBajas && <Movimientos titulo="Bajas de trabajadores" trabajadores={bajas} />}
        {((!mostrarCambios || !cambios.length) && (!mostrarAltas || !altas.length) && (!mostrarBajas || !bajas.length)) && <Aviso tipo="info">{busqueda || filtro !== 'todos' ? 'No hay cambios con estos filtros.' : 'No hay cambios entre estos intentos, aunque el orden de las filas sea diferente.'}</Aviso>}
        <section className="tarjeta"><h2 className="titulo-tarjeta">Datos que permanecen iguales</h2><p className="texto-secundario">{iguales.length} trabajadores sin cambios.{!antes?.totalSalariosParcial && !despues?.totalSalariosParcial && antes?.estructuraValida !== false && despues?.estructuraValida !== false && comparacion.totales?.antes?.sueldos === comparacion.totales?.despues?.sueldos && <> Sueldos declarados: <span className="mono">{balboas(comparacion.totales?.despues?.sueldos)}</span>.</>}</p><details><summary className="enlace-accion">Ver registros sin cambios</summary><div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Trabajador</th><th>Documento</th><th>Sueldo declarado</th></tr></thead><tbody>{iguales.filter((t) => coincide(t.nombreCompleto, t.documento)).map((t, i) => <tr key={`${t.clave}-${i}`}><th scope="row">{t.nombreCompleto}</th><td>{t.documento}</td><td className="mono">{original(t.sueldo)}</td></tr>)}</tbody></table></div></details></section>
      </>}
      {(detalle.revisionesInternas?.length ?? 0) > 0 && (
        <section className="tarjeta sin-relleno">
          <div className="tarjeta-cabecera"><h2 className="titulo-tarjeta">Bitácora de revisiones internas ({detalle.revisionesInternas.length})</h2></div>
          <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Fecha y hora</th><th>Intento</th><th>Acción</th><th>Usuario</th><th>Motivo</th></tr></thead><tbody>
            {detalle.revisionesInternas.map((r) => {
              const etiqueta = r.accion === 'autorizar-operador' ? 'Autorizada internamente' : r.accion === 'devolver-operador' ? 'Devuelta para corregir' : 'Enviada para autorización';
              const intentoNum = intentos.find((i) => i.id === r.intentoId)?.numero;
              return <tr key={r.id}><td>{fechaHora(r.fecha)}</td><td className="mono">{intentoNum ? `#${intentoNum}` : '—'}</td><td><span className={`etiqueta ${r.accion === 'autorizar-operador' ? 'etiqueta-exito' : r.accion === 'devolver-operador' ? 'etiqueta-error' : 'etiqueta-info'}`}>{etiqueta}</span></td><td>{r.usuario}</td><td>{r.motivo || '—'}</td></tr>;
            })}
          </tbody></table></div>
        </section>
      )}
      <div className="acciones entre"><Link className="boton boton-secundario" to="/historial">Volver al historial</Link><Link className="boton boton-primario" to={`/revision/${encodeURIComponent(serieId)}`}>Abrir revisión actual →</Link></div>
    </div>}
  </div></Marco>;
}
