# Portal de revisión de planillas

Portal React y API para prevalidar planillas, contrastar presencia de trabajadores y sueldo con una referencia aportada y conservar correcciones por intento.

Es un prototipo académico. No presenta ni paga planillas ante la CSS, no consulta registros oficiales y no calcula cuotas o impuestos.

## Abrirlo en Windows

Requiere Node.js 22.12 o posterior. Extrae la carpeta completa: `web`, `api` y `shared` deben permanecer juntas.

Desde una terminal en la carpeta del proyecto:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

Abre la dirección que muestre Vite, normalmente http://localhost:5173. El modo de demostración funciona sin API ni base de datos y lee archivos XLSX o CSV.

## Accesos de demostración

Contraseña de todas las cuentas: `demo1234`.

| Usuario | Rol | Empresas |
|---|---|---|
| ana.contabilidad (alias elaborador) | Empleador | 155123456-2-2020 |
| empresa.dos | Empleador | 155987654-1-2021 |

Para el recorrido principal utiliza el RUC `155123456-2-2020`. Los botones de demostración del ingreso rellenan los datos de cada empresa. Usa el mismo navegador y dirección para recorrerlos: la demostración conserva datos en el almacenamiento local del dispositivo, no los comparte entre computadoras ni aplica seguridad productiva.

## Recorrido

1. El empleador carga el ejemplo con errores y revisa la observación de Horas extras en Ana Ríos.
2. Desde esa revisión elige Cargar archivo corregido y utiliza el ejemplo corregido. Es un nuevo intento de la misma planilla.
3. Desde el historial consulta los intentos y compara los campos, altas y bajas. Los trabajadores se relacionan por identidad, no por fila o nombre.
4. Adjunta opcionalmente una nómina de referencia del mismo período. Se comparan presencia y sueldo por documento, sin verificar su exactitud real.
5. Revisa las diferencias y corrige en el origen. Las identidades ambiguas impiden contrastar; una diferencia no se considera automáticamente un error.

Cada carga nueva crea una serie. Las correcciones incluyen su `serieId`, conservan empresa, período y tipo y agregan otro intento. Cada intento guarda su propio contraste. La referencia debe adjuntarse de nuevo si se quiere repetir el contraste.

Los resultados automáticos distinguen observaciones de formato, contraste no disponible, ausencia de referencia, diferencias para revisar y coincidencia de presencia y sueldo. Coincidir con la referencia no certifica la corrección de los datos ni la aceptación de la CSS.

## Archivos

- La plantilla de 25 columnas sigue la referencia del manual aportado de 2019: cinco campos de identificación y veinte rubros. No acredita compatibilidad vigente con SIPE en 2026.
- El formato anterior de cinco columnas sigue disponible: cedula, nombre, salario, dias_laborados y codigo_ocupacion. Sus reglas y catálogo son de ejemplo. Los días y ocupación se conservan y se comparan.
- Se lee la primera hoja del libro. Límite técnico: 5 MB y 10 000 registros; no es un límite atribuido a la CSS.
- Los identificadores y valores recibidos se conservan como texto, distinguiendo vacío, cero e inválido. La suma de sueldos indica si es parcial y no representa cuotas ni costo patronal.

## API local

En otra terminal, desde el proyecto:

```powershell
cd api
npm.cmd install
npm.cmd start
```

Escucha en http://localhost:3000. Sin `DATABASE_URL` guarda en memoria y pierde datos al reiniciar; con esa variable utiliza PostgreSQL. Las variables de `api/.env.example` deben definirse en el entorno del proceso.

Para conectar el portal, reinicia Vite desde `web`:

```powershell
$env:VITE_API_URL = "http://localhost:3000"
npm.cmd run dev
```

La API resuelve la empresa desde la cuenta del servidor o claims firmados y aísla sus planillas. El piloto usa una cuenta de demostración; una identidad de servicio productiva queda pendiente. No hay presentación oficial ante la CSS.

Desde la raíz, `node api/scripts/piloto-contraste.js` ejecuta el ejemplo de integración contra la API local: crea una planilla sintética con tres diferencias y una corrección en la misma serie.

La migración PostgreSQL es aditiva. Conserva las tablas antiguas, pero no importa automáticamente los resúmenes anteriores al historial nuevo ni reconstruye trabajadores que nunca fueron almacenados.

En producción la API exige configurar OIDC con emisor, audiencia, roles y empresas. La validación JWKS corresponde a un emisor compatible con Keycloak. El frontend todavía no implementa SSO. El login local de demostración se bloquea con NODE_ENV=production. Los archivos de publicación requieren configurar y verificar ese acceso antes de utilizarlos.

## Comprobaciones

Desde `api`: `npm.cmd test`. Desde `web`: `npm.cmd test` y `npm.cmd run build`. La variable `TEST_DATABASE_URL` permite ejecutar también las pruebas de almacenamiento PostgreSQL y concurrencia. El módulo compartido contiene las verificaciones del formato de referencia y la comparación.

`docs/` conserva contexto de investigación que puede describir el alcance anterior. El contrato de las rutas actuales está en `api/openapi.yaml`.
