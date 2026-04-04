-- =============================================
-- Tabela: conhecimentos
-- Descrição: Base de conhecimento (RAG) do usuário
-- =============================================
CREATE TABLE public.conhecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  tipo TEXT CHECK (tipo IN ('texto', 'arquivo', 'url')) DEFAULT 'texto',
  url_fonte TEXT,
  status_processamento TEXT CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'erro')) DEFAULT 'pendente',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conhecimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conhecimentos"
  ON public.conhecimentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conhecimentos"
  ON public.conhecimentos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conhecimentos"
  ON public.conhecimentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conhecimentos"
  ON public.conhecimentos FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on conhecimentos"
  ON public.conhecimentos TO service_role
  USING (true) WITH CHECK (true);
