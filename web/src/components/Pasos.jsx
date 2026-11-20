import { Check } from './Iconos.jsx';

const PASOS = ['Cargar archivos', 'Revisar formato y contraste', 'Resumen de la revisión'];

// Los pasos indican navegación; completarlos no certifica los datos.
export default function Pasos({ actual }) {
  return (
    <ol className="pasos" aria-label="Etapas de prevalidación">
      {PASOS.map((nombre, i) => {
        const numero = i + 1;
        const estado = numero < actual ? 'hecho' : numero === actual ? 'actual' : 'pendiente';
        return (
          <li key={nombre} className={`paso ${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="paso-marca">{estado === 'hecho' ? <Check /> : numero}</span>
            {nombre}
            {estado === 'hecho' && <span className="sr">(completado)</span>}
          </li>
        );
      })}
    </ol>
  );
}
