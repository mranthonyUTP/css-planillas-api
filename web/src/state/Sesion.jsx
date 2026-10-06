import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Guarda la sesión y la planilla en curso. Se conserva en sessionStorage para que
// recargar la página no saque al usuario del flujo; se borra al cerrar la pestaña.

const CLAVE = 'portal-planillas-sesion';
const SesionContext = createContext(null);

function leer() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE)) ?? {};
  } catch {
    return {};
  }
}

function escribir(valor) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: el estado vive solo en memoria.
  }
}

export function SesionProvider({ children }) {
  const [estado, setEstado] = useState(leer);

  const actualizar = useCallback((cambios) => {
    setEstado((previo) => {
      const nuevo = { ...previo, ...cambios };
      escribir(nuevo);
      return nuevo;
    });
  }, []);

  useEffect(() => {
    const expirar = () => actualizar({ sesion: null, validacion: null, envio: null });
    window.addEventListener('sesion-expirada', expirar);
    return () => window.removeEventListener('sesion-expirada', expirar);
  }, [actualizar]);

  const valor = useMemo(
    () => ({
      sesion: estado.sesion ?? null,
      validacion: estado.validacion ?? null,
      envio: estado.envio ?? null,
      iniciar: (sesion) => actualizar({ sesion, validacion: null, envio: null }),
      cerrar: () => actualizar({ sesion: null, validacion: null, envio: null }),
      // Cada validación nueva recibe su propia clave de idempotencia (HU-08).
      guardarValidacion: (validacion) =>
        actualizar({ validacion: { ...validacion, idempotencyKey: crypto.randomUUID() }, envio: null }),
      guardarEnvio: (envio) => actualizar({ envio }),
    }),
    [estado, actualizar],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const contexto = useContext(SesionContext);
  if (!contexto) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return contexto;
}
