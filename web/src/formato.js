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
export const nombreRol = (rol) => ({ ELABORADOR: 'Elaborador', OPERADOR: 'Operador', AUTORIZADOR: 'Autorizador' })[rol] ?? 'Usuario';
export const nombreAccion = (accion) => ({ carga: 'Archivo cargado', solicitar: 'Revisión solicitada', aprobar: 'Revisión aprobada', autorizar: 'Autorización interna', 'devolver-revision': 'Devuelta por operador', 'devolver-autorizacion': 'Devuelta por autorizador' })[accion] ?? accion;
export const nombreEstado = (estado) => ({ BORRADOR: 'Borrador', PENDIENTE_REVISION: 'Pendiente de revisión', PENDIENTE_AUTORIZACION: 'Pendiente de autorización', DEVUELTA: 'Devuelta para corregir', AUTORIZADA: 'Autorizada internamente' })[estado] ?? estado ?? '—';
export const claseEstado = (estado) => estado === 'AUTORIZADA' ? 'etiqueta-exito' : estado === 'DEVUELTA' ? 'etiqueta-error' : 'etiqueta-info';
