const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function nombrePeriodo(periodo) {
  const [anio, mes] = String(periodo ?? '').split('-');
  const nombre = MESES[Number(mes) - 1];
  return nombre ? `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}` : '—';
}
export function periodosRecientes(n = 24, hoy = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
export function fechaHora(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}
export function balboas(monto) {
  if (monto === '' || monto == null || !Number.isFinite(Number(monto))) return '—';
  return `B/. ${new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(monto))}`;
}
export const nombreRol = rol => rol === 'OPERADOR' ? 'Operador' : 'Responsable de planillas';
export const nombreEstado = estado => ({ FORMATO_INVALIDO: 'Con observaciones de formato', CONTRASTE_NO_COMPARABLE: 'Contraste no disponible', SIN_REFERENCIA: 'Sin referencia', DIFERENCIAS_POR_REVISAR: 'Diferencias para revisar', SIN_DIFERENCIAS: 'Sin diferencias de sueldo y presencia' })[estado] ?? 'Sin referencia';
export const claseEstado = estado => estado === 'FORMATO_INVALIDO' || estado === 'CONTRASTE_NO_COMPARABLE' ? 'etiqueta-error' : 'etiqueta-info';
