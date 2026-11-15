# Documentación

Si eres del equipo nuevo, lee en este orden:

| # | Documento | Para qué |
|---|---|---|
| 1 | [`problema.md`](problema.md) | Qué problema resolvemos, el objetivo y el alcance del MVP |
| 2 | [`tutorial/tutorial.html`](tutorial/tutorial.html) | Recorrido interactivo del problema y del flujo (ábrelo en el navegador) |
| 3 | [`../README.md`](../README.md) | Cómo instalar, ejecutar y probar el proyecto |
| 4 | [`producto/`](producto/) | Material de diseño del MVP (ver abajo) |
| 5 | [`trazabilidad.md`](trazabilidad.md) | Historia de usuario → sprint → código → pruebas |

## Material de producto (`producto/`)

| Archivo | Contenido |
|---|---|
| `mvp-portal-planillas.pdf` | Documento del MVP: problema, alcance, tecnologías, plan por sprints e historias |
| `historias-de-usuario.pdf` | Las 15 historias de usuario en 4 sprints (79 pts) |
| `pantallas-portal.pdf` | Diseño de las 6 pantallas del portal |
| `flujo-funcional.html` | Diagrama del flujo: recepción, validación, aprobación, procesamiento y auditoría (ábrelo en el navegador) |

Son documentos de octubre de 2026. Para el **estado actual** manda el README y `trazabilidad.md`.

## Documentos técnicos

| Archivo | HU | Contenido |
|---|---|---|
| [`errores-frecuentes.md`](errores-frecuentes.md) | HU-01 | Errores frecuentes en las planillas y su regla de validación (supuestos por confirmar) |
| [`modelo-amenazas.md`](modelo-amenazas.md) | HU-03 | Modelo de amenazas según OWASP API Security Top 10 (2023) |
| [`trazabilidad.md`](trazabilidad.md) | todas | Matriz de trazabilidad por sprint |

## Convenciones del equipo

- Una historia de usuario es una sola tarea; pon su ID (`HU-05`) en commits y PRs.
- Commits en español, en modo imperativo y cortos.
- Al cerrar una HU, actualiza su fila en `trazabilidad.md` en el mismo PR.
- Las reglas de validación están duplicadas en `api/src/validacion/reglas.js` y `web/src/validacion/reglas.js`:
  si cambias una, cambia la otra.
- No usar Jest ni Supertest: las pruebas son `node --test` y Katalon.
