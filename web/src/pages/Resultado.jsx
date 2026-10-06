import { Link, Navigate } from 'react-router-dom';
import Marco from '../components/Marco.jsx';
import Pasos from '../components/Pasos.jsx';
import Aviso from '../components/Aviso.jsx';
import { Descargar } from '../components/Iconos.jsx';
import { useSesion } from '../state/Sesion.jsx';
import { nombrePeriodo } from '../formato.js';

// Pantalla 3 · HU-06
export default function Resultado() {
  const { validacion } = useSesion();
  if (!validacion) return <Navigate to="/cargar" replace />;
  if (validacion.valida) return <Navigate to="/confirmar" replace />;

  const { errores, filas, filasConError, archivo, periodo } = validacion;
  const correctas = Math.max(filas - filasConError, 0);

  const descargarReporte = () => {
    const columnas = ['fila', 'campo', 'valor', 'problema', 'solucion'];
    // Neutraliza fórmulas al abrir el CSV en Excel (inyección de fórmulas) y escapa comillas.
    const escapar = (v) => {
      const texto = /^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : String(v);
      return `"${texto.replaceAll('"', '""')}"`;
    };
    const csv = [columnas.join(','), ...errores.map((e) => columnas.map((c) => escapar(e[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `errores_${archivo.replace(/\.[^.]+$/, '')}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Marco>
      <h1 className="titulo">Resultado de la pre-validación</h1>
      <p className="subtitulo">{archivo} · {filas} {filas === 1 ? 'fila' : 'filas'} · Período: {nombrePeriodo(periodo)}</p>
      <Pasos actual={2} />

      <Aviso
        tipo="error"
        titulo={`Encontramos ${errores.length} ${errores.length === 1 ? 'error' : 'errores'}${filasConError ? ` en ${filasConError} ${filasConError === 1 ? 'fila' : 'filas'}` : ''}`}
      >
        Corrige estas filas en tu archivo y vuelve a cargarlo.
        {filasConError > 0 && ` Las otras ${correctas} ${correctas === 1 ? 'fila está correcta' : 'filas están correctas'}.`}
      </Aviso>

      <section className="tarjeta sin-relleno">
        <div className="tarjeta-cabecera">
          <h2 className="titulo-tarjeta">Detalle de errores</h2>
          <button type="button" className="boton boton-secundario" onClick={descargarReporte}>
            <Descargar /> Descargar reporte (.csv)
          </button>
        </div>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Campo</th>
                <th scope="col">Valor recibido</th>
                <th scope="col">Problema</th>
                <th scope="col">Cómo corregirlo</th>
              </tr>
            </thead>
            <tbody>
              {errores.map((e, i) => (
                <tr key={`${e.fila}-${e.campo}-${i}`}>
                  <td className="mono">{e.fila}</td>
                  <td className="negrita">{e.campo}</td>
                  <td className="mono valor-error">{e.valor}</td>
                  <td>{e.problema}</td>
                  <td className="texto-secundario">{e.solucion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="acciones entre">
        <Link to="/cargar" className="enlace-accion">Volver</Link>
        <Link to="/cargar" className="boton boton-primario">Cargar archivo corregido</Link>
      </div>
    </Marco>
  );
}
