import { randomUUID, timingSafeEqual } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { login, requiereAuth, requiereRol, rucsPermitidos } from './auth.js';
import { ErrorApi, solicitudInvalida, noEncontrado, noAutorizado } from './errores.js';
import { leerPlanilla } from './validacion/lector.js';
import { validarPlanilla, NOMBRES_CAMPO } from './validacion/reglas.js';
import { reglasActivas } from './validacion/flags.js';
import { crearMetricas } from './metricas.js';
import { resumirSerie } from './store/dominio.js';
import { compararIntentos } from '../../shared/planillas.js';
import { contrastarPlanilla } from '../../shared/contraste.js';
import { revisionesPublicas } from '../../shared/revision-operador.js';

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIPOS = new Set(['Regular', 'Complementaria', 'Corrección']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function tokenValido(cabecera, esperado) {
  const a = Buffer.from(cabecera), b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
const detallePublico = (serie) => ({ ...resumirSerie(serie), intentos: serie.intentos, revisionesInternas: revisionesPublicas(serie) });
const exigirUuid = (valor, mensaje) => { if (typeof valor !== 'string' || !UUID.test(valor)) throw solicitudInvalida(mensaje); };

export function crearApp({ store, logger, reglasDesactivadas = config.reglasDesactivadas, metricas = crearMetricas(), tokenMetricas = config.metricasToken }) {
  const activas = reglasActivas(reglasDesactivadas), app = express();
  app.disable('x-powered-by'); app.set('trust proxy', 1); app.use(metricas.middleware); app.use(helmet());
  app.use(cors({ origin: config.origenesPermitidos, allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] }));
  app.use(express.json({ limit: '10kb' }));
  if (logger) app.use(pinoHttp({ logger, redact: ['req.headers.authorization'], genReqId: (req) => req.get('x-request-id') ?? randomUUID() }));
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.tamanoMaximoMb * 1024 * 1024, files: 2, fields: 5 } });
  app.get('/salud', (_req, res) => res.json({ estado: 'ok', almacenamiento: store.tipo }));
  app.get('/metricas', (req, res, next) => {
    if (!tokenMetricas) return next(noEncontrado('Ruta no encontrada.'));
    if (!tokenValido(req.get('authorization') ?? '', tokenMetricas)) throw noAutorizado('Token de métricas inválido.');
    res.type('text/plain; version=0.0.4').send(metricas.exponer({ almacenamiento: store.tipo }));
  });
  app.post('/auth/login', login);
  app.get('/reglas', requiereAuth, (_req, res) => res.json(Object.entries(NOMBRES_CAMPO).map(([id, campo]) => ({ id, campo, activa: activas.has(id) }))));
  app.post('/planillas/validar', requiereAuth, requiereRol('ELABORADOR'), subida.fields([{ name: 'archivo', maxCount: 1 }, { name: 'referencia', maxCount: 1 }]), async (req, res) => {
    const { periodo, tipo, serieId } = req.body ?? {};
    const principal = req.files?.archivo?.[0], referencia = req.files?.referencia?.[0];
    if (!principal) throw solicitudInvalida('Adjunta el archivo de la planilla en el campo "archivo".');
    if (!PERIODO.test(periodo ?? '')) throw solicitudInvalida('El período debe tener el formato AAAA-MM.');
    if (!TIPOS.has(tipo)) throw solicitudInvalida('El tipo debe ser Regular, Complementaria o Corrección.');
    if (serieId) exigirUuid(serieId, 'La serie de la corrección no es válida.');
    const archivo = principal.originalname.slice(0, 200);
    const resultado = validarPlanilla(await leerPlanilla(archivo, principal.buffer), activas);
    const contraste = contrastarPlanilla(resultado, referencia ? validarPlanilla(await leerPlanilla(referencia.originalname, referencia.buffer), activas) : undefined, referencia?.originalname.slice(0, 200));
    const intento = { ...resultado, contraste, id: randomUUID(), empresaRuc: req.usuario.ruc, empresaNombre: req.usuario.empresa,
      usuario: req.usuario.usuario, archivo, periodo, tipo, totalSalarios: Math.round(resultado.totalSalarios * 100) / 100,
      valida: resultado.errores.length === 0, validadaEn: new Date().toISOString(),
      formato: resultado.formato ?? 'demo-5-columnas', trabajadores: resultado.trabajadores ?? [] };
    res.json(await store.guardarIntento({ serieId: serieId || undefined, intento }));
  });
  app.get('/planillas', requiereAuth, async (req, res) => res.json(await store.listarPlanillas(rucsPermitidos(req.usuario))));
  const obtenerSerie = async (req) => {
    exigirUuid(req.params.id, 'El identificador de la planilla no es válido.');
    const serie = await store.obtenerPlanilla(req.params.id, rucsPermitidos(req.usuario));
    if (!serie) throw noEncontrado('No encontramos esa planilla.');
    return serie;
  };
  app.get('/planillas/:id/comparar', requiereAuth, async (req, res) => {
    const serie = await obtenerSerie(req), { anterior, actual } = req.query;
    exigirUuid(anterior, 'Selecciona el intento anterior.'); exigirUuid(actual, 'Selecciona el intento posterior.');
    const antes = serie.intentos.find((i) => i.id === anterior), despues = serie.intentos.find((i) => i.id === actual);
    if (!antes || !despues) throw noEncontrado('No encontramos esos intentos en esta planilla.');
    if (antes.numero >= despues.numero) throw solicitudInvalida('El primer intento debe ser anterior al posterior.');
    res.json(compararIntentos(antes, despues));
  });
  app.get('/planillas/:id', requiereAuth, async (req, res) => res.json(detallePublico(await obtenerSerie(req))));
  const revisar = (enviar) => async (req, res) => {
    exigirUuid(req.params.id, 'La planilla no es válida.');
    const { intentoId, decision, motivo = '' } = req.body ?? {};
    exigirUuid(intentoId, 'El intento no es válido.');
    if (!enviar && !['autorizar', 'devolver'].includes(decision)) throw solicitudInvalida('Selecciona autorizar o devolver.');
    try {
      const serie = await store.revisarOperador({ idSerie: req.params.id, rucs: rucsPermitidos(req.usuario), intentoId,
        accion: enviar ? 'enviar-operador' : `${decision}-operador`, motivo, usuario: req.usuario.usuario, rol: enviar ? 'ELABORADOR' : 'OPERADOR',
        clave: req.get('idempotency-key'), id: randomUUID(), fecha: new Date().toISOString() });
      res.json(detallePublico(serie));
    } catch (err) { if (err.estado) throw new ErrorApi(err.estado, err.message, err.codigo); throw err; }
  };
  app.post('/planillas/:id/enviar-operador', requiereAuth, requiereRol('ELABORADOR'), revisar(true));
  app.post('/planillas/:id/decision-operador', requiereAuth, requiereRol('OPERADOR'), revisar(false));
  app.get('/cargas', requiereAuth, async (req, res) => res.json(await store.listarCargas(rucsPermitidos(req.usuario))));
  app.use((_req, _res, next) => next(noEncontrado('Ruta no encontrada.')));
  app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? `El archivo supera ${config.tamanoMaximoMb} MB.` : 'La carga del archivo no es válida.';
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ mensaje, codigo: err.code });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ mensaje: 'El cuerpo de la solicitud no es JSON válido.', codigo: 'json_invalido' });
    if (err instanceof ErrorApi) return res.status(err.estado).json({ mensaje: err.message, codigo: err.codigo });
    req.log?.error({ err }, 'Error no controlado'); res.status(500).json({ mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.', codigo: 'error_interno' });
  });
  return app;
}
