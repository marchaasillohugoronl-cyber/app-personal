-- Ejecutar en Neon SQL Editor una sola vez
CREATE TABLE IF NOT EXISTS tareas (
  id          SERIAL PRIMARY KEY,
  titulo      TEXT        NOT NULL,
  descripcion TEXT,
  fecha_limite TIMESTAMPTZ,
  prioridad   TEXT        NOT NULL DEFAULT 'normal'
                CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  completada  BOOLEAN     NOT NULL DEFAULT FALSE,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tareas_completada ON tareas (completada);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha      ON tareas (fecha_limite);

-- Biblioteca de música (catálogo cloud, archivos viven en el laptop)
CREATE TABLE IF NOT EXISTS canciones (
  id            SERIAL PRIMARY KEY,
  titulo        TEXT        NOT NULL,
  artista       TEXT        NOT NULL DEFAULT 'Desconocido',
  busqueda      TEXT        NOT NULL,
  descargada    BOOLEAN     NOT NULL DEFAULT FALSE,
  url_youtube   TEXT,
  duracion_seg  INTEGER,
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  descargada_en TIMESTAMPTZ,
  -- Comando enviado desde el teléfono al laptop ('play','stop','delete',NULL)
  accion        TEXT        CHECK (accion IN ('play','stop','delete')),
  -- URL del servidor local del laptop (streaming en misma red WiFi)
  url_local     TEXT
);

-- Migración: ejecutar si la tabla ya existe
-- ALTER TABLE canciones ADD COLUMN IF NOT EXISTS url_local TEXT;

CREATE INDEX IF NOT EXISTS idx_canciones_descargada ON canciones (descargada);
CREATE INDEX IF NOT EXISTS idx_canciones_accion     ON canciones (accion)    WHERE accion IS NOT NULL;
