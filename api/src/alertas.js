// HU-17: alertas de la API. Evalúa las métricas de una ventana reciente y avisa cuando
// se superan los umbrales. Avisa una vez al activarse y otra al resolverse (no repite cada minuto).
// Destinos: el log (nivel warn/info con alerta=true) y, si existe ALERTA_WEBHOOK_URL, un POST JSON
// compatible con Slack y Discord ({ text, content }).

// Función pura: devuelve las alertas activas según la ventana y los umbrales.
export function evaluarAlertas(ventana, { tasaError, latenciaMs, minSolicitudes }) {
  if (ventana.solicitudes < minSolicitudes) return [];
  const activas = [];
  if (ventana.tasaError > tasaError) {
    activas.push({
      codigo: 'tasa_errores_alta',
      mensaje: `Errores 5xx en ${(ventana.tasaError * 100).toFixed(1)} % de las solicitudes (umbral ${(tasaError * 100).toFixed(1)} %).`,
    });
  }
  if (ventana.latenciaMediaMs > latenciaMs) {
    activas.push({
      codigo: 'latencia_alta',
      mensaje: `Latencia media de ${Math.round(ventana.latenciaMediaMs)} ms (umbral ${latenciaMs} ms).`,
    });
  }
  return activas;
}

export function crearVigilante({ metricas, logger, umbrales, webhookUrl = '', enviar = fetch, minutosVentana = 5 }) {
  let previas = new Set();

  async function avisar(texto) {
    if (!webhookUrl) return;
    try {
      await enviar(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto, content: texto }) });
    } catch (err) {
      logger?.error({ err }, 'No se pudo enviar la alerta al webhook');
    }
  }

  async function revisar() {
    const activas = evaluarAlertas(metricas.ventana(minutosVentana), umbrales);
    const codigos = new Set(activas.map((a) => a.codigo));
    for (const a of activas) {
      if (!previas.has(a.codigo)) {
        logger?.warn({ alerta: true, codigo: a.codigo }, a.mensaje);
        await avisar(`[Planillas API] ALERTA ${a.codigo}: ${a.mensaje}`);
      }
    }
    for (const codigo of previas) {
      if (!codigos.has(codigo)) {
        logger?.info({ alerta: true, codigo, resuelta: true }, `Alerta resuelta: ${codigo}`);
        await avisar(`[Planillas API] RESUELTA ${codigo}`);
      }
    }
    previas = codigos;
    return activas;
  }

  return { revisar };
}
