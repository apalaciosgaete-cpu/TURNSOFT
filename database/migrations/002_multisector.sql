-- ============================================
-- TURNSOFT · Migración 002: motor multi-sector
-- Ejecutar sobre una base creada con schema.sql (versión security-only).
-- Es idempotente: puede correrse más de una vez sin duplicar columnas.
-- ============================================

BEGIN;

-- -----------------------------------------------------
-- Empresas: sector, régimen y autorización excepcional
-- -----------------------------------------------------
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sector VARCHAR(20) NOT NULL DEFAULT 'seguridad';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS regimen_jornada VARCHAR(20) NOT NULL DEFAULT 'ordinaria';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS autorizacion_excepcional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS referencia_autorizacion VARCHAR(200);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS notas TEXT;

ALTER TABLE empresas ALTER COLUMN jornada_maxima_semanal SET DEFAULT 42;
ALTER TABLE empresas ALTER COLUMN recargo_dominical_festivo SET DEFAULT 30.00;
UPDATE empresas SET jornada_maxima_semanal = 42 WHERE jornada_maxima_semanal = 44;
UPDATE empresas SET recargo_dominical_festivo = 30.00 WHERE recargo_dominical_festivo = 50.00;

-- -----------------------------------------------------
-- Guardias: cargo para mostrar en la grilla y contratos
-- -----------------------------------------------------
ALTER TABLE guardias ADD COLUMN IF NOT EXISTS cargo VARCHAR(100);

-- -----------------------------------------------------
-- Plantillas de turno: datos que usa el motor compartido
-- -----------------------------------------------------
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS codigo VARCHAR(10);
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#0f766e';
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS minutos_colacion INTEGER DEFAULT 60;
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS cobertura_semanal INTEGER[] DEFAULT '{1,1,1,1,1,0,0}';
ALTER TABLE turno_plantillas ADD COLUMN IF NOT EXISTS certificaciones_requeridas TEXT[] DEFAULT '{}';

-- -----------------------------------------------------
-- Puestos: vínculo con plantilla y cobertura por día
-- -----------------------------------------------------
ALTER TABLE puestos ADD COLUMN IF NOT EXISTS turno_plantilla_id UUID
  REFERENCES turno_plantillas(id) ON DELETE SET NULL;
ALTER TABLE puestos ADD COLUMN IF NOT EXISTS cobertura_semanal INTEGER[];
ALTER TABLE puestos ADD COLUMN IF NOT EXISTS certificaciones_requeridas TEXT[] DEFAULT '{}';

-- -----------------------------------------------------
-- Configuración legal: parámetros del validador compartido
-- Las columnas nuevas son NULL para no pisar los presets sectoriales
-- cuando la empresa no ha definido un valor propio.
-- -----------------------------------------------------
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS max_daily_hours INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS max_exceptional_daily_hours INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS max_exceptional_average_weekly_hours INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS max_consecutive_work_days INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS block_rest_days INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS min_sundays_off_per_month INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS max_consecutive_night_shifts INTEGER;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS allow_sunday_work BOOLEAN;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS allow_holiday_work BOOLEAN;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS require_certifications BOOLEAN;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS require_full_coverage BOOLEAN;
ALTER TABLE configuracion_legal ADD COLUMN IF NOT EXISTS recargo_festivo DECIMAL(5,2);

ALTER TABLE configuracion_legal ALTER COLUMN jornada_maxima_semanal SET DEFAULT 42;
ALTER TABLE configuracion_legal ALTER COLUMN recargo_dominical_festivo SET DEFAULT 30.00;
UPDATE configuracion_legal SET jornada_maxima_semanal = 42 WHERE jornada_maxima_semanal = 44;
UPDATE configuracion_legal SET recargo_dominical_festivo = 30.00 WHERE recargo_dominical_festivo = 50.00;

-- -----------------------------------------------------
-- Escenarios de horario: guarda configuración, grilla y validación
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS escenarios_horario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    nombre VARCHAR(200) NOT NULL,
    sector VARCHAR(20) NOT NULL DEFAULT 'seguridad',
    fecha_inicio DATE NOT NULL,
    dias INTEGER NOT NULL CHECK (dias BETWEEN 1 AND 120),
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    configuracion JSONB NOT NULL,
    horario JSONB NOT NULL,
    validacion JSONB NOT NULL,
    huella VARCHAR(32),
    generado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

ALTER TABLE horarios ADD COLUMN IF NOT EXISTS escenario_id UUID
  REFERENCES escenarios_horario(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_escenarios_empresa ON escenarios_horario(empresa_id, generado_en DESC);
CREATE INDEX IF NOT EXISTS idx_escenarios_sector ON escenarios_horario(sector);
CREATE INDEX IF NOT EXISTS idx_horarios_escenario ON horarios(escenario_id);
CREATE INDEX IF NOT EXISTS idx_puestos_plantilla ON puestos(turno_plantilla_id);

COMMIT;

-- Nota: `horarios.puesto_id` sigue siendo NOT NULL. El servicio solo inserta
-- asignaciones cuando los turnos provienen de puestos de la base de datos; los
-- escenarios libres quedan persistidos completos en `escenarios_horario`.
