# css-planillas-api

API y portal para que los empleadores **pre-validen su planilla de seguridad social** antes de enviarla a la Caja
de Seguro Social, con reporte de errores por fila, envío oficial sin duplicados y auditoría.

> Prototipo académico (UTP). No es un sistema oficial de la CSS.

## Estructura

| Carpeta | Contenido |
|---|---|
| `web/` | Portal de Planillas (React + Vite): 6 pantallas del flujo del empleador |
| `api/` | API en Node.js + Express + PostgreSQL. Contrato en `api/openapi.yaml` |
| `docs/` | Errores frecuentes (HU-01) y modelo de amenazas OWASP API Top 10 (HU-03) |
| `.github/workflows/` | CI con SonarQube (HU-02) y despliegue a staging (HU-10) |
| `CLAUDE.md` | Contexto completo: historias de usuario, tecnologías, decisiones y diseño |

## Ejecutar en local

Requiere Node.js 20+ y Docker.

```bash
docker compose up --build                     # PostgreSQL + API en http://localhost:3000
cd web && npm install
VITE_API_URL=http://localhost:3000 npm run dev  # portal en http://localhost:5173
```

Sin Docker: `cd api && npm install && npm run dev` (almacenamiento en memoria). El portal también funciona solo,
con una API simulada: `cd web && npm run dev`.

Inicia sesión con cualquier RUC, usuario y contraseña. Para la demo, usa los botones **Datos de prueba**: "Rellenar
datos" en el ingreso, y "Cargar planilla correcta" o "Cargar planilla con errores" en la carga.

## Pruebas

```bash
cd api && npm test       # 19 pruebas (30 con TEST_DATABASE_URL apuntando a PostgreSQL)
cd web && npm test       # reglas del modo simulado
cd api && BASE_URL=http://localhost:3000 npm run smoke   # pruebas de humo
```

## Configurar CI y staging (una sola vez)

1. **SonarQube (HU-02):** crea el proyecto en [SonarCloud](https://sonarcloud.io) importando este repositorio,
   ajusta `sonar.organization` y `sonar.projectKey` en `sonar-project.properties` y agrega el secreto
   `SONAR_TOKEN` en GitHub › Settings › Secrets and variables › Actions. Con un servidor SonarQube propio,
   define además la variable `SONAR_HOST_URL`.
2. **Bloquear merges sin CI:** GitHub › Settings › Branches › regla para `main` › *Require status checks*:
   `API · pruebas`, `Portal · pruebas y build` y `SonarQube · calidad`.
3. **Staging en Render (HU-10):** Render › New › Blueprint › este repositorio (usa `render.yaml`). Luego copia el
   *Deploy Hook* del servicio `css-planillas-api` al secreto `RENDER_DEPLOY_HOOK_URL` y define la variable
   `STAGING_API_URL` con su URL. Cada push a `main` que pase el CI se despliega y se prueba solo.

## Historias de usuario del MVP

| HU | Estado | Dónde |
|---|---|---|
| HU-01 Errores frecuentes | Hecha (pendiente contrastar con la normativa CSS) | `docs/errores-frecuentes.md` |
| HU-02 Pipeline de CI | Hecha (activar `SONAR_TOKEN`) | `.github/workflows/ci.yml` |
| HU-03 Modelo de amenazas | Hecha | `docs/modelo-amenazas.md` |
| HU-04 Especificación OpenAPI | Hecha | `api/openapi.yaml` |
| HU-05 Pre-validación | Hecha (.csv y .xlsx) | `POST /planillas/validar` |
| HU-06 Reporte de errores | Hecha | Respuesta de validación + pantalla de resultado |
| HU-07 Autenticación | Hecha: JWT local; Keycloak por OIDC listo por configuración | `api/src/auth.js` |
| HU-08 Idempotencia | Hecha | `Idempotency-Key` + restricciones en PostgreSQL |
| HU-09 Pruebas unitarias | Hecha | `api/test/` |
| HU-10 Despliegue a staging | Hecha (configurar Render) | `.github/workflows/deploy-staging.yml`, `render.yaml` |
| HU-11 Auditoría | Hecha | Tabla `cargas`, `GET /cargas` |
| HU-12 Envío oficial | Hecha | `POST /planillas/enviar` |

Backlog (Sprint 3): HU-13 rate limiting, HU-14 feature flags, HU-15 OWASP ZAP en el pipeline, HU-17 monitoreo.

## Tecnologías

JavaScript (Node.js + React), SonarQube, Katalon Studio (importa `api/openapi.yaml`) y OWASP ZAP. Detalle en
`CLAUDE.md`.
