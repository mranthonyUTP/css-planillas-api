import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Aviso from '../components/Aviso.jsx';
import { api, escucharCambiosPlanillas } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { nombrePeriodo, fechaHora } from '../formato.js';

const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Bandeja() {
  const { sesion } = useSesion();
  const [series, setSeries] = useState(null), [error, setError] = useState(''), [recarga, setRecarga] = useState(0);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => escucharCambiosPlanillas(() => setRecarga(n => n + 1)), []);
  useEffect(() => { let activo = true; setError(''); api.series(sesion).then(s => { if (activo) setSeries(s); }).catch(e => { if (activo) setError(e.message); }); return () => { activo = false; }; }, [sesion, recarga]);
  if (sesion.rol !== 'OPERADOR') return <Navigate to="/historial" replace />;
  const recibidas = (series ?? []).filter(s => s.revisionInterna?.estado && s.revisionInterna.estado !== 'SIN_ENVIAR');
  const estados = { PENDIENTE: 'Pendiente', AUTORIZADA: 'Autorizada internamente', DEVUELTA: 'Devuelta' };
  const etiquetas = { PENDIENTE: 'etiqueta-info', AUTORIZADA: 'etiqueta-exito', DEVUELTA: 'etiqueta-error' };
  const conteos = {
    TODOS: recibidas.length,
    PENDIENTE: recibidas.filter(s => s.revisionInterna.estado === 'PENDIENTE').length,
    AUTORIZADA: recibidas.filter(s => s.revisionInterna.estado === 'AUTORIZADA').length,
    DEVUELTA: recibidas.filter(s => s.revisionInterna.estado === 'DEVUELTA').length,
  };
  const filtradas = recibidas.filter(s => {
    if (filtroEstado !== 'TODOS' && s.revisionInterna.estado !== filtroEstado) return false;
    if (!busqueda.trim()) return true;
    const texto = normalizar(`${nombrePeriodo(s.periodo)} ${s.periodo} ${s.ultimoIntentoResumen?.archivo ?? ''}`);
    return texto.includes(normalizar(busqueda));
  });
  return <Marco><div className="pila">
    <div className="cabecera-pagina"><div><h1 className="titulo">Revisiones recibidas</h1><p className="subtitulo">Consulta la planilla, autoriza internamente o devuelve con motivo.</p></div><button className="boton boton-secundario" onClick={() => setRecarga(n => n + 1)}>Actualizar</button></div>
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="acciones" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
      {[['TODOS', 'Todas'], ['PENDIENTE', 'Pendientes'], ['AUTORIZADA', 'Autorizadas'], ['DEVUELTA', 'Devueltas']].map(([clave, titulo]) => (
        <button key={clave} type="button" className={filtroEstado === clave ? 'boton boton-primario' : 'boton boton-secundario'} onClick={() => setFiltroEstado(clave)}>
          {titulo} ({conteos[clave]})
        </button>
      ))}
    </div>
    <section className="tarjeta sin-relleno">
      <div className="filtros">
        <div className="campo"><label htmlFor="buscar-bandeja">Buscar por período o archivo</label><input id="buscar-bandeja" type="search" placeholder="Ej. Noviembre 2026 o planilla.xlsx" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
      </div>
      <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Planilla</th><th>Intento</th><th>Estado</th><th>Último movimiento</th><th>Acción</th></tr></thead><tbody>{filtradas.map(s => <tr key={s.id}><td><strong>{nombrePeriodo(s.periodo)}</strong><p className="texto-pequeno romper">{s.ultimoIntentoResumen.archivo}</p></td><td className="mono">#{s.ultimoIntentoResumen.numero}</td><td><span className={`etiqueta ${etiquetas[s.revisionInterna.estado] ?? 'etiqueta-info'}`}>{estados[s.revisionInterna.estado]}</span></td><td>{fechaHora(s.revisionInterna.fecha)}</td><td><Link className="boton boton-secundario" to={`/revision/${encodeURIComponent(s.id)}/resumen`}>Revisar planilla</Link></td></tr>)}{!filtradas.length && <tr><td colSpan={5} className="celda-vacia">{series ? 'No hay planillas que coincidan con el filtro seleccionado.' : 'Cargando revisiones…'}</td></tr>}</tbody></table></div>
    </section>
  </div></Marco>;
}
