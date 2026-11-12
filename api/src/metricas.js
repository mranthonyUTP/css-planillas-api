// HU-17: métricas de la API en memoria, expuestas en formato Prometheus (GET /metricas).
// Sin dependencias externas. Guarda contadores por ruta y estado, un histograma de latencia
// y cubos por minuto para evaluar alertas sobre una ventana reciente (ver alertas.js).
const BORDES_SEGUNDOS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const MINUTO = 60_000;

export function crearMetricas({ ahora = () => Date.now() } = {}) {
  const inicio = ahora();
  const solicitudes = new Map(); // "METODO|ruta|clase" -> n
  const histograma = new Array(BORDES_SEGUNDOS.length + 1).fill(0);
  let sumaSegundos = 0;
  let total = 0;
  const cubos = new Map(); // minuto -> { total, errores, ms }

  function registrar({ metodo, ruta, estado, ms }) {
    const clave = `${metodo}|${ruta}|${Math.floor(estado / 100)}xx`;
    solicitudes.set(clave, (solicitudes.get(clave) ?? 0) + 1);
    const segundos = ms / 1000;
    const i = BORDES_SEGUNDOS.findIndex((b) => segundos <= b);
    histograma[i === -1 ? BORDES_SEGUNDOS.length : i]++;
    sumaSegundos += segundos;
    total++;

    const minuto = Math.floor(ahora() / MINUTO);
    const cubo = cubos.get(minuto) ?? { total: 0, errores: 0, ms: 0 };
    cubo.total++;
    cubo.ms += ms;
    if (estado >= 500) cubo.errores++;
    cubos.set(minuto, cubo);
    for (const m of cubos.keys()) if (m < minuto - 60) cubos.delete(m);
  }

  // Resumen de los últimos `minutos` minutos, para las alertas.
  function ventana(minutos = 5) {
    const desde = Math.floor(ahora() / MINUTO) - minutos + 1;
    let t = 0;
    let errores = 0;
    let ms = 0;
    for (const [m, c] of cubos) {
      if (m >= desde) {
        t += c.total;
        errores += c.errores;
        ms += c.ms;
      }
    }
    return { solicitudes: t, errores, tasaError: t ? errores / t : 0, latenciaMediaMs: t ? ms / t : 0 };
  }

  function middleware(req, res, next) {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      // Se usa la ruta declarada (no la URL) para no crear una serie por cada valor distinto.
      registrar({ metodo: req.method, ruta: req.route?.path ?? 'no_encontrada', estado: res.statusCode, ms: Number(process.hrtime.bigint() - t0) / 1e6 });
    });
    next();
  }

  function exponer({ almacenamiento } = {}) {
    const l = [];
    l.push('# HELP planillas_uptime_segundos Tiempo que lleva activo el servicio.', '# TYPE planillas_uptime_segundos gauge');
    l.push(`planillas_uptime_segundos ${Math.round((ahora() - inicio) / 1000)}`);
    if (almacenamiento) {
      l.push('# HELP planillas_info Almacenamiento en uso.', '# TYPE planillas_info gauge', `planillas_info{almacenamiento="${almacenamiento}"} 1`);
    }
    l.push('# HELP planillas_http_solicitudes_total Solicitudes por método, ruta y clase de estado.', '# TYPE planillas_http_solicitudes_total counter');
    for (const [clave, n] of solicitudes) {
      const [metodo, ruta, clase] = clave.split('|');
      l.push(`planillas_http_solicitudes_total{metodo="${metodo}",ruta="${ruta}",estado="${clase}"} ${n}`);
    }
    l.push('# HELP planillas_http_duracion_segundos Latencia de las solicitudes.', '# TYPE planillas_http_duracion_segundos histogram');
    let acumulado = 0;
    BORDES_SEGUNDOS.forEach((b, i) => {
      acumulado += histograma[i];
      l.push(`planillas_http_duracion_segundos_bucket{le="${b}"} ${acumulado}`);
    });
    l.push(`planillas_http_duracion_segundos_bucket{le="+Inf"} ${total}`);
    l.push(`planillas_http_duracion_segundos_sum ${sumaSegundos.toFixed(6)}`);
    l.push(`planillas_http_duracion_segundos_count ${total}`);
    return `${l.join('\n')}\n`;
  }

  return { registrar, ventana, middleware, exponer };
}
