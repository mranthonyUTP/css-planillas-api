// HU-07: autenticación por empresa con tokens Bearer (JWT).
// Modo "local": la API firma sus propios tokens (desarrollo y demo).
// Modo "oidc": valida tokens emitidos por Keycloak (OAuth2/OpenID Connect) por JWKS.
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from './config.js';
import { noAutorizado, solicitudInvalida, ErrorApi } from './errores.js';

const secreto = new TextEncoder().encode(config.jwtSecret);
const ISSUER_LOCAL = 'css-planillas-api';
let jwks;

export async function emitirToken({ ruc, usuario, empresa }) {
  return new SignJWT({ ruc, empresa })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario)
    .setIssuer(ISSUER_LOCAL)
    .setIssuedAt()
    .setExpirationTime(config.jwtDuracion)
    .sign(secreto);
}

async function verificar(token) {
  if (config.authModo === 'oidc') {
    jwks ??= createRemoteJWKSet(new URL(`${config.oidcIssuer}/protocol/openid-connect/certs`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.oidcIssuer,
      ...(config.oidcAudience ? { audience: config.oidcAudience } : {}),
    });
    // En Keycloak, el RUC de la empresa se agrega como claim "ruc" con un mapper del cliente.
    return { usuario: payload.preferred_username ?? payload.sub, ruc: payload.ruc, empresa: payload.empresa ?? payload.ruc };
  }
  const { payload } = await jwtVerify(token, secreto, { issuer: ISSUER_LOCAL, algorithms: ['HS256'] });
  return { usuario: payload.sub, ruc: payload.ruc, empresa: payload.empresa };
}

// Middleware: exige un token válido y deja la identidad en req.usuario.
export async function requiereAuth(req, _res, next) {
  const [esquema, token] = (req.get('authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(noAutorizado('Falta el token de acceso.'));
  try {
    const identidad = await verificar(token);
    if (!identidad.ruc) return next(noAutorizado('El token no indica la empresa.'));
    req.usuario = identidad;
    next();
  } catch {
    next(noAutorizado());
  }
}

// POST /auth/login (solo en modo local). Acepta cualquier credencial no vacía: es una demo.
// En producción, el portal redirige al flujo OAuth2 de Keycloak y este endpoint queda deshabilitado.
export async function login(req, res) {
  if (config.authModo !== 'local') {
    throw new ErrorApi(404, 'El inicio de sesión se hace con el proveedor de identidad (OAuth2).', 'no_disponible');
  }
  const { ruc, usuario, clave } = req.body ?? {};
  const textos = [ruc, usuario, clave];
  if (textos.some((t) => typeof t !== 'string' || t.trim() === '')) {
    throw solicitudInvalida('Completa el RUC, el usuario y la contraseña.');
  }
  if (textos.some((t) => t.length > 100)) throw solicitudInvalida('Los datos de acceso son demasiado largos.');
  const empresa = { ruc: ruc.trim(), nombre: `Empresa RUC ${ruc.trim()}` };
  const token = await emitirToken({ ruc: empresa.ruc, usuario: usuario.trim(), empresa: empresa.nombre });
  res.json({ token, usuario: usuario.trim(), empresa });
}
