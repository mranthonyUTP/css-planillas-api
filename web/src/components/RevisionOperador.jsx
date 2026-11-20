import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { revisionDeIntento } from '../../../shared/revision-operador.js';
import { fechaHora } from '../formato.js';
import Aviso from './Aviso.jsx';

export default function RevisionOperador({ detalle, intento, onActualizar }) {
  const { sesion } = useSesion();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const claves = useRef({});
  const revision = revisionDeIntento({ ...detalle, eventos: detalle.revisionesInternas }, intento.id);
  const actual = detalle.ultimoIntentoId === intento.id;
  const operador = sesion.rol === 'OPERADOR';
  const nombres = { SIN_ENVIAR: 'Sin enviar al operador', PENDIENTE: 'Pendiente de autorización del operador', AUTORIZADA: 'Autorizada internamente por el operador', DEVUELTA: 'Devuelta para corregir' };
  const ejecutar = async decision => {
    if (procesando) return;
    if (decision === 'devolver' && !motivo.trim()) { setError('Escribe el motivo de la devolución.'); return; }
    setError(''); setProcesando(true);
    const identidad = JSON.stringify([intento.id, decision, motivo.trim()]);
    claves.current[identidad] ??= crypto.randomUUID();
    try { const datos = await api.revisionInterna({ serieId: detalle.id, intentoId: intento.id, decision, motivo: motivo.trim(), idempotencyKey: claves.current[identidad] }, sesion); onActualizar(datos); setMotivo(''); }
    catch (err) { setError(err.message); }
    finally { setProcesando(false); }
  };
  return <section className="tarjeta pila" aria-label="Revisión del operador"><div><h2 className="titulo-tarjeta">{operador ? 'Decisión del operador' : 'Enviar para autorización'}</h2><p className="texto-secundario">Una sola revisión interna. No presenta ni paga la planilla ante la CSS.</p></div><p><strong>{nombres[revision.estado]}</strong></p>{revision.usuario && <p className="texto-pequeno">{revision.usuario} · {fechaHora(revision.fecha)} · Intento {intento.numero}</p>}{revision.motivo && <Aviso tipo="info" titulo="Motivo de devolución">{revision.motivo}</Aviso>}{error && <Aviso tipo="error">{error}</Aviso>}
    {actual && intento.valida && !operador && ['SIN_ENVIAR', 'DEVUELTA'].includes(revision.estado) && <div className="acciones"><button type="button" className="boton boton-primario" disabled={procesando} onClick={() => ejecutar('enviar')}>{procesando ? 'Enviando…' : 'Enviar para autorización'}</button></div>}
    {actual && operador && revision.estado === 'PENDIENTE' && <><p>Revisa el archivo y las diferencias antes de decidir. Autorizar registra tu decisión sobre este intento; no certifica el cálculo de cuotas.</p><div className="campo"><label htmlFor="motivo-operador">Motivo de devolución</label><textarea id="motivo-operador" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={1000} disabled={procesando} /></div><div className="acciones"><button type="button" className="boton boton-secundario" disabled={procesando} onClick={() => ejecutar('devolver')}>Devolver con motivo</button><button type="button" className="boton boton-primario" disabled={procesando} onClick={() => ejecutar('autorizar')}>Autorizar internamente</button></div></>}
    {!actual && <p className="texto-pequeno">La decisión corresponde a este intento histórico. Las acciones se realizan sobre el intento actual.</p>}
  </section>;
}
