import Marco from '../components/Marco.jsx';
import { useSesion } from '../state/Sesion.jsx';
import { nombreRol } from '../formato.js';
import { Persona } from '../components/Iconos.jsx';

export default function Perfil() {
  const { sesion, empresaActiva } = useSesion();
  return <Marco><div className="pila"><div><h1 className="titulo">Mi perfil</h1><p className="subtitulo">Usuario, perfil de acceso y empresa vinculada a tu sesión.</p></div><section className="tarjeta pila"><div className="resumen-comprobacion-titulo"><Persona size={28} /><h2 className="titulo-tarjeta">{sesion.usuario}</h2><span className="etiqueta etiqueta-info">{nombreRol(sesion.rol)}</span></div><dl className="perfil-datos"><div><dt>Usuario</dt><dd>{sesion.usuario}</dd></div><div><dt>Perfil de acceso</dt><dd>{nombreRol(sesion.rol)}</dd></div><div><dt>Empresa</dt><dd>{empresaActiva?.nombre ?? sesion.empresa.nombre}</dd></div><div><dt>RUC</dt><dd className="mono">{empresaActiva?.ruc ?? sesion.empresa.ruc}</dd></div></dl><p className="texto-secundario">La empresa y los permisos proceden de tu cuenta. No pueden modificarse desde esta pantalla.</p></section></div></Marco>;
}
