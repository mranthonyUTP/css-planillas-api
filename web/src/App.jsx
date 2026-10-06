import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './state/Sesion.jsx';
import Ingresar from './pages/Ingresar.jsx';
import Cargar from './pages/Cargar.jsx';
import Resultado from './pages/Resultado.jsx';
import Confirmar from './pages/Confirmar.jsx';
import Comprobante from './pages/Comprobante.jsx';
import Historial from './pages/Historial.jsx';

// Solo se entra a las pantallas internas con sesión iniciada (HU-07).
function Protegida({ children }) {
  const { sesion } = useSesion();
  return sesion ? children : <Navigate to="/ingresar" replace />;
}

export default function App() {
  const { sesion } = useSesion();
  return (
    <Routes>
      <Route path="/ingresar" element={sesion ? <Navigate to="/cargar" replace /> : <Ingresar />} />
      <Route path="/cargar" element={<Protegida><Cargar /></Protegida>} />
      <Route path="/resultado" element={<Protegida><Resultado /></Protegida>} />
      <Route path="/confirmar" element={<Protegida><Confirmar /></Protegida>} />
      <Route path="/comprobante" element={<Protegida><Comprobante /></Protegida>} />
      <Route path="/historial" element={<Protegida><Historial /></Protegida>} />
      <Route path="*" element={<Navigate to={sesion ? '/cargar' : '/ingresar'} replace />} />
    </Routes>
  );
}
