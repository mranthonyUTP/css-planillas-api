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

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIPOS = new Set(['Regular', 'Complementaria', 'Corrección']);
const CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function tokenValido(cabecera, esperado) {
  const a = Buffer.from(cabecera), b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
const detallePublico = (serie) => ({ ...resumirSerie(serie), intentos: serie.intentos, comprobante: serie.comprobante,
  eventos: serie.eventos.map(({ clave, huella, ...evento }) => evento) });
const exigirUuid = (valor, mensaje) => { if (typeof valor !== 'string' || !UUID.test(valor)) throw solicitudInvalida(mensaje); };

export function crearApp({ store, logger, reglasDesactivadas = config.reglasDesactivadas, metricas = crearMetricas(), tokenMetricas = config.metricasToken }) {
  const activas = reglasActivas(reglasDesactivadas), app = express();
  app.disable('x-powered-by'); app.set('trust proxy', 1); app.use(metricas.middleware); app.use(helmet());
  app.use(cors({ origin: config.origenesPermitidos, allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] }));
  app.use(express.json({ limit: '10kb' }));
  if (logger) app.use(pinoHttp({ logger, redact: ['req.headers.authorization'], genReqId: (req) => req.get('x-request-id') ?? randomUUID() }));
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.tamanoMaximoMb * 1024 * 1024, files: 1, fields: 5 } });
  app.get('/salud', (_req, res) => res.json({ estado: 'ok', almacenamiento: store.tipo }));
  app.get('/metricas', (req, res, next) => {
    if (!tokenMetricas) return next(noEncontrado('Ruta no encontrada.'));
    if (!tokenValido(req.get('authorization') ?? '', tokenMetricas)) throw noAutorizado('Token de métricas inválido.');
    res.type('text/plain; version=0.0.4').send(metricas.exponer({ almacenamiento: store.tipo }));
  });
  app.post('/auth/login', login);
  app.get('/reglas', requiereAuth, (_req, res) => res.json(Object.entries(NOMBRES_CAMPO).map(([id, campo]) => ({ id, campo, activa: activas.has(id) }))));
  app.post('/planillas/validar', requiereAuth, requiereRol('ELABORADOR'), subida.single('archivo'), async (req, res) => {
    const { periodo, tipo, serieId } = req.body ?? {};
    if (!req.file) throw solicitudInvalida('Adjunta el archivo de la planilla en el campo "archivo".');
    if (!PERIODO.test(periodo ?? '')) throw solicitudInvalida('El período debe tener el formato AAAA-MM.');
    if (!TIPOS.has(tipo)) throw solicitudInvalida('El tipo debe ser Regular, Complementaria o Corrección.');
    if (serieId) exigirUuid(serieId, 'La serie de la corrección no es válida.');
    const archivo = req.file.originalname.slice(0, 200);
    const resultado = validarPlanilla(await leerPlanilla(archivo, req.file.buffer), activas);
    const intento = { ...resultado, id: randomUUID(), empresaRuc: req.usuario.ruc, empresaNombre: req.usuario.empresa,
      usuario: req.usuario.usuario, archivo, periodo, tipo, totalSalarios: Math.round(resultado.totalSalarios * 100) / 100,
      valida: resultado.errores.length === 0, validadaEn: new Date().toISOString(),
      formato: resultado.formato ?? 'demo-5-columnas', trabajadores: resultado.trabajadores ?? [] };
    res.json(await store.guardarIntento({ serieId: serieId || undefined, intento }));
  });
  app.get('/planillas', requiereAuth, async (req, res) => {
    const { actividad } = req.query;
    if (actividad !== undefined && actividad !== 'propia') throw solicitudInvalida('El filtro de actividad debe ser propia.');
    let opciones;
    if (actividad === 'propia') {
      const { usuario, rol } = req.usuario;
      if (!['OPERADOR', 'AUTORIZADOR'].includes(rol)) throw new ErrorApi(403, 'La actividad propia corresponde al operador o autorizador.', 'sin_permiso');
      opciones = { actividadPropia: { usuario, rol } };
    }
    res.json(await store.listarPlanillas(rucsPermitidos(req.usuario), opciones));
  });
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
  const decidir = (accion, rol) => async (req, res) => {
    exigirUuid(req.params.id, 'El identificador de la planilla no es válido.');
    const { intentoId, decision, motivo = '' } = req.body ?? {};
    exigirUuid(intentoId, 'Selecciona el intento de la planilla.');
    const clave = req.get('idempotency-key') ?? '';
    if (!CLAVE_IDEMPOTENCIA.test(clave)) throw solicitudInvalida('Incluye Idempotency-Key válida (8 a 128 caracteres).');
    if (typeof motivo !== 'string' || motivo.length > 1000) throw solicitudInvalida('El motivo debe ser un texto de hasta 1000 caracteres.');
    if (accion !== 'solicitar' && ![accion === 'revisar' ? 'aprobar' : 'autorizar', 'devolver'].includes(decision)) throw solicitudInvalida('La decisión no es válida.');
    if (decision === 'devolver' && !motivo.trim()) throw solicitudInvalida('Indica el motivo de la devolución.');
    const serie = await store.decidirPlanilla({ id: req.params.id, rucs: rucsPermitidos(req.usuario), intentoId,
      accion, decision, motivo: motivo.trim(), usuario: req.usuario.usuario, rol, clave });
    res.json(detallePublico(serie));
  };
  app.post('/planillas/:id/solicitar-revision', requiereAuth, requiereRol('ELABORADOR'), decidir('solicitar', 'ELABORADOR'));
  app.post('/planillas/:id/revisar', requiereAuth, requiereRol('OPERADOR'), decidir('revisar', 'OPERADOR'));
  app.post('/planillas/:id/autorizar', requiereAuth, requiereRol('AUTORIZADOR'), decidir('autorizar', 'AUTORIZADOR'));
  app.post('/planillas/enviar', requiereAuth, (_req, _res) => {
    throw new ErrorApi(410, 'Usa el flujo de revisión y autorización interna. Este portal no presenta planillas ante la CSS.', 'flujo_reemplazado');
  });
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
