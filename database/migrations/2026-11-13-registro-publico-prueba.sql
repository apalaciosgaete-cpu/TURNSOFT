-- Registro público de empresas, prueba de 15 días y horarios base por empresa.
-- El supervisor maestro deja de crear empresas: solo supervisa la ocupación,
-- los pagos, los planes y el soporte.

BEGIN;

-- Datos de contacto que completa la empresa en su registro público.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(200);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100);

-- Ciclo de vida de la prueba y origen del alta.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS prueba_inicio TIMESTAMP;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS prueba_fin TIMESTAMP;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS activada_en TIMESTAMP;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'supervisor';

-- Estados permitidos: prueba, activa, suspendida y vencida.
ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_estado_check;
ALTER TABLE empresas
    ADD CONSTRAINT empresas_estado_check
    CHECK (estado IN ('prueba', 'activa', 'suspendida', 'vencida'));

CREATE INDEX IF NOT EXISTS idx_empresas_estado_prueba ON empresas (estado, prueba_fin);

-- Los horarios de entrada/salida de la empresa son privados de cada tenant.
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS empresa_id UUID;
CREATE INDEX IF NOT EXISTS idx_turno_plantillas_empresa ON turno_plantillas (empresa_id);

DO $$
BEGIN
    ALTER TABLE turno_plantillas
        ADD CONSTRAINT turno_plantillas_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
