# css-planillas-api

API de validación de planillas para la Caja de Seguro Social. Valida y procesa archivos de nómina según
especificaciones CSS antes de su envío oficial.

> Prototipo académico. No es un sistema oficial de la CSS.

## Qué hay en este repositorio

| Carpeta | Contenido | Estado |
|---|---|---|
| `web/` | Portal de Planillas: React + Vite, con las 6 pantallas del MVP | Listo, con API simulada |
| `api/` | API en Node.js + Express | Pendiente |
| `CLAUDE.md` | Contexto del proyecto: historias de usuario, tecnologías, contrato de API y diseño | — |

## Probar el portal

Requiere Node.js 20 o superior.

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:5173. En el modo de demostración, cualquier RUC, usuario y contraseña sirven.
Para probar la validación, descarga desde la pantalla "Cargar planilla" la plantilla o el ejemplo con errores.

```bash
npm test        # pruebas de las reglas de validación (node --test)
npm run build   # build de producción en web/dist
```

## Flujo del empleador

1. **Iniciar sesión** (HU-07)
2. **Cargar planilla** en modo de pre-validación (HU-04, HU-05)
3. **Revisar errores** por fila, campo y motivo, con descarga en CSV (HU-06)
4. **Confirmar el envío oficial**, protegido con una clave de idempotencia (HU-08, HU-12)
5. **Comprobante** con número de confirmación (HU-12)
6. **Historial de cargas** con filtros (HU-11)

## Tecnologías

JavaScript (Node.js + React), SonarQube, Katalon Studio y OWASP ZAP. El detalle está en `CLAUDE.md`.
