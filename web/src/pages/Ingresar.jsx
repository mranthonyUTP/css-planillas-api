import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { Candado } from '../components/Iconos.jsx';
import { api, modoSimulado } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { ACCESOS_DEMO, MOSTRAR_DEMO } from '../demo.js';

export default function Ingresar() {
  const { iniciar } = useSesion();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ ruc: '', usuario: '', clave: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarClave, setMostrarClave] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const sesion = await api.ingresar(datos);
      iniciar(sesion);
      navegar(sesion.rol === 'OPERADOR' ? '/bandeja' : '/cargar');
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
          <p className="ingreso-antetitulo">Cada dato cuenta</p>
          <h1 className="titulo-grande">Una planilla clara.<br />Corrige desde el origen.</h1>
          <p className="lead">Revisa el formato, contrasta los sueldos con tu referencia y conserva cada intento.</p>
          <ol className="lista-pasos">
            <li><span>1</span><div><strong>Prepara y corrige</strong><p>El empleador carga el archivo y revisa los datos de cada trabajador.</p></div></li>
            <li><span>2</span><div><strong>Contrasta con tu referencia</strong><p>Identifica diferencias de presencia y sueldo que debes revisar en tu nómina.</p></div></li>
            <li><span>3</span><div><strong>Corrige y vuelve a comprobar</strong><p>Envía otro intento de la misma planilla sin perder los anteriores.</p></div></li>
          </ol>
        </section>

        <section className="tarjeta ingreso-formulario" aria-labelledby="titulo-ingreso">
          <span className="ingreso-simbolo" aria-hidden="true"><Candado /></span>
          <h2 id="titulo-ingreso">Bienvenido de nuevo</h2>
          <p className="texto-secundario">Ingresa para continuar con tus planillas.</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          {MOSTRAR_DEMO && (
            <div className="accesos-prueba"><span>Accesos de prueba</span><div>{ACCESOS_DEMO.map((acceso) => <button key={acceso.credenciales.usuario} type="button" disabled={cargando} onClick={() => setDatos(acceso.credenciales)}>{acceso.etiqueta.replace('Entrar como ', '').replace(/^./, (letra) => letra.toUpperCase())}</button>)}</div></div>
          )}
          <form onSubmit={enviar} className="formulario">
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
              <div className="ingreso-clave"><input id="clave" name="clave" type={mostrarClave ? 'text' : 'password'} value={datos.clave} onChange={cambiar} autoComplete="current-password" disabled={cargando} required /><button type="button" aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarClave} disabled={cargando} onClick={() => setMostrarClave((v) => !v)}>{mostrarClave ? 'Ocultar' : 'Mostrar'}</button></div>
            </div>
            <button type="submit" className="boton boton-primario boton-bloque" disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar al portal →'}
            </button>
          </form>
          <div className="nota-segura">
            <Candado />
            <span>Tus planillas están vinculadas a la empresa de tu cuenta.</span>
          </div>
          {modoSimulado && (
            <p className="texto-pequeno">Demostración con datos del navegador. Usa las cuentas de prueba; no comunica con la CSS ni representa un acceso productivo.</p>
          )}
        </section>
      </div>
    </Marco>
  );
}
