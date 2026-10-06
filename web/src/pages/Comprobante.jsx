import { Link, Navigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import { Check, Descargar } from '../components/Iconos.jsx';
import { useSesion } from '../state/Sesion.jsx';
import { fechaHora, nombrePeriodo } from '../formato.js';

// Pantalla 5 · HU-12
export default function Comprobante() {
  const { sesion, envio } = useSesion();
  if (!envio) return <Navigate to="/cargar" replace />;
  const { validacion } = envio;

  return (
    <Marco ancho="angosto">
      <section className="tarjeta comprobante">
        <div className="comprobante-icono"><Check size={34} strokeWidth={2.4} /></div>
        <h1 className="titulo comprobante-titulo">Planilla enviada correctamente</h1>
        <p className="subtitulo">Guarda este comprobante. Lo puedes consultar luego en tu historial.</p>

        <div className="comprobante-numero">
          <div className="texto-secundario">Número de confirmación</div>
          <div className="mono numero">{envio.confirmacion}</div>
        </div>

        <dl className="resumen">
          <div><dt>Empresa</dt><dd>{sesion.empresa.nombre}</dd></div>
          <div><dt>Período</dt><dd>{nombrePeriodo(validacion.periodo)} · {validacion.tipo}</dd></div>
          <div><dt>Fecha y hora de envío</dt><dd>{fechaHora(envio.enviadoEn)}</dd></div>
          <div><dt>Enviado por</dt><dd>{envio.enviadoPor}</dd></div>
          <div><dt>Trabajadores</dt><dd>{validacion.filas}</dd></div>
          <div><dt>Archivo</dt><dd className="romper">{validacion.archivo}</dd></div>
        </dl>

        <div className="acciones centro no-imprimir">
          <button type="button" className="boton boton-primario" onClick={() => window.print()}>
            <Descargar /> Descargar comprobante (PDF)
          </button>
          <Link to="/historial" className="boton boton-secundario">Ir al historial</Link>
        </div>
      </section>
    </Marco>
  );
}
