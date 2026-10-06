const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-10" → "Octubre 2026"
export function nombrePeriodo(periodo) {
  const [anio, mes] = periodo.split('-');
  const nombre = MESES[Number(mes) - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`;
}

// Los últimos n meses, del más reciente al más antiguo.
export function periodosRecientes(n = 6, hoy = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function fechaHora(iso) {
  return new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function balboas(monto) {
  return `B/. ${new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto)}`;
}
