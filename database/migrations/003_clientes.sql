-- ============================================
-- TURNSOFT · Migración 003: cuentas por cliente
-- Aísla los datos de cada cliente bajo una empresa operadora.
-- Es idempotente: puede correrse más de una vez.
-- ============================================

BEGIN;

-- -----------------------------------------------------
-- Clientes (mandantes) de una empresa operadora
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
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
-- Usuarios de acceso
-- rol = 'operador'  -> ve todos los clientes de su empresa
-- rol = 'cliente'   -> solo ve su propio cliente
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
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
-- Vínculo de datos operativos con el cliente
-- -----------------------------------------------------
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS cliente_id UUID
    REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE guardias ADD COLUMN IF NOT EXISTS cliente_id UUID
    REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE escenarios_horario ADD COLUMN IF NOT EXISTS cliente_id UUID
    REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS cliente_id UUID
    REFERENCES clientes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id, nombre);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sucursales_cliente ON sucursales(cliente_id);
CREATE INDEX IF NOT EXISTS idx_guardias_cliente ON guardias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_escenarios_cliente ON escenarios_horario(cliente_id, generado_en DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente ON solicitudes(cliente_id);

COMMIT;
