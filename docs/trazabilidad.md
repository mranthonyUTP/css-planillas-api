# Trazabilidad de historias de usuario

Relaciona cada historia (HU) con su sprint, sus dependencias, lo que la implementa, cómo se verifica y en qué
commit entró. **Se actualiza en el mismo PR que cierra una HU.** Las filas con HU-13, HU-15 y HU-17 siguen el
mismo formato.

Estados: **Hecha** (en `main` o en un PR abierto), **Backlog** (sin código).

## Matriz por sprint

| Sprint | HU | Tarea | Pts | Estado | Depende de | Implementación | Verificación | Commit |
|---|---|---|---|---|---|---|---|---|
| 0 | HU-01 | Errores frecuentes en planillas | 3 | Hecha | — | `docs/errores-frecuentes.md` | Reglas de `reglas.js` derivadas del documento | `f058a7b` |
| 0 | HU-02 | Pipeline de CI | 5 | Hecha | — | `.github/workflows/ci.yml`, `sonar-project.properties` | CI en cada PR; SonarQube bloquea el merge | `fe5e253` |
| 0 | HU-03 | Modelo de amenazas OWASP API Top 10 | 3 | Hecha | — | `docs/modelo-amenazas.md` | Cada control cita su prueba | `f058a7b` |
| 0 | HU-04 | Especificación OpenAPI | 5 | Hecha | — | `api/openapi.yaml` | Katalon importa el contrato | `48e428d` |
| 1 | HU-05 | Endpoint de pre-validación (dry-run) | 8 | Hecha | HU-04 | `POST /planillas/validar` (`app.js`, `validacion/lector.js`) | `api.test.js` (validación correcta y con errores) | `48e428d` |
| 1 | HU-06 | Reporte de errores por fila, campo y motivo | 5 | Hecha | HU-05 | Respuesta `{ fila, campo, valor, problema, solucion }`; `web/src/pages/Resultado.jsx` | `api.test.js`, `reglas.test.js` | `48e428d` |
| 1 | HU-07 | Autenticación OAuth2 por empresa | 8 | Hecha | — | `api/src/auth.js`, `POST /auth/login` | `api.test.js` (401 y aislamiento por RUC) | `48e428d` |
| 1 | HU-09 | Pruebas unitarias de las reglas | 5 | Hecha | HU-01 | `api/test/reglas.test.js`, `web/src/validacion/reglas.test.js` | `npm test` | `48e428d` |
| 1 | HU-10 | Despliegue automático a staging | 5 | Hecha | HU-02 | `deploy-staging.yml`, `render.yaml`, `api/scripts/smoke.js` | Pruebas de humo tras cada despliegue | `fe5e253` |
| 2 | HU-08 | Clave de idempotencia en los envíos | 5 | Hecha | HU-07 | Cabecera `Idempotency-Key`; `UNIQUE` en `store/esquema.sql` | `api.test.js` (envío idempotente y clave reutilizada) | `48e428d` |
| 2 | HU-11 | Log de auditoría por cada carga | 3 | Hecha | HU-07 | Tabla `cargas`, `GET /cargas` | `api.test.js` (historial por empresa) | `48e428d` |
| 2 | HU-12 | Endpoint de envío oficial | 8 | Hecha | HU-05, HU-06, HU-08, HU-11 | `POST /planillas/enviar` | `api.test.js` (envío, planilla con errores, validación ajena) | `48e428d` |
| 3 | HU-13 | Rate limiting por empresa | 3 | Backlog | HU-07 | — | — | — |
| 3 | HU-14 | Feature flags para las reglas | 5 | Hecha (rama `feat/hu-14-feature-flags`) | HU-01, HU-09 | `validacion/flags.js`, `REGLAS_DESACTIVADAS`, `GET /reglas` | `reglas.test.js` y `api.test.js` (bloque HU-14) | `c0b6d9b` |
| 3 | HU-15 | OWASP ZAP en el pipeline | 3 | Backlog | HU-04, HU-10 | — | — | — |
| 3 | HU-17 | Monitoreo y alertas | 5 | Hecha (rama `feat/hu-17-monitoreo`) | HU-10 | `metricas.js`, `alertas.js`, `GET /metricas`, `monitoreo.yml` | `api/test/monitoreo.test.js` | `10dae52` |

Puntos: 79 en total. Hechas: 73 (63 del MVP, Sprints 0 a 2, más 10 de HU-14 y HU-17). Pendientes: 6 (HU-13 y HU-15).

## Cómo se correlacionan

```
HU-04 OpenAPI ──► HU-05 validar ──► HU-06 reporte ─┐
HU-07 auth ──┬──► HU-08 idempotencia ──────────────┼──► HU-12 envío
             └──► HU-11 auditoría ─────────────────┘
HU-01 errores ──► HU-09 pruebas unitarias ──► HU-14 feature flags
HU-02 CI ──► HU-10 staging ──► HU-17 monitoreo (smoke programado)
                          └──► HU-15 ZAP (con HU-04)
HU-07 auth ──► HU-13 rate limiting
```

- **HU-14 modifica lo que HU-01 documenta y HU-09 prueba.** Cada flag corresponde a una regla de
  `validacion/reglas.js`. Si cambias una regla, actualiza `errores-frecuentes.md` y las pruebas de HU-09.
- **HU-17 reutiliza HU-10.** El workflow `monitoreo.yml` corre el mismo `npm run smoke` del despliegue,
  cada 15 minutos. Las métricas y alertas internas se suman a eso.
- **Las HU de Sprint 3 cierran huecos del modelo de amenazas (HU-03):** API4 (HU-13), API8 (HU-15, HU-17) y API9 (HU-17).

## Endpoints y variables por HU

| HU | Endpoints | Variables de entorno |
|---|---|---|
| HU-05, HU-06 | `POST /planillas/validar` | `MAX_FILE_MB` |
| HU-07 | `POST /auth/login` | `AUTH_MODE`, `JWT_SECRET`, `JWT_TTL`, `OIDC_ISSUER`, `OIDC_AUDIENCE` |
| HU-08, HU-12 | `POST /planillas/enviar` | — |
| HU-10 | `GET /salud` | `STAGING_API_URL` (GitHub), `RENDER_DEPLOY_HOOK_URL` (secreto) |
| HU-11 | `GET /cargas` | `DATABASE_URL` |
| HU-14 | `GET /reglas` | `REGLAS_DESACTIVADAS` |
| HU-17 | `GET /metricas` | `METRICS_TOKEN`, `ALERTA_TASA_ERROR`, `ALERTA_LATENCIA_MS`, `ALERTA_MIN_SOLICITUDES`, `ALERTA_WEBHOOK_URL` |

## Regla para mantenerla

1. Una HU = una rama = un PR, con el ID en el título y en los commits (`HU-14`).
2. En ese PR: marca la fila de la HU como Hecha, agrega el commit y los archivos de implementación y pruebas.
3. Si la HU toca el contrato, actualiza `api/openapi.yaml`; si toca una amenaza, `docs/modelo-amenazas.md`.
4. Los comentarios del código que implementan una HU citan su ID, para poder buscar con `grep -rn "HU-14"`.
