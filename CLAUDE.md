# css-planillas-api: contexto del proyecto

Proyecto académico (UTP, Panamá). Es un portal web y una API para que los empleadores **validen su planilla de
seguridad social antes de enviarla** a la Caja de Seguro Social (CSS). Hoy no existe una API pública de
validación previa: Mi Caja Digital permite pagar, no pre-validar.

Esto es un **prototipo académico**, no un sistema oficial, y no usa el logo real de la CSS. El pie de página lo
indica. La franja superior "No es un sitio oficial del Estado" se quitó a pedido del equipo para la presentación.

Las pantallas de ingreso y carga tienen botones de **datos de prueba** (`web/src/demo.js`) para la presentación.
Se ocultan con `VITE_BOTONES_DEMO=false`.

## Estructura del repositorio

```
/web    Frontend: React + Vite + React Router (JavaScript, sin TypeScript)
/api    Backend: Node.js + Express 5. Contrato en api/openapi.yaml (HU-04)
/docs   errores-frecuentes.md (HU-01) y modelo-amenazas.md (HU-03)
/.github/workflows  ci.yml (HU-02, SonarQube) y deploy-staging.yml (HU-10, Render + pruebas de humo)
docker-compose.yml  PostgreSQL + API para desarrollo local
render.yaml         Infraestructura de staging (Render Blueprint)
```

## Comandos

```
# API + PostgreSQL
docker compose up --build            # API en http://localhost:3000
cd api && npm test                   # pruebas (memoria; con TEST_DATABASE_URL también PostgreSQL)
cd api && npm run dev                # API sin Docker, almacenamiento en memoria
cd api && BASE_URL=... npm run smoke # pruebas de humo contra un ambiente

# Portal
cd web && npm run dev                                   # modo simulado (sin API)
cd web && VITE_API_URL=http://localhost:3000 npm run dev  # contra la API real
cd web && npm test && npm run build
```

En `AUTH_MODE=local` (por defecto) cualquier RUC, usuario y contraseña no vacíos inician sesión, y cada token
solo ve los datos de su RUC. Con `AUTH_MODE=oidc` + `OIDC_ISSUER` la API valida tokens de Keycloak por JWKS.

## Estado de la API

- Variables de entorno en `api/.env.example`. Sin `DATABASE_URL` usa almacenamiento en memoria.
- Esquema SQL en `api/src/store/esquema.sql` (se aplica al iniciar). Idempotencia garantizada por restricciones
  `UNIQUE (empresa_ruc, idempotency_key)` y `UNIQUE (validacion_id)`.
- Las reglas viven en `api/src/validacion/reglas.js`. `web/src/validacion/reglas.js` es una copia para el modo
  simulado: **si cambias una regla, cambia ambas**.
- Pruebas: `node --test` con `fetch` nativo contra la app levantada en un puerto libre (sin Supertest).

## Tecnologías definidas

Herramientas obligatorias del curso:

| Herramienta | Uso | HU |
|---|---|---|
| JavaScript (Node.js + React) | API y portal | Todas |
| SonarQube | Calidad, bugs y cobertura; bloquea el merge si no pasa | HU-02, HU-09 |
| Katalon Studio | Pruebas de la API (importando el OpenAPI) y pruebas de punta a punta de la UI | HU-05, HU-06, HU-10, HU-12 |
| OWASP ZAP | Escaneo de seguridad de la API en staging | HU-03, HU-15 |

**Decisión:** Aircrack-ng se reemplazó por OWASP ZAP. Aircrack-ng audita redes Wi-Fi; el riesgo del proyecto
está en la API web, y ZAP la prueba contra el OWASP API Top 10.

Complementarias: GitHub Actions (CI/CD), Express, Ajv (JSON Schema), exceljs, csv-parse, multer, PostgreSQL,
Keycloak (OAuth2), Pino (logs), `node --test` (pruebas unitarias, en lugar de Jest), Docker, Render o Railway
(staging). **No usar Jest ni Supertest**: Katalon cubre las pruebas de API y `node --test` las unitarias.

## Historias de usuario (79 pts)

El MVP abarca los Sprints 0 a 2. El Sprint 3 es backlog.

