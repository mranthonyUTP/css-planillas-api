import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import { Documento, Check, Alerta, Info, Subir, Descargar } from '../components/Iconos.jsx';
import Aviso from '../components/Aviso.jsx';
import RevisionOperador from '../components/RevisionOperador.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, nombrePeriodo, fechaHora, nombreEstado } from '../formato.js';
import { estadoIntento } from '../../../shared/estado.js';
import { calcularCuotasPlanilla } from '../../../shared/planillas.js';

function imprimirComprobante(detalle, intento, cuotas, contraste) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rev = detalle.revisionInterna;
  const estadoRev = rev?.estado === 'AUTORIZADA' ? 'Autorizada internamente'
    : rev?.estado === 'DEVUELTA' ? 'Devuelta para corrección'
    : rev?.estado === 'PENDIENTE' ? 'Enviada a revisión interna' : 'Sin enviar a revisión';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de Prevalidación - ${esc(detalle.empresaNombre)}</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;color:#1b2430;margin:32px;line-height:1.5}
  .cab{border-bottom:4px solid #f2b632;background:#0b2e59;color:#fff;padding:18px 24px;border-radius:6px}
  .cab h1{margin:0;font-size:20px}.cab p{margin:4px 0 0;font-size:13px;color:#c9d4e3}
  h2{font-size:15px;color:#0b2e59;margin:22px 0 8px;border-bottom:1px solid #d5dbe3;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px;border-bottom:1px solid #e6eaf0;text-align:left}
  .num{text-align:right;font-family:monospace}.tot{font-weight:700;background:#f4f6f9}
  .nota{margin-top:24px;font-size:12px;color:#4a5565;background:#eef3fa;padding:12px;border-radius:6px}
  </style></head><body>
  <div class="cab"><h1>Comprobante de Prevalidación y Liquidación Referencial CSS</h1><p>Portal de Gestión Interna de Planillas · República de Panamá</p></div>
  <h2>Datos de la planilla</h2>
  <table><tr><th>Empresa</th><td>${esc(detalle.empresaNombre)} (RUC: ${esc(detalle.empresaRuc)})</td></tr>
  <tr><th>Período y tipo</th><td>${esc(nombrePeriodo(intento.periodo))} · ${esc(intento.tipo)}</td></tr>
  <tr><th>Archivo / Intento</th><td>${esc(intento.archivo)} · Intento #${intento.numero}</td></tr>
  <tr><th>Fecha de validación</th><td>${esc(fechaHora(intento.validadaEn))} · Usuario: ${esc(intento.usuario)}</td></tr>
  <tr><th>Registros válidos</th><td>${intento.filas} trabajadores · 0 observaciones de formato</td></tr>
  <tr><th>Contraste de nómina</th><td>${contraste?.estado === 'realizado' ? `Realizado (${contraste.diferencias.length} diferencias)` : 'Sin referencia adjunta'}</td></tr>
  <tr><th>Estado de aprobación</th><td>${esc(estadoRev)}${rev?.usuario ? ` (${esc(rev.usuario)})` : ''}</td></tr></table>
  <h2>Liquidación referencial de cuotas CSS (Ley 462) y salarios netos</h2>
  <table><tr><th>Concepto</th><th class="num">Monto (B/.)</th></tr>
  <tr><td>Base cotizable declarada</td><td class="num">${esc(balboas(cuotas.baseCotizable))}</td></tr>
  <tr><td>Seguro Social Empleado (9.75 %)</td><td class="num">-${esc(balboas(cuotas.ssEmpleado))}</td></tr>
  <tr><td>Seguro Educativo Empleado (1.25 %)</td><td class="num">-${esc(balboas(cuotas.seEmpleado))}</td></tr>
  <tr><td>Impuesto Sobre la Renta (ISR declarado)</td><td class="num">-${esc(balboas(cuotas.isrDeclarado))}</td></tr>
  <tr class="tot"><td>Total salarios netos estimados a pagar</td><td class="num">${esc(balboas(cuotas.salarioNetoEstimado))}</td></tr>
  <tr><td>Seguro Social Patronal (${esc((cuotas.tasas.ssPatronal * 100).toFixed(2))} % · ${esc(cuotas.tasas.tramoLey462)})</td><td class="num">${esc(balboas(cuotas.ssPatronal))}</td></tr>
  <tr><td>Seguro Educativo Patronal (1.50 %)</td><td class="num">${esc(balboas(cuotas.sePatronal))}</td></tr>
  <tr><td>Riesgos Profesionales (1.50 % referencial)</td><td class="num">${esc(balboas(cuotas.riesgosProfesionales))}</td></tr>
  <tr class="tot"><td>Total estimado a remitir a la CSS (Empleado + Patronal)</td><td class="num">${esc(balboas(cuotas.totalCss))}</td></tr></table>
  <p class="nota">Documento referencial de control interno generado el ${esc(fechaHora(new Date().toISOString()))}. No sustituye la presentación ni el pago oficial ante la Caja de Seguro Social (CSS).</p>
  <script>window.onload=()=>window.print();</script></body></html>`;
  const ventana = window.open('', '_blank', 'noopener,noreferrer,width=820,height=760');
  if (ventana) { ventana.document.write(html); ventana.document.close(); }
}

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
  const cuotas = calcularCuotasPlanilla(intento.trabajadores ?? [], { periodo: intento.periodo });
  const pctPatronal = (cuotas.tasas.ssPatronal * 100).toFixed(2);
  const revision = `/revision/${encodeURIComponent(serieId)}?intento=${encodeURIComponent(intento.id)}`;
  if (!intento.valida) return <Navigate to={revision} replace />;
  return <Marco><div className="pila resumen-final">
    <div><h1 className="titulo">Resumen de la revisión</h1><p className="subtitulo">Consulta el resultado guardado, la liquidación referencial CSS y el estado de aprobación.</p></div>
    <Pasos actual={3} />
    {!actual && <Aviso tipo="info">Este resumen corresponde a un intento anterior. Hay un intento más reciente en esta planilla. <Link className="enlace-accion" to={`/revision/${encodeURIComponent(serieId)}`}>Ver intento actual</Link></Aviso>}
    <section className={`resumen-hero ${!intento.valida || contraste?.estado === 'no_comparable' ? 'resumen-hero-alerta' : ''}`} aria-label="Resultado del intento">
      <div className="resumen-hero-superior"><span className="resumen-antetitulo">RESULTADO DEL INTENTO {intento.numero}</span><span className="resumen-version">{actual ? 'Versión actual' : 'Versión anterior'}</span></div>
      <div className="resumen-hero-titulo"><span className="resumen-estado-icono">{!intento.valida || diferencias || contraste?.estado === 'no_comparable' ? <Alerta size={30} /> : <Info size={30} />}</span><h2>{nombreEstado(estadoIntento(intento))}</h2></div>
      <p className="resumen-hero-descripcion">{!intento.valida ? 'El archivo tiene observaciones que debes corregir.' : realizado && diferencias ? 'El formato pasó la revisión. Hay datos que requieren tu atención al contrastarlos con la referencia.' : realizado ? 'Los trabajadores y sus sueldos coinciden con la referencia aportada.' : 'La revisión del formato y el cálculo referencial de cuotas están guardados.'}</p>
      <div className="resumen-metricas"><div><span>Registros del archivo</span><strong className="mono">{intento.filas}</strong></div><div><span>{intento.totalSalariosParcial ? 'Sueldos · suma parcial' : 'Sueldos declarados'}</span><strong className="mono">{intento.estructuraValida === false ? 'Sin evaluar' : balboas(intento.totalSalarios)}</strong></div><div><span>Total estimado CSS</span><strong className="mono">{balboas(cuotas.totalCss)}</strong></div></div>
    </section>
    <section className="resumen-archivo" aria-label="Archivo revisado"><span className="resumen-documento"><Documento size={26} /></span><div><h2>{intento.archivo}</h2><p>{detalle.empresaNombre} · {nombrePeriodo(intento.periodo)} · {intento.tipo}</p><p className="texto-pequeno">Guardado el {fechaHora(intento.validadaEn)} · {intento.usuario}</p></div></section>
    {cuotas.trabajadoresCalculados > 0 && (
      <section className="tarjeta pila" aria-labelledby="titulo-cuotas-css">
        <div className="cabecera-pagina" style={{ marginBottom: 0 }}>
          <div><h2 id="titulo-cuotas-css" className="titulo-tarjeta">Liquidación referencial CSS (Ley 462) y salarios netos</h2><p className="texto-pequeno">Calculado sobre {cuotas.trabajadoresCalculados} trabajadores · Base cotizable: <strong className="mono">{balboas(cuotas.baseCotizable)}</strong> · Tasa patronal: {cuotas.tasas.tramoLey462}</p></div>
          <span className="etiqueta etiqueta-info">Total CSS estimado: {balboas(cuotas.totalCss)}</span>
        </div>
        <dl className="resumen">
          <div><dt>SS Empleado (9.75 %)</dt><dd className="mono">-{balboas(cuotas.ssEmpleado)}</dd></div>
          <div><dt>SS Patronal ({pctPatronal} %)</dt><dd className="mono">{balboas(cuotas.ssPatronal)}</dd></div>
          <div><dt>Seguro Educativo (1.25 % emp. + 1.50 % pat.)</dt><dd className="mono">{balboas(cuotas.seEmpleado)} / {balboas(cuotas.sePatronal)}</dd></div>
          <div><dt>Riesgos Profesionales (1.50 % ref.)</dt><dd className="mono">{balboas(cuotas.riesgosProfesionales)}</dd></div>
          <div><dt>ISR declarado en archivo</dt><dd className="mono">-{balboas(cuotas.isrDeclarado)}</dd></div>
          <div><dt>Total salarios netos estimados</dt><dd className="mono">{balboas(cuotas.salarioNetoEstimado)}</dd></div>
        </dl>
      </section>
    )}
    <div className="resumen-comprobaciones">
      <section className="tarjeta resumen-comprobacion"><div className="resumen-comprobacion-titulo"><span className={`resumen-sello ${intento.valida ? 'resumen-sello-correcto' : ''}`}>{intento.valida ? <Check size={20} /> : <Alerta size={20} />}</span><h2>Formato del archivo</h2></div><strong className="resumen-conteo">{intento.errores.length}</strong><p>{intento.errores.length ? 'observaciones pendientes' : 'observaciones de formato'}</p><Link className="boton boton-secundario" to={revision}>{intento.errores.length ? 'Revisar observaciones' : 'Consultar registros'}</Link></section>
      <section className="tarjeta resumen-comprobacion"><div className="resumen-comprobacion-titulo"><span className="resumen-sello"><Documento size={20} /></span><h2>Contraste de la nómina</h2></div><strong className="resumen-conteo">{realizado ? diferencias : '—'}</strong><p>{realizado ? 'diferencias de presencia o sueldo' : contraste?.estado === 'no_comparable' ? 'Conflictos que impiden comparar' : 'No se adjuntó una referencia'}</p>{contraste?.referencia && <p className="texto-pequeno romper">{contraste.referencia.archivo}</p>}<Link className="boton boton-secundario" to={revision}>Consultar contraste</Link></section>
    </div>
    <section className="resumen-siguiente pila" aria-label="Siguiente acción"><div className="resumen-comprobacion-titulo"><Subir size={23} /><h2 className="titulo-tarjeta">Tu siguiente paso</h2></div><p>{!intento.valida ? 'Corrige las observaciones en el archivo original y carga otro intento de esta misma planilla.' : contraste?.estado === 'no_comparable' ? 'Revisa los conflictos de los archivos antes de repetir el contraste.' : !realizado ? 'El formato se revisó y se estimaron las cuotas referenciales, pero no se contrastaron presencia y sueldo. Puedes cargar otro intento con una referencia del mismo período.' : diferencias ? 'Comprueba las diferencias en la nómina de origen. Si requieren corrección, carga otro intento; una diferencia puede tener una explicación válida.' : 'La presencia y los sueldos coinciden con la referencia. Comprueba que la referencia sea la adecuada: la coincidencia no certifica la exactitud de los datos.'}</p><details className="resumen-alcance"><summary>Alcance de este resultado</summary><p>Las cuotas mostradas son una estimación referencial según las tasas vigentes (Ley 462) con fines de control previo. Este portal no sustituye la factura oficial ni presenta la planilla ante la Caja de Seguro Social (CSS).</p></details></section>
    <RevisionOperador detalle={detalle} intento={intento} onActualizar={setDetalle} />
    <div className="acciones entre">
      <div className="acciones" style={{ marginTop: 0 }}>
        <Link className="boton boton-secundario" to={revision}>Volver a los resultados</Link>
        <button type="button" className="boton boton-secundario" onClick={() => imprimirComprobante(detalle, intento, cuotas, contraste)}><Descargar /> Descargar comprobante</button>
      </div>
      <div className="acciones" style={{ marginTop: 0 }}>
        {actual && sesion.rol === 'ELABORADOR' && <Link className="boton boton-secundario" to={`/cargar?serie=${encodeURIComponent(serieId)}`}>Cargar corrección</Link>}
        <Link className="boton boton-primario" to={sesion.rol === 'OPERADOR' ? '/bandeja' : '/historial'}>{sesion.rol === 'OPERADOR' ? 'Volver a revisiones recibidas' : 'Ir a mis planillas'}</Link>
      </div>
    </div>
  </div></Marco>;
}
