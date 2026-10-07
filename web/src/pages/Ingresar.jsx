import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { Candado } from '../components/Iconos.jsx';
import { api, modoSimulado } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { CREDENCIALES_DEMO, MOSTRAR_DEMO } from '../demo.js';

// Pantalla 1 · HU-07
export default function Ingresar() {
  const { iniciar } = useSesion();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ ruc: '', usuario: '', clave: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      iniciar(await api.ingresar(datos));
      navegar('/cargar');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Marco conNavegacion={false}>
      <div className="ingreso">
        <section className="ingreso-intro">
          <h1 className="titulo-grande">Presenta tu planilla sin errores</h1>
          <p className="lead">Revisa tu planilla antes de enviarla. Si algo está mal, te decimos en qué fila y cómo corregirlo.</p>
          <ol className="lista-pasos">
            <li><span>1</span><div><strong>Carga tu archivo</strong><p>Excel o CSV con el formato oficial.</p></div></li>
            <li><span>2</span><div><strong>Revisa el resultado</strong><p>La pre-validación no envía nada. Solo revisa.</p></div></li>
            <li><span>3</span><div><strong>Envía y guarda tu comprobante</strong><p>Recibes un número de confirmación al instante.</p></div></li>
          </ol>
        </section>

        <section className="tarjeta ingreso-formulario" aria-labelledby="titulo-ingreso">
          <h2 id="titulo-ingreso">Iniciar sesión</h2>
          <p className="texto-secundario">Usa las credenciales de tu empresa.</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          {MOSTRAR_DEMO && (
            <div className="demo-barra">
              <span>Datos de prueba</span>
              <button type="button" className="boton boton-secundario" onClick={() => setDatos(CREDENCIALES_DEMO)}>
                Rellenar datos
              </button>
            </div>
          )}
          <form onSubmit={enviar} className="formulario" noValidate>
            <div className="campo">
              <label htmlFor="ruc">RUC de la empresa</label>
              <input id="ruc" name="ruc" value={datos.ruc} onChange={cambiar} placeholder="Ej. 155123456-2-2020" autoComplete="organization" required />
            </div>
            <div className="campo">
              <label htmlFor="usuario">Usuario</label>
              <input id="usuario" name="usuario" value={datos.usuario} onChange={cambiar} autoComplete="username" required />
            </div>
            <div className="campo">
              <label htmlFor="clave">Contraseña</label>
              <input id="clave" name="clave" type="password" value={datos.clave} onChange={cambiar} autoComplete="current-password" required />
            </div>
            <button type="submit" className="boton boton-primario boton-bloque" disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          <div className="nota-segura">
            <Candado />
            <span>Acceso seguro con OAuth 2.0. Solo verás las planillas de tu empresa.</span>
          </div>
          {modoSimulado && (
            <p className="texto-pequeno">Modo de demostración: cualquier RUC, usuario y contraseña sirven.</p>
          )}
        </section>
      </div>
    </Marco>
  );
}
