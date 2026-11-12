-- Supervisor maestro de TURNSOFT
-- Rol global (sin empresa), planes, pagos, bloqueo por no pago y soporte.

BEGIN;

CREATE TABLE IF NOT EXISTS planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion TEXT,
    precio_mensual INTEGER NOT NULL DEFAULT 0,
    moneda VARCHAR(3) NOT NULL DEFAULT 'CLP',
    max_clientes INTEGER,
    max_usuarios INTEGER,
    max_guardias INTEGER,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    CONSTRAINT planes_precio_check CHECK (precio_mensual >= 0),
    CONSTRAINT planes_limites_check CHECK (
        (max_clientes IS NULL OR max_clientes >= 0) AND
        (max_usuarios IS NULL OR max_usuarios >= 0) AND
        (max_guardias IS NULL OR max_guardias >= 0)
    )
);

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activa';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS dia_cobro INTEGER NOT NULL DEFAULT 1;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bloqueada_en TIMESTAMP;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bloqueada_por UUID;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;

DO $$
BEGIN
    ALTER TABLE empresas
        ADD CONSTRAINT empresas_plan_id_fkey
        FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE empresas
        ADD CONSTRAINT empresas_bloqueada_por_fkey
        FOREIGN KEY (bloqueada_por) REFERENCES usuarios(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_estado_check;
ALTER TABLE empresas
    ADD CONSTRAINT empresas_estado_check CHECK (estado IN ('activa', 'suspendida'));

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_dia_cobro_check;
ALTER TABLE empresas
    ADD CONSTRAINT empresas_dia_cobro_check CHECK (dia_cobro BETWEEN 1 AND 28);

CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES planes(id) ON DELETE SET NULL,
    periodo CHAR(7) NOT NULL,
    monto INTEGER NOT NULL DEFAULT 0,
    moneda VARCHAR(3) NOT NULL DEFAULT 'CLP',
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    metodo VARCHAR(30),
    referencia VARCHAR(120),
    fecha_vencimiento DATE,
    fecha_pago TIMESTAMP,
    verificado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    notas TEXT,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    CONSTRAINT pagos_periodo_check CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT pagos_monto_check CHECK (monto >= 0),
    CONSTRAINT pagos_estado_check CHECK (estado IN ('pendiente', 'pagado', 'vencido', 'anulado'))
);

CREATE INDEX IF NOT EXISTS idx_pagos_empresa_periodo ON pagos (empresa_id, periodo DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos (estado, fecha_vencimiento);

CREATE TABLE IF NOT EXISTS soporte_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    categoria VARCHAR(20) NOT NULL DEFAULT 'consulta',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
    respuesta TEXT,
    respondido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    respondido_en TIMESTAMP,
    visto_cliente BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    CONSTRAINT soporte_categoria_check CHECK (categoria IN ('consulta', 'pago', 'tecnico', 'otro')),
    CONSTRAINT soporte_prioridad_check CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    CONSTRAINT soporte_estado_check CHECK (estado IN ('abierto', 'en_revision', 'resuelto', 'cerrado'))
);

CREATE INDEX IF NOT EXISTS idx_soporte_empresa ON soporte_tickets (empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_soporte_estado ON soporte_tickets (estado, creado_en DESC);

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_scope_check;
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_scope_check CHECK (
        (rol = 'superadmin' AND empresa_id IS NULL AND cliente_id IS NULL) OR
        (rol IN ('operador', 'admin') AND cliente_id IS NULL) OR
        (rol = 'cliente' AND cliente_id IS NOT NULL)
    );

COMMIT;
