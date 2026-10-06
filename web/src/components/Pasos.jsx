import { Check } from './Iconos.jsx';

const PASOS = ['Cargar archivo', 'Revisar resultado', 'Envío oficial'];

// actual: 1, 2 o 3. Los pasos anteriores se muestran como completados.
export default function Pasos({ actual }) {
  return (
    <ol className="pasos" aria-label="Pasos">
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
