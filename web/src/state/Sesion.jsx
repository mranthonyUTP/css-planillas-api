import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const ORIGEN = import.meta.env.VITE_API_URL || 'demo';
const CLAVE = `portal-planillas-sesion-v3:${ORIGEN}`;
const Contexto = createContext(null);
function leer() {
  try {
    const datos = JSON.parse(sessionStorage.getItem(CLAVE)) ?? {};
    return datos.sesion && !['ELABORADOR', 'OPERADOR', 'AUTORIZADOR'].includes(datos.sesion.rol) ? {} : datos;
  } catch { return {}; }
}
export function SesionProvider({ children }) {
  const [estado, setEstado] = useState(leer);
  const actualizar = useCallback((cambios) => setEstado((anterior) => {
    const nuevo = { ...anterior, ...cambios };
    try { sessionStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* La sesión sigue en memoria. */ }
    return nuevo;
  }), []);
  useEffect(() => {
    const expirar = () => actualizar({ sesion: null, empresaActivaRuc: null, validacion: null, envio: null });
    window.addEventListener('sesion-expirada', expirar);
    return () => window.removeEventListener('sesion-expirada', expirar);
  }, [actualizar]);
  const empresas = estado.sesion?.empresas ?? (estado.sesion?.empresa ? [estado.sesion.empresa] : []);
  const empresaActiva = empresas.find((e) => e.ruc === estado.empresaActivaRuc) ?? empresas.find((e) => e.ruc === estado.sesion?.empresa?.ruc) ?? empresas[0] ?? null;
  const valor = useMemo(() => ({ sesion: estado.sesion ?? null, empresaActiva, validacion: estado.validacion ?? null, envio: estado.envio ?? null,
    seleccionarEmpresa: (ruc) => { if (empresas.some((e) => e.ruc === ruc)) actualizar({ empresaActivaRuc: ruc }); },
    iniciar: (sesion) => actualizar({ sesion, empresaActivaRuc: sesion.empresa.ruc, validacion: null, envio: null }),
    cerrar: () => actualizar({ sesion: null, empresaActivaRuc: null, validacion: null, envio: null }),
    guardarValidacion: (validacion) => actualizar({ validacion, envio: null }), guardarEnvio: (envio) => actualizar({ envio }) }), [estado, actualizar, empresaActiva]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
export const useSesion = () => useContext(Contexto);
