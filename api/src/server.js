import pino from 'pino';
import { config, validarConfig } from './config.js';
import { crearApp } from './app.js';
import { crearStoreMemoria } from './store/memoria.js';
import { crearStorePostgres } from './store/postgres.js';
import { crearMetricas } from './metricas.js';
import { crearVigilante } from './alertas.js';

validarConfig();
const logger = pino({ level: config.nivelLog });
const store = config.databaseUrl ? await crearStorePostgres(config.databaseUrl) : crearStoreMemoria();
const metricas = crearMetricas();
const app = crearApp({ store, logger, metricas });

// HU-17: revisa las alertas cada minuto.
const vigilante = crearVigilante({
  metricas,
  logger,
  webhookUrl: config.alertaWebhookUrl,
  umbrales: { tasaError: config.alertaTasaError, latenciaMs: config.alertaLatenciaMs, minSolicitudes: config.alertaMinSolicitudes },
});
const temporizador = setInterval(() => vigilante.revisar().catch((err) => logger.error({ err }, 'Falló la revisión de alertas')), 60_000);
temporizador.unref();

const servidor = app.listen(config.puerto, () => {
  logger.info({ puerto: config.puerto, almacenamiento: store.tipo, auth: config.authModo }, 'API de planillas lista');
});

const apagar = async (senal) => {
  logger.info({ senal }, 'Cerrando la API');
  servidor.close(async () => {
    await store.cerrar();
    process.exit(0);
  });
};
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