| Sprint | ID | Tarea | Pts |
|---|---|---|---|
| 0 | HU-01 | Documentar los errores más frecuentes en las planillas | 3 |
| 0 | HU-02 | Configurar el pipeline de CI en el repositorio | 5 |
| 0 | HU-03 | Elaborar el modelo de amenazas según OWASP API Top 10 | 3 |
| 0 | HU-04 | Redactar la especificación OpenAPI de la planilla | 5 |
| 1 | HU-05 | Implementar el endpoint de pre-validación (dry-run) | 8 |
| 1 | HU-06 | Generar el reporte de errores por fila, campo y motivo | 5 |
| 1 | HU-07 | Implementar la autenticación OAuth2 por empresa | 8 |
| 1 | HU-09 | Crear las pruebas unitarias de las reglas de validación | 5 |
| 1 | HU-10 | Automatizar el despliegue a staging | 5 |
| 2 | HU-08 | Implementar la clave de idempotencia en los envíos | 5 |
| 2 | HU-11 | Registrar un log de auditoría por cada carga | 3 |
| 2 | HU-12 | Implementar el endpoint de envío oficial | 8 |
| 3 | HU-13 | Configurar el rate limiting por empresa | 3 |
| 3 | HU-14 | Implementar feature flags para las reglas de validación | 5 |
| 3 | HU-15 | Integrar OWASP ZAP en el pipeline contra staging | 3 |
| 3 | HU-17 | Configurar el monitoreo y las alertas de la API | 5 |

Dependencias: HU-12 necesita HU-05, HU-06, HU-08 y HU-11. HU-09 usa las reglas de HU-01. HU-15 usa el OpenAPI de
HU-04 y el staging de HU-10.

## Contrato de API (implementado; detalle en api/openapi.yaml)

| Método y ruta | Uso | HU |
|---|---|---|
| `POST /auth/login` | Devuelve un token (en producción, flujo OAuth2 con Keycloak) | HU-07 |
| `POST /planillas/validar` | Pre-validación sin registrar. `multipart/form-data`: `archivo`, `periodo`, `tipo` | HU-05, HU-06 |
| `POST /planillas/enviar` | Envío oficial de una validación exitosa. Cabecera `Idempotency-Key` | HU-08, HU-12 |
| `GET /cargas` | Historial de cargas de la empresa | HU-11 |
| `GET /salud` | Estado del servicio (pruebas de humo) | HU-10 |

Formato de error de validación: `{ fila, campo, valor, problema, solucion }`. Errores de la API: `{ mensaje, codigo }`.
El cliente está en `web/src/api/`. Con `VITE_API_URL` vacío usa el mock (`mock.js`); con una URL usa la API real.

## Reglas de validación del mock (base para HU-01 y HU-09)

Columnas obligatorias: `cedula`, `nombre`, `salario`, `dias_laborados`, `codigo_ocupacion`.
- Cédula con formato panameño (ej. `8-123-456`, `PE-12-345`, `E-8-12345`).
- Salario obligatorio, numérico y mayor que 0, sin símbolo de moneda.
- Días laborados entero entre 0 y 31.
- Código de ocupación dentro del catálogo (el mock usa un catálogo de ejemplo).

Estas reglas son de ejemplo y deben confirmarse contra la normativa vigente de la CSS en HU-01.

## Diseño

Seis pantallas: 1 Inicio de sesión, 2 Cargar planilla, 3 Resultado (errores), 4 Confirmar envío, 5 Comprobante,
6 Historial. Estilo institucional: simple, lenguaje claro, pasos numerados.

- Colores: azul marino `#0B2E59` (encabezado), azul acción `#0B4F9C`, acento dorado `#F2B632`, fondo `#F4F6F9`,
  texto `#1B2430`, texto secundario `#4A5565`, éxito `#1E6B3A`, error `#A4262C`.
- Tipografía: Public Sans (texto) e IBM Plex Mono (IDs y números de confirmación), servidas desde `@fontsource`.
- Accesibilidad: controles reales (`button`, `a`, `label`), objetivos táctiles de al menos 44 px, contraste AA.
- Los tokens viven en `web/src/styles.css`.

## Convenciones

- Interfaz y mensajes en español de Panamá; moneda B/.
- Commits en español, en modo imperativo y cortos.
- Una historia de usuario es una sola tarea; referenciar su ID (`HU-05`) en commits y PRs.
