-- ============================================
-- TURNSOFT - Esquema de base de datos
-- Sistema generador de horarios para guardias
-- de seguridad privada (Chile)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------
-- Tabla: empresas
-- -----------------------------------------------------
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razon_social VARCHAR(200) NOT NULL,
    rut_empresa VARCHAR(12) NOT NULL UNIQUE,
    jornada_maxima_semanal INTEGER NOT NULL DEFAULT 44,
    descanso_minimo_entre_turnos INTEGER NOT NULL DEFAULT 12,
    horas_extras_max_diarias INTEGER NOT NULL DEFAULT 2,
    recargo_dominical_festivo DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: sucursales
-- -----------------------------------------------------
CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
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
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: turno_plantillas
-- -----------------------------------------------------
CREATE TABLE turno_plantillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL,
    duracion_horas INTEGER NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    requiere_colacion BOOLEAN DEFAULT TRUE,
    es_nocturno BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------
-- Tabla: guardias
-- -----------------------------------------------------
CREATE TABLE guardias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(200) NOT NULL,
    rut VARCHAR(12) NOT NULL,
    email VARCHAR(200),
    telefono VARCHAR(20),
    fecha_contrato DATE,
    horas_semanales_max INTEGER,
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
-- Tabla: horarios
-- -----------------------------------------------------
CREATE TABLE horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    jornada_maxima_semanal INTEGER NOT NULL DEFAULT 44,
    descanso_minimo_entre_turnos INTEGER NOT NULL DEFAULT 12,
    horas_extras_max_diarias INTEGER NOT NULL DEFAULT 2,
    recargo_dominical_festivo DECIMAL(5,2) NOT NULL DEFAULT 50.00,
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