CREATE TABLE app_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    level TEXT CHECK (level IN ('info', 'warn', 'error', 'debug', 'fatal')) NOT NULL,
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Como os logs serão inseridos principalmente pela API NestJS autenticada (usando jwt do usuario)
-- precisamos permitir que os usuários logados insiram na tabela em seu nome.
CREATE POLICY "Usuários autenticados podem inserir seus logs" 
ON app_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- E o service role (backend em ações globais) pode fazer o que quiser
CREATE POLICY "Admin tem o poder total sobre logs" 
ON app_logs 
TO service_role 
USING (true) 
WITH CHECK (true);
