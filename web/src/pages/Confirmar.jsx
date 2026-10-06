import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import { Documento, Persona, Reintentar } from '../components/Iconos.jsx';
import { api } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { balboas, fechaHora, nombrePeriodo } from '../formato.js';

// Pantalla 4 · HU-08 y HU-12
export default function Confirmar() {
  const { sesion, validacion, envio, guardarEnvio } = useSesion();
  const navegar = useNavigate();
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!validacion) return <Navigate to="/cargar" replace />;
  if (!validacion.valida) return <Navigate to="/resultado" replace />;
  if (envio) return <Navigate to="/comprobante" replace />;

  const enviar = async () => {
    setError('');
    setEnviando(true);
    try {
      // La misma clave en cada reintento: si el primer intento llegó, la API devuelve el mismo comprobante.
      const resultado = await api.enviar({ validacionId: validacion.id, idempotencyKey: validacion.idempotencyKey }, sesion);
      guardarEnvio(resultado);
      navegar('/comprobante');
    } catch (err) {
      setError(`${err.message} Puedes reintentar: no se creará una planilla duplicada.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Marco>
      <h1 className="titulo">Confirmar envío oficial</h1>
      <p className="subtitulo">{validacion.archivo} · {validacion.filas} filas · Período: {nombrePeriodo(validacion.periodo)}</p>
      <Pasos actual={3} />

      <Aviso tipo="exito" titulo="Tu planilla pasó la pre-validación">
        No encontramos errores. Revisa el resumen y confirma el envío.
      </Aviso>

      <div className="dos-columnas">
        <section className="tarjeta columna-principal">
          <h2 className="titulo-tarjeta">Resumen de la planilla</h2>
          <dl className="resumen">
            <div><dt>Empresa</dt><dd>{sesion.empresa.nombre}</dd></div>
            <div><dt>Período</dt><dd>{nombrePeriodo(validacion.periodo)} · {validacion.tipo}</dd></div>
            <div><dt>Trabajadores</dt><dd>{validacion.filas}</dd></div>
            <div><dt>Total de salarios</dt><dd>{balboas(validacion.totalSalarios)}</dd></div>
            <div><dt>Archivo</dt><dd className="romper">{validacion.archivo}</dd></div>
            <div><dt>Validada el</dt><dd>{fechaHora(validacion.validadaEn)}</dd></div>
          </dl>

          <hr className="separador" />

          <label className="casilla">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            <span>Confirmo que la información de esta planilla es correcta y autorizo su envío oficial.</span>
          </label>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <div className="acciones entre">
            <Link to="/cargar" className="enlace-accion">Cancelar</Link>
            <button type="button" className="boton boton-primario" disabled={!confirmado || enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : error ? 'Reintentar envío' : 'Enviar planilla oficialmente'}
            </button>
          </div>
        </section>

        <aside className="tarjeta columna-lateral">
          <h2 className="titulo-tarjeta">Antes de enviar</h2>
          <ul className="lista-iconos">
            <li><Reintentar /><span>Si la conexión falla, puedes reintentar. <strong>No se creará una planilla duplicada.</strong></span></li>
            <li><Documento /><span>Recibirás un número de confirmación al terminar.</span></li>
            <li><Persona /><span>El envío queda registrado con tu usuario, la fecha y la hora.</span></li>
          </ul>
        </aside>
      </div>
    </Marco>
  );
}
