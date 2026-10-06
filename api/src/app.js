import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { login, requiereAuth } from './auth.js';
import { ErrorApi, solicitudInvalida, noEncontrado } from './errores.js';
import { leerPlanilla } from './validacion/lector.js';
import { validarPlanilla } from './validacion/reglas.js';

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIPOS = new Set(['Regular', 'Complementaria']);
const CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quita datos internos antes de responder.
const publica = ({ empresaRuc, usuario, ...v }) => v;

export function crearApp({ store, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.origenesPermitidos, allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] }));
  app.use(express.json({ limit: '10kb' }));
  if (logger) {
    app.use(pinoHttp({ logger, redact: ['req.headers.authorization'], genReqId: (req) => req.get('x-request-id') ?? randomUUID() }));
  }

  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.tamanoMaximoMb * 1024 * 1024, files: 1, fields: 5 },
  });

  app.get('/salud', (_req, res) => res.json({ estado: 'ok', almacenamiento: store.tipo }));

  // HU-07
  app.post('/auth/login', login);

  // HU-05 y HU-06: pre-validación. No registra la planilla, solo la auditoría de la carga.
  app.post('/planillas/validar', requiereAuth, subida.single('archivo'), async (req, res) => {
    const { periodo, tipo } = req.body ?? {};
    if (!req.file) throw solicitudInvalida('Adjunta el archivo de la planilla en el campo "archivo".');
    if (!PERIODO.test(periodo ?? '')) throw solicitudInvalida('El período debe tener el formato AAAA-MM.');
    if (!TIPOS.has(tipo)) throw solicitudInvalida('El tipo de planilla debe ser Regular o Complementaria.');

    const archivo = req.file.originalname.slice(0, 200);
    const resultado = validarPlanilla(await leerPlanilla(archivo, req.file.buffer));
    const validacion = {
      id: randomUUID(),
      empresaRuc: req.usuario.ruc,
      usuario: req.usuario.usuario,
      archivo,
      periodo,
      tipo,
      filas: resultado.filas,
      filasConError: resultado.filasConError,
      totalSalarios: Math.round(resultado.totalSalarios * 100) / 100,
      errores: resultado.errores,
      valida: resultado.errores.length === 0,
      validadaEn: new Date().toISOString(),
    };
    await store.guardarValidacion(validacion);
    await store.registrarCarga({
      empresaRuc: req.usuario.ruc,
      usuario: req.usuario.usuario,
      periodo,
      archivo,
      tipo: 'Pre-validación',
      resultado: validacion.valida ? 'Sin errores' : 'Con errores',
    });
    res.json(publica(validacion));
  });

  // HU-08 y HU-12: envío oficial con clave de idempotencia.
  app.post('/planillas/enviar', requiereAuth, async (req, res) => {
    const clave = req.get('idempotency-key') ?? '';
    const { validacionId } = req.body ?? {};
    if (!CLAVE_IDEMPOTENCIA.test(clave)) {
      throw solicitudInvalida('Falta la cabecera Idempotency-Key o no es válida (8 a 128 caracteres).');
    }
    if (!UUID.test(validacionId ?? '')) throw solicitudInvalida('Falta el identificador de la validación.');

    const { ruc, usuario } = req.usuario;
    const previo = await store.buscarEnvio(ruc, clave);
    if (previo && previo.validacionId !== validacionId) {
      throw new ErrorApi(422, 'Esta clave de idempotencia ya se usó para otra planilla.', 'clave_reutilizada');
    }

    // Solo se consultan validaciones de la propia empresa (evita acceso a objetos ajenos).
    const validacion = await store.obtenerValidacion(validacionId, ruc);
    if (!validacion) throw noEncontrado('No encontramos esa validación.');
    if (!validacion.valida) {
      throw new ErrorApi(409, 'Solo se pueden enviar planillas que pasaron la pre-validación.', 'no_valida');
    }

    const { envio, repetido } = await store.crearEnvio({ ruc, clave, validacion, usuario, periodo: validacion.periodo });
    if (!repetido) {
      await store.registrarCarga({
        empresaRuc: ruc,
        usuario,
        periodo: validacion.periodo,
        archivo: validacion.archivo,
        tipo: 'Envío oficial',
        resultado: 'Enviada',
        confirmacion: envio.confirmacion,
      });
    }
    res.status(repetido ? 200 : 201).json({
      confirmacion: envio.confirmacion,
      enviadoEn: envio.enviadoEn,
      enviadoPor: envio.enviadoPor,
      validacion: publica(validacion),
      repetido,
    });
  });

  // HU-11: historial y auditoría de la empresa.
  app.get('/cargas', requiereAuth, async (req, res) => {
    res.json(await store.listarCargas(req.usuario.ruc));
  });

  app.use((_req, _res, next) => next(noEncontrado('Ruta no encontrada.')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? `El archivo supera ${config.tamanoMaximoMb} MB.` : 'La carga del archivo no es válida.';
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ mensaje, codigo: err.code });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ mensaje: 'El cuerpo de la solicitud no es JSON válido.', codigo: 'json_invalido' });
    }
    if (err instanceof ErrorApi) return res.status(err.estado).json({ mensaje: err.message, codigo: err.codigo });
    req.log?.error({ err }, 'Error no controlado');
    res.status(500).json({ mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.', codigo: 'error_interno' });
  });

  return app;
}
