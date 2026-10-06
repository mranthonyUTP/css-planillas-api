# HU-03: modelo de amenazas (OWASP API Security Top 10, 2023)

**Activo principal:** las planillas contienen datos personales (cédula, nombre) y salariales de los
trabajadores. Su manejo está sujeto a la Ley 81 de 2019 de protección de datos personales de Panamá.

**Actores:** empleador autenticado, otra empresa autenticada (actor malicioso interno), atacante anónimo.

| OWASP | Amenaza en este sistema | Control implementado | Dónde | Verificación |
|---|---|---|---|---|
| API1 Broken Object Level Authorization | Una empresa envía o consulta la validación o el historial de otra | Toda consulta filtra por el RUC del token; una validación ajena responde 404 | `app.js`, `store/*` | Prueba "una empresa no puede enviar la validación de otra" |
| API2 Broken Authentication | Acceso sin sesión o con tokens falsificados o vencidos | JWT firmado (HS256 local) o verificado por JWKS de Keycloak (OIDC); expira en 1 h; la API no arranca en producción con el secreto por defecto | `auth.js`, `config.js` | Pruebas 401; escaneo ZAP (HU-15) |
| API3 Broken Object Property Level Authorization | Exponer campos internos (RUC, usuario) o aceptar campos no previstos | Las respuestas quitan `empresaRuc` y `usuario`; el envío solo lee `validacionId` | `app.js` (`publica`) | Prueba de forma de respuesta |
| API4 Unrestricted Resource Consumption | Archivos enormes o muchas solicitudes saturan el servicio | Límite de 5 MB y 1 archivo; JSON de 10 KB; historial de 500 filas | `app.js` | Rate limiting por empresa en HU-13 (Sprint 3) |
| API5 Broken Function Level Authorization | Usar `/auth/login` en producción para emitir tokens | Con `AUTH_MODE=oidc` el login local responde 404 | `auth.js` | Configuración de staging |
| API6 Unrestricted Access to Sensitive Business Flows | Envíos duplicados por reintentos o automatización | `Idempotency-Key` obligatoria; unicidad por empresa+clave y por validación en la base de datos | `store/esquema.sql` | Prueba de idempotencia |
| API7 Server Side Request Forgery | — | La API no hace solicitudes a URLs del usuario; solo al JWKS configurado | — | No aplica |
| API8 Security Misconfiguration | Cabeceras inseguras, CORS abierto, errores con detalles internos | Helmet, CORS solo al origen del portal, `x-powered-by` desactivado, errores 500 genéricos, cabecera `Authorization` redactada en logs | `app.js` | Escaneo ZAP (HU-15) |
| API9 Improper Inventory Management | Endpoints sin documentar o versiones viejas expuestas | Contrato único en `api/openapi.yaml`; rutas desconocidas responden 404 | `openapi.yaml` | Katalon importa el OpenAPI |
| API10 Unsafe Consumption of APIs | Archivos manipulados (CSV/XLSX) para romper el lector | csv-parse y exceljs con errores controlados; los valores se tratan como texto y se escapan al exportar CSV en el portal | `validacion/lector.js`, `web/src/pages/Resultado.jsx` | Pruebas de formatos inválidos |

## Riesgos aceptados en el MVP

- **Login de demostración:** en `AUTH_MODE=local` cualquier credencial no vacía obtiene un token de su propio RUC. Es aceptable para la demo porque cada token solo ve los datos de su RUC; en staging público debe usarse `AUTH_MODE=oidc` con Keycloak.
- **Cifrado en reposo** (Ley 81 de 2019) y **rate limiting** quedan para el backlog (HU-13 y HU-19).
- **Inyección de fórmulas en CSV** (resuelto) al abrir el reporte de errores en Excel: el portal escapa comillas y antepone `'` a las celdas que empiezan con `=`, `+`, `-` o `@`.
