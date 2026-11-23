import { balboas } from '../formato.js';
import { Descargar } from './Iconos.jsx';

const etiquetas = { SUELDO_DISTINTO: 'Sueldo distinto', SOLO_REFERENCIA: 'Solo en la referencia', SOLO_PLANILLA: 'Solo en la planilla' };

function descargarDiferenciasCsv(c) {
  const columnas = ['codigo', 'tipo_diferencia', 'documento', 'nombre', 'sueldo_referencia', 'sueldo_planilla'];
  const escapar = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const filas = (c?.diferencias ?? []).map((d) => {
    const t = d.planilla ?? d.referencia ?? {};
    return [d.codigo, etiquetas[d.codigo] ?? d.codigo, t.documento ?? '', t.nombre ?? '', d.referencia ? d.referencia.sueldo : '', d.planilla ? d.planilla.sueldo : '']
      .map(escapar).join(',');
  });
  const contenido = ['sep=,', columnas.join(','), ...filas].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'diferencias_contraste_nomina.csv';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Contraste({ contraste: c }) {
  const realizado = c?.estado === 'realizado';
  const diferencias = c?.diferencias ?? [];
  return <section className="tarjeta pila contraste-panel" aria-label="Contraste con la nómina de referencia">
    <div className="cabecera-pagina"><div><h2 className="titulo-tarjeta">Contraste con la referencia</h2><p className="texto-secundario">{c?.referencia?.archivo ?? 'Sin archivo de referencia para este intento'}</p></div>{realizado && <div className="acciones" style={{ marginTop: 0 }}><span className="etiqueta">{diferencias.length} diferencias para revisar</span>{diferencias.length > 0 && <button type="button" className="boton boton-secundario" onClick={() => descargarDiferenciasCsv(c)}><Descargar /> Descargar diferencias CSV</button>}</div>}</div>
    {!c || c.estado === 'no_realizado' ? <p>No se realizó el contraste. La revisión de formato no confirma que los sueldos correspondan a la nómina de la empresa.</p> : !realizado ? <div role="status"><strong>No se pudo realizar el contraste.</strong><p>Corrige los conflictos antes de comparar; no se han determinado coincidencias ni diferencias.</p><ul>{c.conflictos.map((v, i) => <li key={i}>{v.lado === 'referencia' ? 'Referencia' : 'Planilla'}{v.fila ? ` · fila ${v.fila}` : ''}: {v.motivo}</li>)}</ul></div> : <>
      <p>{diferencias.length ? 'Estas diferencias pueden tener una explicación válida. Compruébalas en el sistema de nómina antes de corregir el archivo.' : 'La presencia de trabajadores y sus sueldos coinciden con la referencia. Esto no demuestra que los datos sean correctos.'}</p>
      {diferencias.length > 0 && <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Diferencias de presencia y sueldo"><table className="tabla"><caption className="sr">Comparación del sueldo y presencia por documento</caption><thead><tr><th scope="col">Trabajador</th><th scope="col">En la referencia</th><th scope="col">En la planilla</th><th scope="col">Para revisar</th></tr></thead><tbody>{diferencias.map((d) => { const t = d.planilla ?? d.referencia; return <tr key={`${d.codigo}-${t.clave}`}><td><strong>{t.nombre || '(Sin nombre)'}</strong><div className="texto-pequeno">{t.documento}</div></td><td className="mono sin-salto">{d.referencia ? balboas(d.referencia.sueldo) : 'No figura'}</td><td className="mono sin-salto">{d.planilla ? balboas(d.planilla.sueldo) : 'No figura'}</td><td>{etiquetas[d.codigo]}</td></tr>; })}</tbody></table></div>}
      {c.sinDiferencias.length > 0 && <details><summary>Ver {c.sinDiferencias.length} {c.sinDiferencias.length === 1 ? 'trabajador sin diferencias de sueldo' : 'trabajadores sin diferencias de sueldo'}</summary><ul>{c.sinDiferencias.map(t => <li key={t.clave}>{t.nombre} · {t.documento} · <span className="mono">{balboas(t.sueldo)}</span></li>)}</ul></details>}
    </>}
    <details className="contraste-limites"><summary>Qué se comprobó y qué queda sin verificar</summary><p>{realizado ? 'Se relacionó a los trabajadores por tipo y número de documento, se comprobó su presencia en ambos archivos y solo se comparó el sueldo.' : 'No se completó la comparación de presencia y sueldo con una referencia en este intento.'}</p><p>No se comprobaron los nombres ni los demás rubros mediante este contraste. No se consultó la identidad oficial ni se verificó la exactitud de la referencia. El período del contenido debe comprobarlo quien aporta los archivos.</p><p>Coincidir con la referencia no demuestra que el dato sea correcto. Este resultado no sustituye la presentación oficial ante la CSS.</p></details>
  </section>;
}
