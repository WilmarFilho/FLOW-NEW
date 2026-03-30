-- =============================================
-- Tabela: agentes
-- Descrição: Agentes IA vinculados ao usuário
-- =============================================
CREATE TABLE public.agentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_de_agente TEXT NOT NULL DEFAULT 'atendente',
  prompt_sistema TEXT,
  modelo TEXT DEFAULT 'gpt-4o-mini',
  temperatura NUMERIC(3,2) DEFAULT 0.7,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agents"
  ON public.agentes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own agents"
  ON public.agentes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own agents"
  ON public.agentes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own agents"
  ON public.agentes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on agentes"
  ON public.agentes TO service_role
  USING (true) WITH CHECK (true);

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
