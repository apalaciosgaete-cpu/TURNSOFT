-- Usuarios internos de la empresa: titular (operador), administrador y validador.
-- El titular se crea al registrar la empresa; desde la app se asignan los demás.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS creado_por UUID;

DO $$
BEGIN
    ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_creado_por_fkey
        FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_scope_check;
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_scope_check CHECK (
        (rol = 'superadmin' AND empresa_id IS NULL AND cliente_id IS NULL) OR
        (rol IN ('operador', 'admin', 'validador') AND cliente_id IS NULL) OR
        (rol = 'cliente' AND cliente_id IS NOT NULL)
    );

COMMIT;
