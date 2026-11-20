import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import { Documento, Check, Alerta, Info, Subir } from '../components/Iconos.jsx';
import Aviso from '../components/Aviso.jsx';
import RevisionOperador from '../components/RevisionOperador.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, nombrePeriodo, fechaHora, nombreEstado } from '../formato.js';
import { estadoIntento } from '../../../shared/estado.js';

export default function Resumen() {
  const { serieId } = useParams();
  const [parametros] = useSearchParams();
  const intentoId = parametros.get('intento');
  const { sesion } = useSesion();
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  useEffect(() => escucharCambiosPlanillas(() => setRecarga(n => n + 1)), []);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(''); setDetalle(null);
    api.detalleSerie(serieId, sesion).then(datos => { if (vigente) setDetalle(datos); })
      .catch(err => { if (vigente) setError(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [serieId, sesion, recarga]);
  const intento = detalle?.intentos.find(i => i.id === (intentoId ?? detalle.ultimoIntentoId));
  if (cargando) return <Marco><p role="status">Cargando el resumen…</p></Marco>;
  if (!intento) return <Marco><Aviso tipo="error">{error || 'No encontramos este intento de la planilla.'}</Aviso><Link className="boton boton-secundario" to="/historial">Volver al historial</Link></Marco>;
  const actual = intento.id === detalle.ultimoIntentoId;
  const contraste = intento.contraste;
  const realizado = contraste?.estado === 'realizado';
  const diferencias = contraste?.diferencias.length ?? 0;
  const revision = `/revision/${encodeURIComponent(serieId)}?intento=${encodeURIComponent(intento.id)}`;
  if (!intento.valida) return <Navigate to={revision} replace />;
  return <Marco><div className="pila resumen-final">
    <div><h1 className="titulo">Resumen de la revisión</h1><p className="subtitulo">Consulta el resultado guardado y lo que queda por revisar.</p></div>
    <Pasos actual={3} />
    {!actual && <Aviso tipo="info">Este resumen corresponde a un intento anterior. Hay un intento más reciente en esta planilla. <Link className="enlace-accion" to={`/revision/${encodeURIComponent(serieId)}`}>Ver intento actual</Link></Aviso>}
    <section className={`resumen-hero ${!intento.valida || contraste?.estado === 'no_comparable' ? 'resumen-hero-alerta' : ''}`} aria-label="Resultado del intento">
      <div className="resumen-hero-superior"><span className="resumen-antetitulo">RESULTADO DEL INTENTO {intento.numero}</span><span className="resumen-version">{actual ? 'Versión actual' : 'Versión anterior'}</span></div>
      <div className="resumen-hero-titulo"><span className="resumen-estado-icono">{!intento.valida || diferencias || contraste?.estado === 'no_comparable' ? <Alerta size={30} /> : <Info size={30} />}</span><h2>{nombreEstado(estadoIntento(intento))}</h2></div>
      <p className="resumen-hero-descripcion">{!intento.valida ? 'El archivo tiene observaciones que debes corregir.' : realizado && diferencias ? 'El formato pasó la revisión. Hay datos que requieren tu atención al contrastarlos con la referencia.' : realizado ? 'Los trabajadores y sus sueldos coinciden con la referencia aportada.' : 'La revisión del formato está guardada. El contraste no se completó.'}</p>
      <div className="resumen-metricas"><div><span>Registros del archivo</span><strong className="mono">{intento.filas}</strong></div><div><span>{intento.totalSalariosParcial ? 'Sueldos · suma parcial' : 'Sueldos declarados'}</span><strong className="mono">{intento.estructuraValida === false ? 'Sin evaluar' : balboas(intento.totalSalarios)}</strong></div></div>
    </section>
    <section className="resumen-archivo" aria-label="Archivo revisado"><span className="resumen-documento"><Documento size={26} /></span><div><h2>{intento.archivo}</h2><p>{detalle.empresaNombre} · {nombrePeriodo(intento.periodo)} · {intento.tipo}</p><p className="texto-pequeno">Guardado el {fechaHora(intento.validadaEn)} · {intento.usuario}</p></div></section>
    <div className="resumen-comprobaciones">
      <section className="tarjeta resumen-comprobacion"><div className="resumen-comprobacion-titulo"><span className={`resumen-sello ${intento.valida ? 'resumen-sello-correcto' : ''}`}>{intento.valida ? <Check size={20} /> : <Alerta size={20} />}</span><h2>Formato del archivo</h2></div><strong className="resumen-conteo">{intento.errores.length}</strong><p>{intento.errores.length ? 'observaciones pendientes' : 'observaciones de formato'}</p><Link className="boton boton-secundario" to={revision}>{intento.errores.length ? 'Revisar observaciones' : 'Consultar registros'}</Link></section>
      <section className="tarjeta resumen-comprobacion"><div className="resumen-comprobacion-titulo"><span className="resumen-sello"><Documento size={20} /></span><h2>Contraste de la nómina</h2></div><strong className="resumen-conteo">{realizado ? diferencias : '—'}</strong><p>{realizado ? 'diferencias de presencia o sueldo' : contraste?.estado === 'no_comparable' ? 'Conflictos que impiden comparar' : 'No se adjuntó una referencia'}</p>{contraste?.referencia && <p className="texto-pequeno romper">{contraste.referencia.archivo}</p>}<Link className="boton boton-secundario" to={revision}>Consultar contraste</Link></section>
    </div>
    <section className="resumen-siguiente pila" aria-label="Siguiente acción"><div className="resumen-comprobacion-titulo"><Subir size={23} /><h2 className="titulo-tarjeta">Tu siguiente paso</h2></div><p>{!intento.valida ? 'Corrige las observaciones en el archivo original y carga otro intento de esta misma planilla.' : contraste?.estado === 'no_comparable' ? 'Revisa los conflictos de los archivos antes de repetir el contraste.' : !realizado ? 'El formato se revisó, pero no se contrastaron presencia y sueldo. Puedes cargar otro intento con una referencia del mismo período.' : diferencias ? 'Comprueba las diferencias en la nómina de origen. Si requieren corrección, carga otro intento; una diferencia puede tener una explicación válida.' : 'La presencia y los sueldos coinciden con la referencia. Comprueba que la referencia sea la adecuada: la coincidencia no certifica la exactitud de los datos.'}</p><details className="resumen-alcance"><summary>Alcance de este resultado</summary><p>No se verificó el sueldo real ni la exactitud de la referencia. No se calcularon cuotas ni se presentó la planilla ante la CSS. Abrir este resumen no modifica el resultado ni crea una aprobación.</p></details></section>
    <RevisionOperador detalle={detalle} intento={intento} onActualizar={setDetalle} />
    <div className="acciones entre"><Link className="boton boton-secundario" to={revision}>Volver a los resultados</Link><div className="acciones">{actual && sesion.rol === 'ELABORADOR' && <Link className="boton boton-secundario" to={`/cargar?serie=${encodeURIComponent(serieId)}`}>Cargar corrección</Link>}<Link className="boton boton-primario" to={sesion.rol === 'OPERADOR' ? '/bandeja' : '/historial'}>{sesion.rol === 'OPERADOR' ? 'Volver a revisiones recibidas' : 'Ir a mis planillas'}</Link></div></div>
  </div></Marco>;
}
