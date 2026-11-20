import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../state/Sesion.jsx';
import { Escudo } from './Iconos.jsx';
import { nombreRol } from '../formato.js';
import { modoSimulado } from '../api/client.js';

export default function Marco({ children, conNavegacion = true, ancho = 'normal' }) {
  const { sesion, empresaActiva, seleccionarEmpresa, cerrar } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const enRevision = ['/revision', '/resultado'].some((r) => pathname.startsWith(r));
  const nombreHistorial = 'Mis planillas';
  const salir = () => { cerrar(); navegar('/ingresar'); };
  const cambiarEmpresa = (ruc) => {
    seleccionarEmpresa(ruc);
    navegar(pathname.startsWith('/historial') ? '/historial' : '/cargar');
  };

  return <div className="marco">
    <a className="saltar" href="#contenido">Saltar al contenido</a>
    <header className="encabezado">
      <div className={`encabezado-cuerpo ${conNavegacion ? '' : 'con-acento'}`}>
        <div className="contenedor encabezado-fila">
          <div className="marca"><Escudo /><div><div className="marca-nombre">Portal de Planillas</div><div className="marca-lema">Prevalidación y contraste de planillas</div></div></div>
          {sesion && <div className="cuenta"><div className="cuenta-datos"><div className="cuenta-empresa">{empresaActiva?.nombre ?? sesion.empresa?.nombre}</div><NavLink className="cuenta-detalle cuenta-perfil" to="/perfil">{sesion.usuario} · {nombreRol(sesion.rol)}</NavLink></div><button type="button" className="enlace-claro" onClick={salir}>Cerrar sesión</button></div>}
        </div>
      </div>
      {conNavegacion && sesion && <nav className="navegacion" aria-label="Principal">
        <div className="contenedor navegacion-fila">
          <NavLink to={sesion.rol === 'OPERADOR' ? '/bandeja' : '/cargar'} className={({ isActive }) => `nav-item ${isActive || enRevision ? 'activo' : ''}`}>{sesion.rol === 'OPERADOR' ? 'Revisiones recibidas' : 'Cargar planilla'}</NavLink>
          <NavLink to="/historial" className={({ isActive }) => `nav-item ${isActive ? 'activo' : ''}`}>{nombreHistorial}</NavLink>
          <NavLink to="/perfil" className={({ isActive }) => `nav-item ${isActive ? 'activo' : ''}`}>Mi perfil</NavLink>
          {sesion.empresas?.length > 1 && <div className="empresa-selector"><label htmlFor="empresa-activa">Empresa activa</label><select id="empresa-activa" value={empresaActiva?.ruc ?? ''} onChange={(e) => cambiarEmpresa(e.target.value)}>{sesion.empresas.map((e) => <option key={e.ruc} value={e.ruc}>{e.nombre}</option>)}</select></div>}
        </div>
      </nav>}
    </header>
    <main id="contenido" className={`contenedor principal ${ancho === 'angosto' ? 'angosto' : ''}`}>{children}</main>
    <footer className="pie"><div className="contenedor pie-fila"><span>Portal de Planillas · Gestión interna</span><span>{modoSimulado ? 'Demostración · Datos de ejemplo' : 'Prevalidación · Sin presentación ante la CSS'}</span></div></footer>
  </div>;
}
