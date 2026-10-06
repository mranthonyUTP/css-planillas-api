import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import { Descargar, Subir } from '../components/Iconos.jsx';
import { api, modoSimulado } from '../api/client.js';
import { useSesion } from '../state/Sesion.jsx';
import { nombrePeriodo, periodosRecientes } from '../formato.js';
import { COLUMNAS_OBLIGATORIAS, NOMBRES_CAMPO } from '../validacion/reglas.js';

const TAMANO_MAXIMO_MB = 5;

// Pantalla 2 · HU-04 y HU-05
export default function Cargar() {
  const { sesion, guardarValidacion } = useSesion();
  const navegar = useNavigate();
  const periodos = periodosRecientes();
  const [periodo, setPeriodo] = useState(periodos[0]);
  const [tipo, setTipo] = useState('Regular');
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const elegir = (f) => {
    setError('');
    if (!f) return;
    if (f.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo supera ${TAMANO_MAXIMO_MB} MB.`);
      return;
    }
    setArchivo(f);
  };

  const soltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files?.[0]);
  };

  const validar = async () => {
    if (!archivo) {
      setError('Selecciona un archivo para validar.');
      return;
    }
    setError('');
    setCargando(true);
    try {
      const resultado = await api.validar({ archivo, periodo, tipo }, sesion);
      guardarValidacion(resultado);
      navegar(resultado.valida ? '/confirmar' : '/resultado');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Marco>
      <h1 className="titulo">Cargar planilla</h1>
      <p className="subtitulo">Primero revisamos tu archivo. Nada se envía hasta que tú lo confirmes.</p>
      <Pasos actual={1} />

      <div className="dos-columnas">
        <section className="tarjeta columna-principal pila">
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="periodo">Período de la planilla</label>
              <select id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                {periodos.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tipo">Tipo de planilla</label>
              <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option>Regular</option>
                <option>Complementaria</option>
              </select>
            </div>
          </div>

          <label
            htmlFor="archivo"
            className={`zona-carga ${arrastrando ? 'arrastrando' : ''} ${archivo ? 'con-archivo' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
          >
            <Subir />
            {archivo ? (
              <>
                <span className="zona-titulo">{archivo.name}</span>
                <span className="texto-secundario">{(archivo.size / 1024).toFixed(1)} KB · <span className="enlace">Cambiar archivo</span></span>
              </>
            ) : (
              <>
                <span className="zona-titulo">Arrastra tu archivo aquí</span>
                <span className="texto-secundario">o <span className="enlace">selecciónalo desde tu equipo</span></span>
                <span className="texto-pequeno">Formatos: .xlsx o .csv · Máximo {TAMANO_MAXIMO_MB} MB</span>
              </>
            )}
            <input
              id="archivo"
              type="file"
              accept=".xlsx,.csv"
              className="sr"
              onChange={(e) => elegir(e.target.files?.[0])}
            />
          </label>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <Aviso tipo="info">
            Esto es una <strong>pre-validación</strong>: tu planilla no se registra ni se envía. Puedes repetirla las veces que necesites.
          </Aviso>

          <div className="acciones">
            <button type="button" className="boton boton-primario" onClick={validar} disabled={cargando}>
              {cargando ? 'Validando…' : 'Validar planilla'}
            </button>
          </div>
        </section>

        <aside className="columna-lateral pila">
          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Formato requerido</h2>
            <p className="texto-secundario">Usa la plantilla oficial para evitar errores de columnas.</p>
            <a className="enlace-icono" href="/ejemplos/planilla_correcta.csv" download>
              <Descargar /> Descargar plantilla (v1.0)
            </a>
            {modoSimulado && (
              <a className="enlace-icono" href="/ejemplos/planilla_con_errores.csv" download>
                <Descargar /> Ejemplo con errores (demo)
              </a>
            )}
          </section>
          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Columnas obligatorias</h2>
            <ul className="lista">
              {COLUMNAS_OBLIGATORIAS.map((c) => (
                <li key={c}>{NOMBRES_CAMPO[c]} <code>{c}</code></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </Marco>
  );
}
