import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import { Descargar, Subir } from '../components/Iconos.jsx';
import { api } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { nombrePeriodo, periodosRecientes } from '../formato.js';
import { EJEMPLOS, MOSTRAR_DEMO, cargarEjemplo } from '../demo.js';

const TAMANO_MAXIMO_MB = 5;

export default function Cargar() {
  const { sesion, guardarValidacion } = useSesion();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const serieId = parametros.get('serie') || '';
  const esCorreccion = Boolean(serieId);
  const periodos = periodosRecientes();
  const [periodo, setPeriodo] = useState(periodos[0]);
  const [tipo, setTipo] = useState('Regular');
  const [serie, setSerie] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoSerie, setCargandoSerie] = useState(esCorreccion);

  useEffect(() => {
    let activo = true;
    setArchivo(null); setError(''); setSerie(null);
    if (!serieId) { setCargandoSerie(false); return undefined; }
    setCargandoSerie(true);
    api.detalleSerie(serieId, sesion).then((detalle) => {
      if (!activo) return;
      setSerie(detalle); setPeriodo(detalle.periodo); setTipo(detalle.tipo);
    }).catch((err) => { if (activo) setError(err.message); })
      .finally(() => { if (activo) setCargandoSerie(false); });
    return () => { activo = false; };
  }, [serieId, sesion]);

  const empresa = serie ? { ruc: serie.empresaRuc, nombre: serie.empresaNombre } : sesion.empresa;
  const requiereNuevaAprobacion = serie && !['BORRADOR', 'DEVUELTA'].includes(serie.estado);
  const bloqueado = cargando || cargandoSerie || (esCorreccion && !serie);
  const ultimoIntento = serie?.intentos.find((intento) => intento.id === serie.ultimoIntentoId);
  const elegir = (nuevoArchivo) => {
    setError('');
    if (!nuevoArchivo) return;
    if (nuevoArchivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) { setArchivo(null); setError(`El archivo supera ${TAMANO_MAXIMO_MB} MB. Selecciona un archivo de menor tamaño.`); return; }
    if (!/\.(csv|xlsx)$/i.test(nuevoArchivo.name)) { setArchivo(null); setError('Selecciona un archivo .csv o .xlsx.'); return; }
    setArchivo(nuevoArchivo);
  };
  const usarEjemplo = async (nombre) => { try { elegir(await cargarEjemplo(nombre)); } catch (err) { setError(err.message); } };
  const soltar = (e) => { e.preventDefault(); setArrastrando(false); if (!bloqueado) elegir(e.dataTransfer.files?.[0]); };
  const validar = async () => {
    if (!archivo) { setError('Selecciona un archivo para revisar.'); return; }
    if (bloqueado) return;
    setError(''); setCargando(true);
    try {
      const resultado = await api.validar({ archivo, periodo, tipo, ...(serieId ? { serieId } : {}) }, sesion);
      guardarValidacion(resultado);
      navegar(`/revision/${encodeURIComponent(resultado.serieId)}?intento=${encodeURIComponent(resultado.id)}`);
    } catch (err) { setError(err.message); } finally { setCargando(false); }
  };

  return (
    <Marco>
      <div className="cabecera-pagina">
        <div><h1 className="titulo">{esCorreccion ? 'Cargar corrección' : 'Cargar planilla'}</h1><p className="subtitulo">{esCorreccion ? 'El archivo será un nuevo intento de la misma planilla.' : 'Carga el archivo para revisar los datos de tus trabajadores.'}</p></div>
        <Link className="enlace-accion" to={serieId ? `/revision/${encodeURIComponent(serieId)}` : '/historial'}>{esCorreccion ? 'Volver a la revisión' : 'Ver historial'}</Link>
      </div>
      <Pasos actual={1} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargandoSerie && <Aviso tipo="info">Cargando los datos de la planilla…</Aviso>}
      <section className="tarjeta pila" aria-label={esCorreccion ? 'Archivo corregido' : 'Nueva planilla'}>
        <div className="cabecera-pagina"><div><h2 className="titulo-tarjeta">{empresa?.nombre ?? 'Empresa'}</h2><p className="texto-secundario">RUC {empresa?.ruc ?? '—'}</p></div>{ultimoIntento && <p className="texto-pequeno">Último intento: {ultimoIntento.numero} · {ultimoIntento.archivo}</p>}</div>
        {esCorreccion && serie && <Aviso tipo="info" titulo="Corrección de la misma planilla">Se conservarán la empresa, el período y el tipo. Los intentos anteriores seguirán disponibles para comparar los cambios.{requiereNuevaAprobacion && <> <strong>El nuevo intento requerirá otra revisión y autorización; las anteriores siguen en el historial.</strong></>}</Aviso>}
        <div className="fila-campos">
          <div className="campo"><label htmlFor="periodo">Período de la planilla</label><select id="periodo" value={periodo} disabled={esCorreccion || bloqueado} onChange={(e) => setPeriodo(e.target.value)}>{!periodos.includes(periodo) && <option value={periodo}>{nombrePeriodo(periodo)}</option>}{periodos.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}</select></div>
          <div className="campo"><label htmlFor="tipo">Tipo de planilla</label><select id="tipo" value={tipo} disabled={esCorreccion || bloqueado} onChange={(e) => setTipo(e.target.value)}><option>Regular</option><option>Complementaria</option><option>Corrección</option></select></div>
        </div>
        <label htmlFor="archivo" className={`zona-carga ${arrastrando ? 'arrastrando' : ''} ${archivo ? 'con-archivo' : ''}`} onDragOver={(e) => { e.preventDefault(); if (!bloqueado) setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={soltar}>
          <Subir />
          {archivo ? <><span className="zona-titulo">{archivo.name}</span><span className="texto-secundario">{(archivo.size / 1024).toFixed(1)} KB · <span className="enlace">Cambiar archivo</span></span></> : <><span className="zona-titulo">{esCorreccion ? 'Selecciona el archivo corregido' : 'Arrastra tu archivo aquí'}</span><span className="texto-secundario">o <span className="enlace">selecciónalo desde tu equipo</span></span><span className="texto-pequeno">.xlsx o .csv · Máximo {TAMANO_MAXIMO_MB} MB</span></>}
          <input id="archivo" type="file" accept=".xlsx,.csv" className="sr" disabled={bloqueado} onChange={(e) => elegir(e.target.files?.[0])} />
        </label>
        {MOSTRAR_DEMO && <div className="archivos-prueba-compactos"><span>Planillas de prueba</span><div><button type="button" className="boton boton-secundario" disabled={bloqueado} onClick={() => usarEjemplo(esCorreccion ? EJEMPLOS.corregida : EJEMPLOS.correcta)}>{esCorreccion ? 'Corregida' : 'Correcta'}</button><button type="button" className="boton boton-secundario" disabled={bloqueado} onClick={() => usarEjemplo(EJEMPLOS.conErrores)}>Con observaciones</button></div></div>}
        <div className="cabecera-pagina"><p className="texto-secundario">Conserva las columnas y los rubros de la plantilla de referencia.</p><a className="enlace-icono" href="/ejemplos/plantilla_referencia_25_columnas.xlsx" download><Descargar /> Plantilla de referencia · 25 columnas</a></div>
        <Aviso tipo="info">{esCorreccion ? 'Carga el archivo completo con las correcciones. Después podrás revisar las altas, las bajas y los cambios entre intentos.' : 'Esta carga inicia una nueva planilla. Para corregir una existente, ábrela desde el historial y usa «Cargar corrección».'}</Aviso>
        <div className="acciones"><button type="button" className="boton boton-primario" onClick={validar} disabled={bloqueado || !archivo}>{cargando ? 'Revisando archivo…' : esCorreccion ? 'Revisar corrección' : 'Revisar planilla'}</button></div>
      </section>
    </Marco>
  );
}
