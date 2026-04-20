-- Migração para adicionar campos de observabilidade distribuída na tabela app_logs

ALTER TABLE app_logs
ADD COLUMN IF NOT EXISTS service_name TEXT,
ADD COLUMN IF NOT EXISTS trace_id TEXT,
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS request_path TEXT,
ADD COLUMN IF NOT EXISTS http_method TEXT,
ADD COLUMN IF NOT EXISTS http_status INTEGER,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Criação de sub-índices rápidos para o novo dashboard de observabilidade
CREATE INDEX IF NOT EXISTS idx_app_logs_trace_id ON app_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_service_name ON app_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_app_logs_http_status ON app_logs(http_status);

COMMENT ON COLUMN app_logs.trace_id IS 'ID único de requisição repassado do frontend/nginx';
COMMENT ON COLUMN app_logs.instance_id IS 'Hostname do container Docker do Swarm (Node ID)';
COMMENT ON COLUMN app_logs.service_name IS 'Nome do serviço rodando (e.g., backend, frontend)';
