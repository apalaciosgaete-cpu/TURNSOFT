-- Tratamiento de datos personales: aceptación por la empresa (responsable) del
-- encargo de tratamiento a TURNSOFT. Se versiona el texto para poder pedir una
-- nueva aceptación cuando cambie.

BEGIN;

CREATE TABLE IF NOT EXISTS aceptaciones_datos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    version VARCHAR(20) NOT NULL,
    nombre_firmante VARCHAR(200) NOT NULL,
    cargo VARCHAR(120) NOT NULL,
    email_privacidad VARCHAR(200) NOT NULL,
    ip VARCHAR(160),
    user_agent VARCHAR(300),
    aceptado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aceptaciones_datos_empresa
    ON aceptaciones_datos (empresa_id, version);

ALTER TABLE aceptaciones_datos ENABLE ROW LEVEL SECURITY;

COMMIT;
