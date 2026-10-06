# HU-01: errores frecuentes en las planillas

**Objetivo:** priorizar qué validar primero. Cada error de esta lista tiene una regla en
`api/src/validacion/reglas.js` y una prueba en `api/test/reglas.test.js` (HU-09).

> **Pendiente de confirmar.** La lista se armó con la estructura típica de una planilla de nómina y los errores
> más comunes al prepararla a mano o exportarla de un sistema contable. Antes de producción hay que contrastarla
> con la especificación oficial de la CSS (formato SIPE) y con planillas reales rechazadas. Las filas marcadas
> "Sí" ya están implementadas.

| # | Error | Campo | Ejemplo | Prioridad | Implementado |
|---|---|---|---|---|---|
| 1 | Falta una columna obligatoria | Encabezado | No existe la columna `salario` | Alta | Sí |
| 2 | Cédula vacía | Cédula | `(vacío)` | Alta | Sí |
| 3 | Cédula con formato inválido o incompleta | Cédula | `8-1234-`, `8123456` | Alta | Sí |
| 4 | Salario vacío | Salario | `(vacío)` | Alta | Sí |
| 5 | Salario con símbolo de moneda o separador de miles | Salario | `B/. 1,100.00` | Alta | Sí |
| 6 | Salario en cero o negativo | Salario | `0`, `-50` | Alta | Sí |
| 7 | Días laborados mayores que 31 o no enteros | Días laborados | `32`, `15.5` | Media | Sí |
| 8 | Código de ocupación inexistente en el catálogo | Código de ocupación | `X99` | Media | Sí (catálogo de ejemplo) |
| 9 | Nombre del trabajador vacío | Nombre | `(vacío)` | Media | Sí |
| 10 | Planilla sin trabajadores | Archivo | Solo el encabezado | Media | Sí |
| 11 | Archivo en un formato no admitido | Archivo | `.pdf`, `.xls` antiguo | Media | Sí |
| 12 | Trabajador repetido en la misma planilla | Cédula | La misma cédula dos veces | Media | No (Sprint 3) |
| 13 | Período de la planilla futuro o inválido | Período | `2026-13` | Baja | Parcial: valida el formato AAAA-MM |
| 14 | Salario por debajo del mínimo legal para la ocupación | Salario | Depende de la tabla vigente | Baja | No (requiere la tabla oficial) |

## Criterio de terminado

- [x] Lista priorizada de al menos 10 tipos de error.
- [x] Cada error implementado tiene un mensaje con el problema y cómo corregirlo.
- [ ] Revisada con la especificación oficial de la CSS.
