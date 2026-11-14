# Resumen de la sesión

Fecha: 2026-11-13 · Rama: `docs/trazabilidad`

## 1. Onboarding del equipo nuevo

Se explicó el proyecto a un equipo que lo recibe completo:

- **Problema:** Mi Caja Digital permite pagar la planilla, pero no pre-validarla. El portal y la API validan antes de enviar.
- **Estructura:** `/web` (React + Vite), `/api` (Node + Express 5), `/docs`, `.github/workflows`, `docker-compose.yml` y `render.yaml`.
- **Cómo levantarlo:** `docker compose up --build` (API), `npm run dev` en `web` (modo simulado), y `npm test` en ambas carpetas.
- **Flujo:** login, validar, enviar (con `Idempotency-Key`), historial. Son 6 pantallas.
- **Lo que hay que cuidar:**
  - Las reglas están duplicadas en `api/src/validacion/reglas.js` y `web/src/validacion/reglas.js`. Si cambia una, cambie la otra.
  - No usar Jest ni Supertest. Las pruebas usan `node --test` y Katalon.
  - OWASP ZAP reemplazó a Aircrack-ng.
- **Convenciones:** una HU por tarea, ID de la HU en commits y PRs, commits en español e imperativo, y actualizar `docs/trazabilidad.md` al cerrar una HU.

## 2. Investigación sobre Mi Caja Digital

**Lo que se encontró (fuentes públicas):**

- Portal oficial: `micajadigital.css.gob.pa`. Opción "Paga tu Planilla 24/7".
- Hubo problemas de estabilidad en el lanzamiento (enero de 2025).
- Sistema anterior: SIPE (`sipe.css.gob.pa`), con firma digital, planilla preelaborada y rol "Elaborador". Hay reportes de que sería eliminado, sin confirmar.

**Lo que no se encontró:**

- Manual de usuario para empleadores.
- Catálogo oficial de errores de carga (flujo incorrecto).
- Sandbox o API pública.
- Formato oficial del archivo de planilla.

**Siguientes pasos sugeridos:**

1. Pedir a la CSS el manual del patrono y el formato de la planilla preelaborada (alimenta HU-01 y HU-09).
2. Entrevistar a un contador o encargado de RR.HH. para obtener rechazos reales.
3. Marcar en `docs/errores-frecuentes.md` qué reglas son supuestos y cuáles están confirmadas.

## 3. Tutorial interactivo

Se creó `docs/tutorial/` con HTML, CSS y JavaScript puros, sin dependencias y sin internet:

| Archivo | Uso |
|---|---|
| `tutorial.html` | **Un solo archivo** con `<style>` y `<script>` integrados. Es el que se comparte y el único que se conserva. |

Contenido en 4 pestañas:

1. **El problema:** animación del proceso de hoy frente al del portal.
2. **El flujo:** un teléfono dibujado en CSS recorre las 6 pantallas.
3. **Pruébalo:** demo de validación con una planilla correcta y otra con errores. Usa las mismas reglas que `reglas.js`.
4. **Tu equipo:** lista de primeros pasos (se guarda en el navegador) y 4 recordatorios clave.

Funciona en teléfono y computadora. Los botones miden al menos 44 px y respeta la opción de reducir animaciones.

> La versión separada (`index.html`, `estilos.css`, `app.js`) ya no está en el repo; se edita directamente `tutorial.html`.

## 4. Pendientes

- Las reglas de validación siguen siendo de ejemplo. Falta confirmarlas con la normativa de la CSS (HU-01).
- No se probó el tutorial en un navegador. Solo se verificó la sintaxis del JavaScript (sin errores) y que no cargue recursos externos.
