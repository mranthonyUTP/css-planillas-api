import { Alerta, Exito, Info } from './Iconos.jsx';

const ICONOS = { error: Alerta, exito: Exito, info: Info };

// tipo: "error" | "exito" | "info"
export default function Aviso({ tipo = 'info', titulo, children }) {
  const Icono = ICONOS[tipo];
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono size={titulo ? 26 : 20} />
      <div>
        {titulo && <div className="aviso-titulo">{titulo}</div>}
        {children && <div className="aviso-texto">{children}</div>}
      </div>
    </div>
  );
}
