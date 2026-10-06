// Error de API con estado HTTP y mensaje en español para el usuario.
export class ErrorApi extends Error {
  constructor(estado, mensaje, codigo) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

export const noAutorizado = (m = 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.') => new ErrorApi(401, m, 'no_autorizado');
export const solicitudInvalida = (m) => new ErrorApi(400, m, 'solicitud_invalida');
export const noEncontrado = (m) => new ErrorApi(404, m, 'no_encontrado');
export const conflicto = (m, codigo = 'conflicto') => new ErrorApi(409, m, codigo);
