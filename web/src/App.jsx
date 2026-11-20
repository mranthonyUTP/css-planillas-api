import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './state/Sesion.jsx';
import Ingresar from './pages/Ingresar.jsx';
import Cargar from './pages/Cargar.jsx';
import Resultado from './pages/Resultado.jsx';
import Historial from './pages/Historial.jsx';
import DetalleSerie from './pages/DetalleSerie.jsx';
import Resumen from './pages/Resumen.jsx';
import Perfil from './pages/Perfil.jsx';
import Bandeja from './pages/Bandeja.jsx';

function Protegida({ children, soloCarga = false }) {
  const { sesion } = useSesion();
  if (!sesion) return <Navigate to="/ingresar" replace />;
  if (soloCarga && sesion.rol !== 'ELABORADOR') return <Navigate to="/bandeja" replace />;
  return children;
}
export default function App() {
  const { sesion } = useSesion();
  const inicio = sesion ? sesion.rol === 'OPERADOR' ? '/bandeja' : '/cargar' : '/ingresar';
  return <Routes>
    <Route path="/ingresar" element={sesion ? <Navigate to={inicio} replace /> : <Ingresar />} />
    <Route path="/cargar" element={<Protegida soloCarga><Cargar /></Protegida>} />
    <Route path="/revision/:serieId" element={<Protegida><Resultado /></Protegida>} />
    <Route path="/revision/:serieId/resumen" element={<Protegida><Resumen /></Protegida>} />
    <Route path="/resultado" element={<Protegida><Resultado /></Protegida>} />
    <Route path="/historial" element={<Protegida><Historial /></Protegida>} />
    <Route path="/bandeja" element={<Protegida><Bandeja /></Protegida>} />
    <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
    <Route path="/historial/:serieId" element={<Protegida><DetalleSerie /></Protegida>} />
    <Route path="*" element={<Navigate to={inicio} replace />} />
  </Routes>;
}
