import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { nombrePeriodo, fechaHora } from '../formato.js';

export default function Bandeja() {
  const { sesion } = useSesion();
  const [series, setSeries] = useState(null), [error, setError] = useState(''), [recarga, setRecarga] = useState(0);
  useEffect(() => escucharCambiosPlanillas(() => setRecarga(n => n + 1)), []);
  useEffect(() => { let activo = true; setError(''); api.series(sesion).then(s => { if (activo) setSeries(s); }).catch(e => { if (activo) setError(e.message); }); return () => { activo = false; }; }, [sesion, recarga]);
  if (sesion.rol !== 'OPERADOR') return <Navigate to="/historial" replace />;
  const recibidas = (series ?? []).filter(s => s.revisionInterna?.estado && s.revisionInterna.estado !== 'SIN_ENVIAR');
  const estados = { PENDIENTE: 'Pendiente', AUTORIZADA: 'Autorizada internamente', DEVUELTA: 'Devuelta' };
  return <Marco><div className="pila"><div className="cabecera-pagina"><div><h1 className="titulo">Revisiones recibidas</h1><p className="subtitulo">Consulta la planilla, autoriza internamente o devuelve con motivo.</p></div><button className="boton boton-secundario" onClick={() => setRecarga(n => n + 1)}>Actualizar</button></div>{error && <Aviso tipo="error">{error}</Aviso>}<section className="tarjeta"><div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Planilla</th><th>Intento</th><th>Estado</th><th>Último movimiento</th><th>Acción</th></tr></thead><tbody>{recibidas.map(s => <tr key={s.id}><td><strong>{nombrePeriodo(s.periodo)}</strong><p className="texto-pequeno romper">{s.ultimoIntentoResumen.archivo}</p></td><td>{s.ultimoIntentoResumen.numero}</td><td>{estados[s.revisionInterna.estado]}</td><td>{fechaHora(s.revisionInterna.fecha)}</td><td><Link className="boton boton-secundario" to={`/revision/${encodeURIComponent(s.id)}/resumen`}>Revisar planilla</Link></td></tr>)}{!recibidas.length && <tr><td colSpan={5}>{series ? 'No hay planillas recibidas para esta empresa.' : 'Cargando revisiones…'}</td></tr>}</tbody></table></div></section></div></Marco>;
}
