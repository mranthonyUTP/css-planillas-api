# El problema que resolvemos

> Prototipo académico (UTP, Panamá). No es un sistema oficial de la Caja de Seguro Social (CSS).
> Fuente: [`producto/mvp-portal-planillas.pdf`](producto/mvp-portal-planillas.pdf), octubre de 2026.

## Enunciado

Hoy los empleadores en Panamá preparan su planilla de seguridad social y la envían a la CSS **sin una forma
pública y automática de revisarla antes**. Los errores se descubren tarde, cuando la planilla ya fue enviada, y
corregirlos cuesta tiempo. Mi Caja Digital permite pagar en línea, pero no existe una API abierta de validación
previa.

## Objetivo del MVP

Que un empleador pueda **iniciar sesión, cargar su planilla, ver sus errores con fila y motivo, corregirlos y
enviarla oficialmente con un comprobante**, todo de forma segura y con trazabilidad.

## Alcance

| Incluye (Sprints 0 a 2, 63 pts) | No incluye (Sprint 3, hoja de ruta) |
|---|---|
| Pre-validación sin envío (dry-run) | Límite de peticiones por empresa (HU-13) |
| Reporte de errores por fila, campo y motivo | Feature flags para cambios normativos (HU-14) |
| Inicio de sesión OAuth2 por empresa | Escaneo de seguridad con OWASP ZAP en el pipeline (HU-15) |
| Envío oficial con número de confirmación | Monitoreo, métricas y alertas (HU-17) |
| Sin duplicados y con log de auditoría | |
| CI, pruebas y despliegue automático a staging | |

> Nota: HU-14 y HU-17 ya se implementaron después de redactar el documento del MVP. El estado actual está en el
> [README](../README.md) y en [`trazabilidad.md`](trazabilidad.md).

## Usuarios

- **Empleador:** carga, corrige y envía su planilla.
- **Integrador:** conecta el sistema de nómina de su empresa a la API.
- **Auditor de la CSS:** consulta quién envió qué y cuándo.

## Lo que se investigó sobre Mi Caja Digital

Con fuentes públicas:

- Portal oficial: `micajadigital.css.gob.pa`, opción "Paga tu Planilla 24/7".
- Hubo problemas de estabilidad en el lanzamiento (enero de 2025).
- Sistema anterior: SIPE (`sipe.css.gob.pa`), con firma digital, planilla preelaborada y rol "Elaborador". Hay
  reportes de que sería eliminado, sin confirmar.

## Lo que no se pudo confirmar

- Manual de usuario para empleadores.
- Catálogo oficial de errores de carga.
- Sandbox o API pública.
- Formato oficial del archivo de planilla.

Por eso las reglas de validación son **de ejemplo** y están marcadas como pendientes en
[`errores-frecuentes.md`](errores-frecuentes.md).

## Siguientes pasos

1. Pedir a la CSS el manual del patrono y el formato de la planilla preelaborada (alimenta HU-01 y HU-09).
2. Entrevistar a un contador o encargado de RR.HH. para obtener rechazos reales.
3. Marcar en `errores-frecuentes.md` qué reglas son supuestos y cuáles están confirmadas.
