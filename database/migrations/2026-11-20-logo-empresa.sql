-- ============================================
-- TURNSOFT · Logo de la empresa
-- Guarda el logo como imagen pequeña (data URL) en la propia ficha de la empresa.
-- Es aditiva e idempotente: puede correrse más de una vez.
-- ============================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo TEXT;
