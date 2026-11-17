import { timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from './config.js';
import { noAutorizado, solicitudInvalida, ErrorApi } from './errores.js';

export const ROLES = ['ELABORADOR', 'OPERADOR', 'AUTORIZADOR'];
const ISSUER_LOCAL = 'css-planillas-api';
let jwks;
export const EMPRESAS_DEMO = [
  { ruc: '155123456-2-2020', nombre: 'Empresa de demostración, S.A.' },
  { ruc: '155987654-1-2021', nombre: 'Segunda empresa de demostración, S.A.' },
];
const CUENTAS_DEMO = [
  { usuario: 'ana.contabilidad', rol: 'ELABORADOR', ruc: EMPRESAS_DEMO[0].ruc },
  { usuario: 'elaborador', rol: 'ELABORADOR', ruc: EMPRESAS_DEMO[0].ruc },
  { usuario: 'empresa.dos', rol: 'ELABORADOR', ruc: EMPRESAS_DEMO[1].ruc },
  { usuario: 'operador', rol: 'OPERADOR' },
  { usuario: 'autorizador', rol: 'AUTORIZADOR' },
  { usuario: 'representante', rol: 'AUTORIZADOR' },
];

// Los roles y las empresas proceden de cuentas del servidor o de claims firmados.
export function identidadDesdeClaims(payload) {
  const recibidos = payload.roles ?? payload.realm_access?.roles ?? (payload.rol ? [payload.rol] : []);
  const roles = Array.isArray(recibidos) ? [...new Set(recibidos.filter((r) => ROLES.includes(r)))] : [];
  const recibidas = payload.empresas ?? (typeof payload.ruc === 'string' ? [{ ruc: payload.ruc, nombre: payload.empresa ?? payload.ruc }] : []);
  const empresas = Array.isArray(recibidas) ? recibidas.map((e) => typeof e === 'string' ? { ruc: e, nombre: e } : e)
    .filter((e) => e && typeof e.ruc === 'string' && e.ruc.length > 0 && e.ruc.length <= 100)
    .map((e) => ({ ruc: e.ruc, nombre: typeof e.nombre === 'string' ? e.nombre : e.ruc })) : [];
  const ruc = payload.ruc ?? empresas[0]?.ruc;
  const empresa = empresas.find((e) => e.ruc === ruc);
  const usuario = payload.preferred_username ?? payload.sub;
  if (!roles.length || !empresa || typeof usuario !== 'string' || !usuario) throw noAutorizado('La cuenta no tiene roles o empresas asignadas.');
  return { usuario, ruc, empresa: empresa.nombre, empresas, roles, rol: roles[0] };
}

export async function emitirToken({ ruc, usuario, empresa, roles = ['ELABORADOR'], empresas = [{ ruc, nombre: empresa ?? ruc }] }) {
  return new SignJWT({ ruc, empresa, roles, empresas }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario).setIssuer(ISSUER_LOCAL).setIssuedAt().setExpirationTime(config.jwtDuracion)
    .sign(new TextEncoder().encode(config.jwtSecret));
}
async function verificar(token) {
  if (config.authModo === 'oidc') {
    jwks ??= createRemoteJWKSet(new URL(`${config.oidcIssuer}/protocol/openid-connect/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer: config.oidcIssuer, audience: config.oidcAudience });
    return identidadDesdeClaims(payload);
  }
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.jwtSecret), { issuer: ISSUER_LOCAL, algorithms: ['HS256'] });
  return identidadDesdeClaims(payload);
}
export async function requiereAuth(req, _res, next) {
  const [esquema, token] = (req.get('authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(noAutorizado('Falta el token de acceso.'));
  try { req.usuario = await verificar(token); next(); } catch { next(noAutorizado()); }
}
export const requiereRol = (...roles) => (req, _res, next) => {
  if (!req.usuario.roles.some((r) => roles.includes(r))) return next(new ErrorApi(403, 'Tu rol no permite realizar esta acción.', 'sin_permiso'));
  next();
};
export const rucsPermitidos = (identidad) => identidad.roles.some((r) => ['OPERADOR', 'AUTORIZADOR'].includes(r))
  ? identidad.empresas.map((e) => e.ruc) : [identidad.ruc];

export async function login(req, res) {
  if (config.authModo !== 'local' || config.entorno === 'production') throw new ErrorApi(404, 'El inicio de sesión se hace con el proveedor de identidad.', 'no_disponible');
  const { ruc, usuario, clave } = req.body ?? {};
  if ([ruc, usuario, clave].some((v) => typeof v !== 'string' || !v.trim() || v.length > 100)) throw solicitudInvalida('Completa el RUC, el usuario y la contraseña.');
  const cuenta = CUENTAS_DEMO.find((c) => c.usuario === usuario.trim());
  const a = Buffer.from(clave), b = Buffer.from(config.demoClave);
  if (!cuenta || a.length !== b.length || !timingSafeEqual(a, b)) throw noAutorizado('Credenciales de demostración incorrectas.');
  const empresas = cuenta.ruc ? EMPRESAS_DEMO.filter((e) => e.ruc === cuenta.ruc) : EMPRESAS_DEMO;
  const empresa = empresas.find((e) => e.ruc === ruc.trim());
  if (!empresa) throw new ErrorApi(403, 'La cuenta no está asignada a esa empresa.', 'empresa_no_asignada');
  const roles = [cuenta.rol];
  const token = await emitirToken({ ruc: empresa.ruc, usuario: cuenta.usuario, empresa: empresa.nombre, roles, empresas });
  res.json({ token, usuario: cuenta.usuario, rol: cuenta.rol, roles, empresa, empresas });
}
