-- Esquema de PostgreSQL. Se aplica al iniciar la API (idempotente).

CREATE TABLE IF NOT EXISTS validaciones (
  id              uuid PRIMARY KEY,
  empresa_ruc     text        NOT NULL,
  usuario         text        NOT NULL,
  archivo         text        NOT NULL,
  periodo         char(7)     NOT NULL,
  tipo            text        NOT NULL,
  filas           integer     NOT NULL,
  filas_con_error integer     NOT NULL,
  total_salarios  numeric(14,2) NOT NULL,
  errores         jsonb       NOT NULL,
  valida          boolean     NOT NULL,
  validada_en     timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS confirmaciones_seq;

-- HU-08: la misma clave de idempotencia de la misma empresa nunca crea dos envíos,
-- y una validación solo puede enviarse una vez.
CREATE TABLE IF NOT EXISTS envios (
  id               uuid PRIMARY KEY,
  empresa_ruc      text        NOT NULL,
  idempotency_key  text        NOT NULL,
  validacion_id    uuid        NOT NULL REFERENCES validaciones(id),
  confirmacion     text        NOT NULL UNIQUE,
  enviado_por      text        NOT NULL,
  enviado_en       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_ruc, idempotency_key),
  UNIQUE (validacion_id)
);

-- HU-11: log de auditoría de cada carga.
CREATE TABLE IF NOT EXISTS cargas (
  id            uuid PRIMARY KEY,
  empresa_ruc   text        NOT NULL,
  usuario       text        NOT NULL,
  fecha         timestamptz NOT NULL DEFAULT now(),
  periodo       char(7)     NOT NULL,
  archivo       text        NOT NULL,
  tipo          text        NOT NULL,
  resultado     text        NOT NULL,
  confirmacion  text
);

CREATE INDEX IF NOT EXISTS cargas_empresa_fecha ON cargas (empresa_ruc, fecha DESC);
