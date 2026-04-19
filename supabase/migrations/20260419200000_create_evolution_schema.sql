-- Cria o schema evolution_cloud para separar as tabelas da Evolution API
CREATE SCHEMA IF NOT EXISTS evolution_cloud;

-- Dá permissão ao role authenticator / postgres no schema
GRANT ALL ON SCHEMA evolution_cloud TO postgres;
GRANT ALL ON SCHEMA evolution_cloud TO authenticated;
GRANT ALL ON SCHEMA evolution_cloud TO service_role;
