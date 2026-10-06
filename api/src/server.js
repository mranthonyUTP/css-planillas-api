import pino from 'pino';
import { config, validarConfig } from './config.js';
import { crearApp } from './app.js';
import { crearStoreMemoria } from './store/memoria.js';
import { crearStorePostgres } from './store/postgres.js';

validarConfig();
const logger = pino({ level: config.nivelLog });
const store = config.databaseUrl ? await crearStorePostgres(config.databaseUrl) : crearStoreMemoria();
const app = crearApp({ store, logger });

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
