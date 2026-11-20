export function estadoIntento(intento) {
  if (!intento?.valida) return 'FORMATO_INVALIDO';
  if (intento.contraste?.estado === 'no_comparable') return 'CONTRASTE_NO_COMPARABLE';
  if (intento.contraste?.estado !== 'realizado') return 'SIN_REFERENCIA';
  return intento.contraste.diferencias.length ? 'DIFERENCIAS_POR_REVISAR' : 'SIN_DIFERENCIAS';
}
