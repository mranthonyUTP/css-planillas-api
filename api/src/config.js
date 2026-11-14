// Configuración por variables de entorno. Ver api/.env.example.
import { reglasActivas } from './validacion/flags.js';
const env = process.env;

export const config = {
  puerto: Number(env.PORT ?? 3000),
  entorno: env.NODE_ENV ?? 'development',
  // Origen del portal permitido por CORS (coma para varios).
  origenesPermitidos: (env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Si existe, se usa PostgreSQL; si no, almacenamiento en memoria.
  databaseUrl: env.DATABASE_URL ?? '',
  // Modo de autenticación (HU-07):
  //  - "local": la API emite y valida sus propios JWT firmados con JWT_SECRET (desarrollo y demo).
  //  - "oidc":  valida tokens de Keycloak u otro proveedor OAuth2 por JWKS; /auth/login queda deshabilitado.
  authModo: env.AUTH_MODE ?? 'local',
  jwtSecret: env.JWT_SECRET ?? 'solo-para-desarrollo-cambiar-en-staging',
  jwtDuracion: env.JWT_TTL ?? '1h',
  oidcIssuer: env.OIDC_ISSUER ?? '',
  oidcAudience: env.OIDC_AUDIENCE ?? '',
  // Límite del archivo de planilla.
  tamanoMaximoMb: Number(env.MAX_FILE_MB ?? 5),
  // HU-14: reglas desactivadas (ids separados por comas). Ejemplo: REGLAS_DESACTIVADAS=codigo_ocupacion
  reglasDesactivadas: (env.REGLAS_DESACTIVADAS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  // HU-17: monitoreo y alertas.
  //  - METRICS_TOKEN: protege GET /metricas. Vacío: el endpoint queda deshabilitado (404).
  //  - ALERTA_*: umbrales sobre los últimos 5 minutos. ALERTA_WEBHOOK_URL es opcional (Slack/Discord).
  metricasToken: env.METRICS_TOKEN ?? '',
  alertaWebhookUrl: env.ALERTA_WEBHOOK_URL ?? '',
  alertaTasaError: Number(env.ALERTA_TASA_ERROR ?? 0.05),
  alertaLatenciaMs: Number(env.ALERTA_LATENCIA_MS ?? 2000),
  alertaMinSolicitudes: Number(env.ALERTA_MIN_SOLICITUDES ?? 20),
  nivelLog: env.LOG_LEVEL ?? 'info',
};

export function validarConfig() {
  if (config.entorno === 'production' && config.authModo === 'local' && config.jwtSecret.startsWith('solo-para')) {
    throw new Error('JWT_SECRET debe definirse en producción.');
  }
  reglasActivas(config.reglasDesactivadas); // falla si hay un id desconocido
  if (config.authModo === 'oidc' && !config.oidcIssuer) {
    throw new Error('AUTH_MODE=oidc requiere OIDC_ISSUER.');
  }
}
