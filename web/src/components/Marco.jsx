import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../state/Sesion.jsx';
import { modoSimulado } from '../api/client.js';
import { Escudo } from './Iconos.jsx';

// Encabezado institucional, navegación y pie. "conNavegacion" se apaga en el inicio de sesión.
export default function Marco({ children, conNavegacion = true, ancho = 'normal' }) {
  const { sesion, cerrar } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const enFlujo = ['/resultado', '/confirmar', '/comprobante'].some((r) => pathname.startsWith(r));

  const salir = () => {
    cerrar();
    navegar('/ingresar');
  };

  return (
    <div className="marco">
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <header className="encabezado">
        <div className="franja">
          Prototipo académico · No es un sitio oficial del Estado
          {modoSimulado && <span className="franja-modo"> · Modo de demostración</span>}
        </div>
        <div className={`encabezado-cuerpo ${conNavegacion ? '' : 'con-acento'}`}>
          <div className="contenedor encabezado-fila">
            <div className="marca">
              <Escudo />
              <div>
                <div className="marca-nombre">Portal de Planillas</div>
                <div className="marca-lema">Validación y envío de planillas de seguridad social</div>
              </div>
            </div>
            {sesion && (
              <div className="cuenta">
                <div className="cuenta-datos">
                  <div className="cuenta-empresa">{sesion.empresa.nombre}</div>
                  <div className="cuenta-detalle">RUC {sesion.empresa.ruc} · {sesion.usuario}</div>
                </div>
                <button type="button" className="enlace-claro" onClick={salir}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
        {conNavegacion && (
          <nav className="navegacion" aria-label="Principal">
            <div className="contenedor navegacion-fila">
              <NavLink to="/cargar" className={({ isActive }) => `nav-item ${isActive || enFlujo ? 'activo' : ''}`}>
                Cargar planilla
              </NavLink>
              <NavLink to="/historial" className={({ isActive }) => `nav-item ${isActive ? 'activo' : ''}`}>
                Historial de cargas
              </NavLink>
            </div>
          </nav>
        )}
      </header>

      <main id="contenido" className={`contenedor principal ${ancho === 'angosto' ? 'angosto' : ''}`}>
        {children}
      </main>

      <footer className="pie">
        <div className="contenedor pie-fila">
          <span>Portal de Planillas · Prototipo académico</span>
          <span>Proyecto css-planillas-api</span>
        </div>
      </footer>
    </div>
  );
}
