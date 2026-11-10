-- ============================================
-- TURNSOFT - Esquema de base de datos
-- Generador multi-sector de horarios laborales (Chile)
-- Sectores: seguridad, salud, minería, retail y logística
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------
-- Tabla: empresas
-- -----------------------------------------------------
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razon_social VARCHAR(200) NOT NULL,
    rut_empresa VARCHAR(12) NOT NULL UNIQUE,
    sector VARCHAR(20) NOT NULL DEFAULT 'seguridad',
    regimen_jornada VARCHAR(20) NOT NULL DEFAULT 'ordinaria',
    autorizacion_excepcional BOOLEAN NOT NULL DEFAULT FALSE,
    referencia_autorizacion VARCHAR(200),
    notas TEXT,
    jornada_maxima_semanal INTEGER NOT NULL DEFAULT 42,
    descanso_minimo_entre_turnos INTEGER NOT NULL DEFAULT 12,
    horas_extras_max_diarias INTEGER NOT NULL DEFAULT 2,
    recargo_dominical_festivo DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: clientes (mandantes de la empresa operadora)
-- -----------------------------------------------------
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    razon_social VARCHAR(200),
    rut VARCHAR(12),
    sector VARCHAR(20) NOT NULL DEFAULT 'seguridad',
    contacto VARCHAR(200),
    email VARCHAR(200),
    telefono VARCHAR(50),
    direccion TEXT,
    ciudad VARCHAR(100),
    color VARCHAR(20) DEFAULT '#0f766e',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    UNIQUE (empresa_id, nombre)
);

-- -----------------------------------------------------
-- Tabla: usuarios
-- rol = 'operador' -> todos los clientes de su empresa
-- rol = 'cliente'  -> solo su propio cliente
-- -----------------------------------------------------
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    CONSTRAINT usuarios_scope_check CHECK (
        (rol = 'operador' AND cliente_id IS NULL) OR
        (rol = 'cliente' AND cliente_id IS NOT NULL)
    )
);

-- -----------------------------------------------------
-- Tabla: sucursales
-- -----------------------------------------------------
CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    ciudad VARCHAR(100),
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: puestos
-- -----------------------------------------------------
CREATE TABLE puestos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    minima_cobertura INTEGER NOT NULL DEFAULT 1,
    turno_plantilla_id UUID,
    cobertura_semanal INTEGER[],
    certificaciones_requeridas TEXT[] DEFAULT '{}',
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: turno_plantillas
-- -----------------------------------------------------
CREATE TABLE turno_plantillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL,
    codigo VARCHAR(10),
    duracion_horas INTEGER NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    requiere_colacion BOOLEAN DEFAULT TRUE,
    minutos_colacion INTEGER DEFAULT 60,
    es_nocturno BOOLEAN DEFAULT FALSE,
    color VARCHAR(20) DEFAULT '#0f766e',
    cobertura_semanal INTEGER[] DEFAULT '{1,1,1,1,1,0,0}',
    certificaciones_requeridas TEXT[] DEFAULT '{}',
    creado_en TIMESTAMP DEFAULT NOW()
);

ALTER TABLE puestos
    ADD CONSTRAINT fk_puestos_turno_plantilla
    FOREIGN KEY (turno_plantilla_id) REFERENCES turno_plantillas(id) ON DELETE SET NULL;

-- -----------------------------------------------------
-- Tabla: guardias
-- -----------------------------------------------------
CREATE TABLE guardias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    nombre_completo VARCHAR(200) NOT NULL,
    rut VARCHAR(12) NOT NULL,
    email VARCHAR(200),
    telefono VARCHAR(20),
    fecha_contrato DATE,
    horas_semanales_max INTEGER,
    cargo VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: certificaciones_os10
-- -----------------------------------------------------
CREATE TABLE certificaciones_os10 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardia_id UUID NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    numero_certificado VARCHAR(50) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    emitido_por VARCHAR(100) DEFAULT 'OS-10 Carabineros de Chile',
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: disponibilidad_guardias
-- -----------------------------------------------------
CREATE TABLE disponibilidad_guardias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardia_id UUID NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL,
    disponible BOOLEAN DEFAULT TRUE,
    hora_inicio TIME,
    hora_fin TIME,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: escenarios_horario
-- Guarda configuración, grilla y validación del motor compartido
-- -----------------------------------------------------
CREATE TABLE escenarios_horario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
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

-- -----------------------------------------------------
-- Tabla: horarios
-- -----------------------------------------------------
CREATE TABLE horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escenario_id UUID REFERENCES escenarios_horario(id) ON DELETE CASCADE,
    guardia_id UUID NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    puesto_id UUID NOT NULL REFERENCES puestos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIMESTAMP NOT NULL,
    hora_fin TIMESTAMP NOT NULL,
    horas_trabajadas DECIMAL(5,2) NOT NULL,
    tipo_turno VARCHAR(20) DEFAULT 'ordinario',
    estado VARCHAR(20) DEFAULT 'borrador',
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: descansos
-- -----------------------------------------------------
CREATE TABLE descansos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardia_id UUID NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: solicitudes
-- -----------------------------------------------------
CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardia_id UUID NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente',
    motivo TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: configuracion_legal (por empresa)
-- -----------------------------------------------------
CREATE TABLE configuracion_legal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
    jornada_maxima_semanal INTEGER NOT NULL DEFAULT 42,
    descanso_minimo_entre_turnos INTEGER NOT NULL DEFAULT 12,
    horas_extras_max_diarias INTEGER NOT NULL DEFAULT 2,
    recargo_dominical_festivo DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    max_daily_hours INTEGER,
    max_exceptional_daily_hours INTEGER,
    max_exceptional_average_weekly_hours INTEGER,
    max_consecutive_work_days INTEGER,
    block_rest_days INTEGER,
    min_sundays_off_per_month INTEGER,
    max_consecutive_night_shifts INTEGER,
    allow_sunday_work BOOLEAN,
    allow_holiday_work BOOLEAN,
    require_certifications BOOLEAN,
    require_full_coverage BOOLEAN,
    recargo_festivo DECIMAL(5,2),
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: auditoria
-- -----------------------------------------------------
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL,
    usuario_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Índices
-- -----------------------------------------------------
CREATE INDEX idx_horarios_guardia_fecha ON horarios(guardia_id, fecha);
CREATE INDEX idx_horarios_puesto_fecha ON horarios(puesto_id, fecha);
CREATE INDEX idx_certificaciones_vencimiento ON certificaciones_os10(fecha_vencimiento);
CREATE INDEX idx_guardias_empresa ON guardias(empresa_id);
CREATE INDEX idx_horarios_estado ON horarios(estado);
CREATE INDEX idx_horarios_escenario ON horarios(escenario_id);
CREATE INDEX idx_escenarios_empresa ON escenarios_horario(empresa_id, generado_en DESC);
CREATE INDEX idx_escenarios_sector ON escenarios_horario(sector);
CREATE INDEX idx_puestos_plantilla ON puestos(turno_plantilla_id);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id, nombre);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_cliente ON usuarios(cliente_id);
CREATE INDEX idx_sucursales_cliente ON sucursales(cliente_id);
CREATE INDEX idx_guardias_cliente ON guardias(cliente_id);
CREATE INDEX idx_escenarios_cliente ON escenarios_horario(cliente_id, generado_en DESC);
CREATE INDEX idx_solicitudes_cliente ON solicitudes(cliente_id);